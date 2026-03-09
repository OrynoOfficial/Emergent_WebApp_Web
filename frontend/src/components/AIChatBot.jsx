import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Bot, User, Send, X, Plus, Loader2,
  MessageCircle, Trash2, Clock, Sparkles, Headphones,
  PanelLeftOpen, PanelLeftClose, ExternalLink, ChevronRight
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

// Rich message: Quick reply buttons
function QuickReplies({ options, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map((opt, i) => (
        <button key={i} onClick={() => onSelect(opt)} className="px-3 py-1.5 text-xs font-medium bg-white border border-[#082c59]/20 rounded-full text-[#082c59] hover:bg-[#082c59]/5 transition-all shadow-sm">
          {opt}
        </button>
      ))}
    </div>
  );
}

// Rich message: Info card
function InfoCard({ title, description, link }) {
  return (
    <div className="mt-2 p-3 bg-white/80 border border-slate-200/50 rounded-lg shadow-sm">
      <h4 className="font-semibold text-xs text-slate-800">{title}</h4>
      {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      {link && (
        <a href={link} className="text-[11px] text-[#082c59] flex items-center gap-1 mt-1.5 hover:underline">
          <ExternalLink className="h-3 w-3" /> Learn more
        </a>
      )}
    </div>
  );
}

export default function AIChatBot({ isOpen, onClose, onCreateTicket }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen) { fetchSessions(); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try { const res = await api.get('/support/chat/sessions'); setSessions(res.data?.sessions || []); }
    catch { /* empty */ }
    finally { setLoadingSessions(false); }
  };

  const loadSession = async (sessionId) => {
    try {
      const res = await api.get(`/support/chat/session/${sessionId}`);
      setActiveSessionId(sessionId);
      setMessages(res.data?.messages || []);
      setSidebarOpen(false);
    } catch { toast.error('Failed to load conversation'); }
  };

  const startNewChat = async () => {
    try {
      const res = await api.post('/support/chat/new-session');
      setActiveSessionId(res.data?.session_id);
      setMessages([]);
      setSidebarOpen(false);
      fetchSessions();
    } catch { toast.error('Failed to start new chat'); }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await api.delete(`/support/chat/session/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) { setActiveSessionId(null); setMessages([]); }
    } catch { toast.error('Failed to delete session'); }
  };

  const sendMessage = async (text) => {
    const msgText = text || input;
    if (!msgText.trim() || loading) return;
    const userMsg = { role: 'user', content: msgText, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/support/chat', { message: msgText, session_id: activeSessionId });
      const { response, session_id, escalate_to_human } = res.data;
      if (!activeSessionId) setActiveSessionId(session_id);

      // Parse rich content from response
      const richMsg = { role: 'assistant', content: response, timestamp: new Date().toISOString(), escalate: escalate_to_human };

      // Detect quick replies from context
      if (response.toLowerCase().includes('booking') || response.toLowerCase().includes('help you with')) {
        richMsg.quickReplies = ['Check my booking', 'Make a new booking', 'Cancel a booking'];
      }
      if (response.toLowerCase().includes('payment') || response.toLowerCase().includes('refund')) {
        richMsg.quickReplies = ['Check payment status', 'Request refund', 'Payment methods'];
      }
      if (escalate_to_human) {
        richMsg.quickReplies = ['Create support ticket', 'Continue with AI'];
      }

      setMessages(prev => [...prev, richMsg]);
      fetchSessions();
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again.", timestamp: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const handleQuickReply = (text) => {
    if (text === 'Create support ticket') {
      handleEscalateToTicket();
    } else if (text === 'Continue with AI') {
      sendMessage("I'd like to continue chatting with the AI assistant");
    } else {
      sendMessage(text);
    }
  };

  const handleEscalateToTicket = () => {
    if (onCreateTicket && activeSessionId) {
      onCreateTicket(activeSessionId, messages);
    } else if (onCreateTicket) {
      // No active session yet, create one first then escalate
      onCreateTicket(null, messages);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 flex gap-2 items-end" style={{ zIndex: 99999 }} data-testid="ai-chatbot-panel">
      {/* Sessions sidebar - slides in from left of chat */}
      {sidebarOpen && (
        <div className="w-56 h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden animate-in slide-in-from-right-2 duration-200">
          <div className="p-3 border-b bg-slate-50/80">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-xs text-slate-700">History</h3>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-slate-100"><X className="h-3.5 w-3.5 text-slate-400" /></button>
            </div>
            <Button onClick={startNewChat} className="w-full bg-[#082c59] hover:bg-[#0a3a75] gap-1.5 h-7 text-xs" size="sm" data-testid="new-chat-btn">
              <Plus className="h-3 w-3" /> New Chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
              ) : sessions.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-6">No conversations yet</p>
              ) : sessions.map(session => (
                <button key={session.id} onClick={() => loadSession(session.id)}
                  className={`w-full text-left p-2 rounded-lg transition-all group text-[11px] ${activeSessionId === session.id ? 'bg-[#082c59]/10 border border-[#082c59]/20' : 'hover:bg-slate-50'}`}>
                  <p className="font-medium text-slate-700 truncate">{session.preview}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-slate-400">{new Date(session.updated_at).toLocaleDateString()}</span>
                    <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50"><Trash2 className="h-2.5 w-2.5 text-red-400" /></button>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200" data-testid="ai-chatbot-widget">
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-white/10 rounded-lg transition-colors" data-testid="toggle-sidebar-btn">
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center"><Bot className="h-4 w-4" /></div>
            <div>
              <h3 className="font-semibold text-xs">Oryno AI</h3>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[9px] text-white/70">Online</span></div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 text-[10px] gap-1 h-7 px-2" onClick={startNewChat}>
              <Plus className="h-3 w-3" />New
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" data-testid="close-chatbot-btn"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-slate-50/30 to-white">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 bg-[#082c59]/5 rounded-xl flex items-center justify-center mb-3"><Sparkles className="h-6 w-6 text-[#082c59]/40" /></div>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">How can I help?</h3>
              <p className="text-xs text-slate-500 mb-4">Ask about bookings, payments, or account issues.</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {['Booking help', 'Payment issue', 'My account', 'Talk to human'].map(q => (
                  <button key={q} onClick={() => { if (q === 'Talk to human') { sendMessage('I want to talk to a human agent'); } else { setInput(q); } }}
                    className="px-3 py-1.5 text-[11px] font-medium bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 transition-all shadow-sm">{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[#082c59]' : 'bg-slate-100'}`}>
                  {msg.role === 'user' ? <User className="h-3 w-3 text-white" /> : <Bot className="h-3 w-3 text-[#082c59]" />}
                </div>
                <div>
                  <div className={`px-3 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-[#082c59] text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {/* Escalate button */}
                  {msg.escalate && (
                    <Button size="sm" className="mt-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] gap-1 h-7" onClick={handleEscalateToTicket} data-testid="create-ticket-from-chat-btn">
                      <Headphones className="h-3 w-3" /> Create Support Ticket
                    </Button>
                  )}
                  {/* Quick replies */}
                  {msg.quickReplies && msg.role === 'assistant' && idx === messages.length - 1 && (
                    <QuickReplies options={msg.quickReplies} onSelect={handleQuickReply} />
                  )}
                  {/* Info cards for specific topics */}
                  {msg.role === 'assistant' && msg.content.toLowerCase().includes('my orders') && (
                    <InfoCard title="My Orders" description="View and manage all your bookings" link="/orders" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-end gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><Bot className="h-3 w-3 text-[#082c59]" /></div>
                <div className="px-3 py-2.5 rounded-2xl bg-white border border-slate-100 rounded-bl-sm shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-white flex-shrink-0">
          <div className="flex gap-2">
            <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message..." className="flex-1 h-9 text-xs bg-slate-50/80 border-slate-200" disabled={loading} data-testid="chat-input" />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="bg-[#082c59] hover:bg-[#0a3a75] h-9 w-9 p-0" data-testid="chat-send-btn"><Send className="h-3.5 w-3.5" /></Button>
          </div>
          <button onClick={handleEscalateToTicket} className="w-full text-[10px] text-slate-500 hover:text-[#082c59] flex items-center justify-center gap-1 mt-2 transition-colors" data-testid="escalate-to-human-btn">
            <Headphones className="h-3 w-3" /> Talk to a human agent
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
