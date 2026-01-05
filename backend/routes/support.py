from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
import os
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/support", tags=["Support"])

# Import emergent integrations for AI chatbot
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    print("Warning: emergentintegrations not available, chatbot will use fallback responses")

# Store active WebSocket connections for live chat
active_connections: Dict[str, WebSocket] = {}
# Store chat sessions
chat_sessions: Dict[str, dict] = {}
# Store support tickets
support_tickets: List[dict] = []

# Chatbot system message
CHATBOT_SYSTEM_MESSAGE = """You are a helpful customer support assistant for Oryno, a comprehensive booking and services platform. 
You help customers with:
- Booking questions (hotels, travel, restaurants, car rentals, events, cinema, laundry, packages/delivery)
- Payment issues and refunds (we accept MTN Mobile Money, Orange Money, credit cards)
- Account management (profile updates, password resets)
- Service availability and pricing (all prices are in FCFA)
- General platform navigation

Be friendly, professional, and concise. If you cannot help with a specific issue, offer to connect them with a human support agent.
Always respond in the same language the customer uses. If unsure, use English or French.

Important details about Oryno:
- Official currency: FCFA (Central African CFA franc)
- Available services: Hotels, Travel/Transport, Restaurants, Car Rental, Events, Cinema, Banquet Halls, Laundry, Package Delivery
- Support hours: 24/7 AI support, Human support available 8AM-10PM WAT
- Locations served: Major cities in Cameroon including Yaoundé, Douala, Bafoussam, Bamenda, Garoua, etc.
"""

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    escalate_to_human: bool = False

class SupportTicket(BaseModel):
    subject: str
    message: str
    priority: str = "medium"
    user_email: Optional[str] = None
    user_name: Optional[str] = None

class TicketResponse(BaseModel):
    ticket_id: str
    status: str
    message: str

# Fallback responses for when LLM is not available
FALLBACK_RESPONSES = {
    "booking": "For booking assistance, please visit our Services page or contact our support team. You can modify or cancel bookings from your Orders page up to 24 hours before the scheduled time.",
    "payment": "We accept MTN Mobile Money, Orange Money, and major credit cards. All prices are in FCFA. For payment issues, please check your Orders page or contact support.",
    "refund": "Refunds are processed within 5-10 business days. The refund will be sent to your original payment method. Please contact support if you haven't received your refund.",
    "account": "You can manage your account settings including profile, password, and preferences from the Settings page. For password resets, use the 'Forgot Password' link on the login page.",
    "default": "Thank you for your message. I'm here to help with bookings, payments, account issues, and general questions. How can I assist you today?"
}

def get_fallback_response(message: str) -> str:
    """Get a fallback response based on keywords when LLM is not available"""
    message_lower = message.lower()
    if any(word in message_lower for word in ["book", "reserve", "reservation", "booking"]):
        return FALLBACK_RESPONSES["booking"]
    elif any(word in message_lower for word in ["pay", "payment", "charge", "money", "momo", "mobile money"]):
        return FALLBACK_RESPONSES["payment"]
    elif any(word in message_lower for word in ["refund", "return", "cancel"]):
        return FALLBACK_RESPONSES["refund"]
    elif any(word in message_lower for word in ["account", "password", "profile", "login", "settings"]):
        return FALLBACK_RESPONSES["account"]
    return FALLBACK_RESPONSES["default"]

