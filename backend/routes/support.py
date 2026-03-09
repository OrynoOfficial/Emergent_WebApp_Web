from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
from config.database import get_database
from middleware.auth import get_current_active_user
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
- Locations served: Major cities in Cameroon including Yaounde, Douala, Bafoussam, Bamenda, Garoua, etc.
"""

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    escalate_to_human: bool = False

# Fallback responses for when LLM is not available
FALLBACK_RESPONSES = {
    "booking": "For booking assistance, please visit our Services page or contact our support team. You can modify or cancel bookings from your Orders page up to 24 hours before the scheduled time.",
    "payment": "We accept MTN Mobile Money, Orange Money, and major credit cards. All prices are in FCFA. For payment issues, please check your Orders page or contact support.",
    "refund": "Refunds are processed within 5-10 business days. The refund will be sent to your original payment method. Please contact support if you haven't received your refund.",
    "account": "You can manage your account settings including profile, password, and preferences from the Settings page. For password resets, use the 'Forgot Password' link on the login page.",
    "default": "Thank you for your message. I'm here to help with bookings, payments, account issues, and general questions. How can I assist you today?"
}

def get_fallback_response(message: str) -> str:
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
async def chat_with_bot(
    chat_message: ChatMessage,
    current_user: dict = Depends(get_current_active_user)
):
    """Send a message to the AI chatbot - persists sessions in MongoDB"""
    db = get_database()
    user_id = current_user["_id"]
    session_id = chat_message.session_id
    
    # Load or create session in MongoDB
    if session_id:
        session = await db.chat_sessions.find_one({"_id": session_id, "user_id": user_id})
    else:
        session = None
    
    if not session:
        session_id = str(uuid.uuid4())
        session = {
            "_id": session_id,
            "user_id": user_id,
            "user_name": current_user.get("full_name") or current_user.get("username", "User"),
            "messages": [],
            "escalated": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_sessions.insert_one(session)
    
    # Store user message
    user_msg = {
        "role": "user",
        "content": chat_message.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Check for escalation keywords
    escalate_keywords = ["human", "agent", "real person", "talk to someone", "escalate", "support agent", "live support", "speak to", "parler a", "humain"]
    should_escalate = any(keyword in chat_message.message.lower() for keyword in escalate_keywords)
    
    if should_escalate:
        response_text = "I understand you'd like to speak with a human support agent. I'll create a support ticket with our conversation so a team member can assist you. Please click 'Create Ticket' below to proceed."
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
            
            user_msg_obj = UserMessage(text=chat_message.message)
            response_text = await chat.send_message(user_msg_obj)
            
        except Exception as e:
            print(f"LLM Error: {e}")
            response_text = get_fallback_response(chat_message.message)
    else:
        response_text = get_fallback_response(chat_message.message)
    
    # Store bot response
    bot_msg = {
        "role": "assistant",
        "content": response_text,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Update session in MongoDB
    update_data = {
        "$push": {"messages": {"$each": [user_msg, bot_msg]}},
        "$set": {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "escalated": should_escalate or session.get("escalated", False)
        }
    }
    await db.chat_sessions.update_one({"_id": session_id}, update_data)
    
    return ChatResponse(
        response=response_text,
        session_id=session_id,
        escalate_to_human=should_escalate
    )


@router.get("/chat/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all chat sessions for the current user"""
    db = get_database()
    sessions = await db.chat_sessions.find(
        {"user_id": current_user["_id"]},
        {"messages": {"$slice": -1}, "user_id": 1, "created_at": 1, "updated_at": 1, "escalated": 1}
    ).sort("updated_at", -1).to_list(50)
    
    result = []
    for s in sessions:
        last_msg = s.get("messages", [{}])
        preview = last_msg[0].get("content", "New conversation") if last_msg else "New conversation"
        result.append({
            "id": s["_id"],
            "preview": preview[:80] + "..." if len(preview) > 80 else preview,
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
            "escalated": s.get("escalated", False)
        })
    
    return {"sessions": result}


@router.get("/chat/session/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get full chat session with all messages"""
    db = get_database()
    session = await db.chat_sessions.find_one({"_id": session_id, "user_id": current_user["_id"]})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "id": session["_id"],
        "messages": session.get("messages", []),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
        "escalated": session.get("escalated", False)
    }


@router.delete("/chat/session/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a chat session"""
    db = get_database()
    result = await db.chat_sessions.delete_one({"_id": session_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


@router.post("/chat/new-session")
async def create_new_session(
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new blank chat session"""
    db = get_database()
    session_id = str(uuid.uuid4())
    session = {
        "_id": session_id,
        "user_id": current_user["_id"],
        "user_name": current_user.get("full_name") or current_user.get("username", "User"),
        "messages": [],
        "escalated": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_sessions.insert_one(session)
    return {"session_id": session_id, "message": "New session created"}


# Store active WebSocket connections for live chat
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.agent_connections: Dict[str, WebSocket] = {}

    async def connect_user(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    async def connect_agent(self, websocket: WebSocket, agent_id: str):
        await websocket.accept()
        self.agent_connections[agent_id] = websocket

    def disconnect_user(self, user_id: str):
        self.active_connections.pop(user_id, None)

    def disconnect_agent(self, agent_id: str):
        self.agent_connections.pop(agent_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast_to_agents(self, message: dict):
        for conn in self.agent_connections.values():
            try:
                await conn.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

live_chat_messages: Dict[str, List[dict]] = {}

@router.websocket("/ws/user/{user_id}")
async def websocket_user_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect_user(websocket, user_id)
    room_id = f"room_{user_id}"
    if room_id not in live_chat_messages:
        live_chat_messages[room_id] = []
    await manager.broadcast_to_agents({
        "type": "new_user", "user_id": user_id, "room_id": room_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    try:
        while True:
            data = await websocket.receive_json()
            message = {
                "type": "message", "sender": "user", "sender_id": user_id,
                "content": data.get("content", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(), "room_id": room_id
            }
            live_chat_messages[room_id].append(message)
            await manager.broadcast_to_agents(message)
    except WebSocketDisconnect:
        manager.disconnect_user(user_id)

@router.websocket("/ws/agent/{agent_id}")
async def websocket_agent_endpoint(websocket: WebSocket, agent_id: str):
    await manager.connect_agent(websocket, agent_id)
    await websocket.send_json({"type": "active_users", "users": list(manager.active_connections.keys())})
    try:
        while True:
            data = await websocket.receive_json()
            target_user_id = data.get("target_user_id")
            room_id = f"room_{target_user_id}"
            message = {
                "type": "message", "sender": "agent", "sender_id": agent_id,
                "sender_name": data.get("agent_name", "Support Agent"),
                "content": data.get("content", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(), "room_id": room_id
            }
            live_chat_messages.setdefault(room_id, []).append(message)
            await manager.send_to_user(target_user_id, message)
            await manager.broadcast_to_agents(message)
    except WebSocketDisconnect:
        manager.disconnect_agent(agent_id)

@router.get("/live-chat/history/{room_id}")
async def get_live_chat_history(room_id: str):
    return {"messages": live_chat_messages.get(room_id, [])}
