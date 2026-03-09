import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Bot, User, Send, X, Plus, Loader2, ArrowLeft,
  MessageCircle, Trash2, Clock, Sparkles, Headphones
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

export default function AIChatBot({ isOpen, onClose, onCreateTicket }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (isOpen) { fetchSessions(); inputRef.current?.focus(); } }, [isOpen]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/support/chat/sessions');
      setSessions(res.data?.sessions || []);
    } catch { /* empty */ }
    finally { setLoadingSessions(false); }
  };

  const loadSession = async (sessionId) => {
    try {
      const res = await api.get(`/support/chat/session/${sessionId}`);
      setActiveSessionId(sessionId);
      setMessages(res.data?.messages || []);
      setShowSidebar(false);
    } catch {
      toast.error('Failed to load conversation');
    }
  };

  const startNewChat = async () => {
    try {
      const res = await api.post('/support/chat/new-session');
      const newId = res.data?.session_id;
      setActiveSessionId(newId);
      setMessages([]);
      setShowSidebar(false);
      fetchSessions();
    } catch {
      toast.error('Failed to start new chat');
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await api.delete(`/support/chat/session/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setShowSidebar(true);
      }
    } catch { toast.error('Failed to delete session'); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/support/chat', {
        message: userMsg.content,
        session_id: activeSessionId
      });
      const { response, session_id, escalate_to_human } = res.data;
      if (!activeSessionId) setActiveSessionId(session_id);
      setMessages(prev => [...prev, {
        role: 'assistant', content: response,
        timestamp: new Date().toISOString(), escalate: escalate_to_human
      }]);
      fetchSessions();
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again or create a support ticket.",
        timestamp: new Date().toISOString()
      }]);
    } finally { setLoading(false); }
  };

  const handleEscalateToTicket = () => {
    if (onCreateTicket && activeSessionId) {
      onCreateTicket(activeSessionId, messages);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" data-testid="ai-chatbot-overlay">
      <div className="w-full h-full md:w-[900px] md:h-[85vh] md:rounded-2xl bg-white shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Sessions Sidebar */}
        <div className={`${showSidebar ? 'w-72' : 'w-0 hidden md:block md:w-72'} border-r bg-slate-50/80 flex flex-col transition-all`}>
          <div className="p-4 border-b bg-white/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#082c59]" />
                Conversations
              </h3>
              <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setShowSidebar(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={startNewChat}
              className="w-full bg-[#082c59] hover:bg-[#0a3a75] gap-2 shadow-md"
              size="sm"
              data-testid="new-chat-btn"
            >
              <Plus className="h-4 w-4" /> New Chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No conversations yet</p>
                  <p className="text-xs text-slate-400 mt-1">Start a new chat to get help</p>
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all group ${
                      activeSessionId === session.id
                        ? 'bg-[#082c59]/10 border border-[#082c59]/20 shadow-sm'
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{session.preview}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {new Date(session.updated_at).toLocaleDateString()}
                          </span>
                          {session.escalated && (
                            <Badge className="bg-orange-100 text-orange-700 text-[9px] px-1 h-4">Escalated</Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-5 py-3.5 border-b bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="md:hidden p-1.5 hover:bg-white/10 rounded-lg" onClick={() => setShowSidebar(true)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Oryno AI Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/70">Online - 24/7</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 text-xs gap-1.5"
                onClick={startNewChat}
              >
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                data-testid="close-chatbot-btn"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-16 h-16 bg-[#082c59]/5 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-[#082c59]/40" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">How can I help you?</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ask me about bookings, payments, account issues, or anything about Oryno services.
                </p>
                <div className="flex flex-wrap gap-2 mt-5 justify-center">
                  {['Booking help', 'Payment issue', 'My account'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-2 max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                    msg.role === 'user' ? 'bg-[#082c59]' : 'bg-slate-100'
                  }`}>
                    {msg.role === 'user'
                      ? <User className="h-3.5 w-3.5 text-white" />
                      : <Bot className="h-3.5 w-3.5 text-[#082c59]" />}
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[#082c59] text-white rounded-br-md'
                      : 'bg-white border border-slate-100 text-slate-800 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.escalate && (
                      <Button
                        size="sm"
                        className="mt-2 bg-orange-500 hover:bg-orange-600 text-white text-xs gap-1.5"
                        onClick={handleEscalateToTicket}
                        data-testid="create-ticket-from-chat-btn"
                      >
                        <Headphones className="h-3.5 w-3.5" /> Create Ticket
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-[#082c59]" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 rounded-bl-md shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[#082c59]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
            <div className="flex gap-2.5">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-slate-50/80 border-slate-200 focus:border-[#082c59]/30 focus:ring-[#082c59]/10"
                disabled={loading}
                data-testid="chat-input"
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-[#082c59] hover:bg-[#0a3a75] shadow-md px-4"
                data-testid="chat-send-btn"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <button
                onClick={handleEscalateToTicket}
                className="text-xs text-slate-500 hover:text-[#082c59] flex items-center gap-1.5 transition-colors"
                data-testid="escalate-to-human-btn"
              >
                <Headphones className="h-3.5 w-3.5" /> Talk to a human agent
              </button>
              <span className="text-[10px] text-slate-400">Powered by Oryno AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