@router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(chat_message: ChatMessage):
    """Send a message to the AI chatbot"""
    session_id = chat_message.session_id or str(uuid.uuid4())
    
    # Initialize session if needed
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "escalated": False
        }
    
    # Store user message
    chat_sessions[session_id]["messages"].append({
        "role": "user",
        "content": chat_message.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Check for escalation keywords
    escalate_keywords = ["human", "agent", "real person", "talk to someone", "escalate", "support agent", "live support"]
    should_escalate = any(keyword in chat_message.message.lower() for keyword in escalate_keywords)
    
    if should_escalate:
        response_text = "I understand you'd like to speak with a human support agent. I'm connecting you now. Please wait a moment while we find an available agent, or click the 'Live Chat' button below to start a direct conversation."
        chat_sessions[session_id]["escalated"] = True
    elif LLM_AVAILABLE:
        try:
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if not api_key:
                raise ValueError("EMERGENT_LLM_KEY not configured")
            
            chat = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=CHATBOT_SYSTEM_MESSAGE
            ).with_model("openai", "gpt-4o")
            
            user_msg = UserMessage(text=chat_message.message)
            response_text = await chat.send_message(user_msg)
            
        except Exception as e:
            print(f"LLM Error: {e}")
            response_text = get_fallback_response(chat_message.message)
    else:
        response_text = get_fallback_response(chat_message.message)
    
    # Store bot response
    chat_sessions[session_id]["messages"].append({
        "role": "assistant",
        "content": response_text,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return ChatResponse(
        response=response_text,
        session_id=session_id,
        escalate_to_human=should_escalate
    )

@router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    if session_id not in chat_sessions:
        return {"messages": []}
    return {"messages": chat_sessions[session_id]["messages"]}

@router.post("/ticket", response_model=TicketResponse)
async def create_support_ticket(ticket: SupportTicket):
    """Create a support ticket for human follow-up"""
    ticket_id = f"TKT-{uuid.uuid4().hex[:8].upper()}"
    
    new_ticket = {
        "id": ticket_id,
        "subject": ticket.subject,
        "message": ticket.message,
        "priority": ticket.priority,
        "user_email": ticket.user_email,
        "user_name": ticket.user_name,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    support_tickets.append(new_ticket)
    
    return TicketResponse(
        ticket_id=ticket_id,
        status="open",
        message=f"Your support ticket {ticket_id} has been created. Our team will respond within 24 hours."
    )

@router.get("/tickets")
async def list_tickets():
    """List all support tickets (admin only)"""
    return {"tickets": support_tickets}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.agent_connections: Dict[str, WebSocket] = {}
        self.chat_rooms: Dict[str, List[str]] = {}  # room_id -> [user_ids]
    
    async def connect_user(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    async def connect_agent(self, websocket: WebSocket, agent_id: str):
        await websocket.accept()
        self.agent_connections[agent_id] = websocket
    
    def disconnect_user(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    def disconnect_agent(self, agent_id: str):
        if agent_id in self.agent_connections:
            del self.agent_connections[agent_id]
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def send_to_agent(self, agent_id: str, message: dict):
        if agent_id in self.agent_connections:
            await self.agent_connections[agent_id].send_json(message)
    
    async def broadcast_to_agents(self, message: dict):
        for agent_id, connection in self.agent_connections.items():
            try:
                await connection.send_json(message)
            except:
                pass
    
    def get_available_agent(self) -> Optional[str]:
        if self.agent_connections:
            return list(self.agent_connections.keys())[0]
        return None

manager = ConnectionManager()

# Store live chat messages
live_chat_messages: Dict[str, List[dict]] = {}

@router.websocket("/ws/user/{user_id}")
async def websocket_user_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for users requesting live support"""
    await manager.connect_user(websocket, user_id)
    
    # Initialize chat room
    room_id = f"room_{user_id}"
    if room_id not in live_chat_messages:
        live_chat_messages[room_id] = []
    
    # Notify agents of new user
    await manager.broadcast_to_agents({
        "type": "new_user",
        "user_id": user_id,
        "room_id": room_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            message = {
                "type": "message",
                "sender": "user",
                "sender_id": user_id,
                "content": data.get("content", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "room_id": room_id
            }
            
            live_chat_messages[room_id].append(message)
            
            # Forward to agents
            await manager.broadcast_to_agents(message)
            
    except WebSocketDisconnect:
        manager.disconnect_user(user_id)
        await manager.broadcast_to_agents({
            "type": "user_disconnected",
            "user_id": user_id,
            "room_id": room_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

@router.websocket("/ws/agent/{agent_id}")
async def websocket_agent_endpoint(websocket: WebSocket, agent_id: str):
    """WebSocket endpoint for support agents"""
    await manager.connect_agent(websocket, agent_id)
    
    # Send list of active users
    active_users = list(manager.active_connections.keys())
    await websocket.send_json({
        "type": "active_users",
        "users": active_users
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            target_user_id = data.get("target_user_id")
            room_id = f"room_{target_user_id}"
            
            message = {
                "type": "message",
                "sender": "agent",
                "sender_id": agent_id,
                "sender_name": data.get("agent_name", "Support Agent"),
                "content": data.get("content", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "room_id": room_id
            }
            
            if room_id not in live_chat_messages:
                live_chat_messages[room_id] = []
            live_chat_messages[room_id].append(message)
            
            # Send to target user
            await manager.send_to_user(target_user_id, message)
            
            # Also broadcast to other agents
            await manager.broadcast_to_agents(message)
            
    except WebSocketDisconnect:
        manager.disconnect_agent(agent_id)

@router.get("/live-chat/history/{room_id}")
async def get_live_chat_history(room_id: str):
    """Get live chat history for a room"""
    return {"messages": live_chat_messages.get(room_id, [])}

@router.get("/live-chat/active-users")
async def get_active_users():
    """Get list of users waiting for support"""
    return {"users": list(manager.active_connections.keys())}
