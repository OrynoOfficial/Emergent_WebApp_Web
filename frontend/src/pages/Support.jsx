import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  HelpCircle, MessageCircle, Phone, Mail, Search, 
  ChevronDown, ChevronRight, Send, Bot, User, 
  Headphones, X, Loader2, ArrowLeft, Minimize2, Maximize2
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

const FAQ_DATA = [
  {
    category: 'Booking',
    questions: [
      {
        q: 'How do I make a booking?',
        a: 'Browse our services, select the one you want, choose your dates and options, then proceed to checkout. You\'ll receive a confirmation email once your booking is complete.'
      },
      {
        q: 'Can I modify my booking?',
        a: 'Yes, you can modify most bookings up to 24 hours before the scheduled time. Go to My Orders, find your booking, and click "Modify".'
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Navigate to My Orders, find the booking you want to cancel, and click "Cancel". Note that cancellation policies vary by service type.'
      }
    ]
  },
  {
    category: 'Payments',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept MTN Mobile Money, Orange Money, and major credit cards. All prices are displayed in FCFA.'
      },
      {
        q: 'When will I be charged?',
        a: 'Payment is typically processed at the time of booking. For certain services, a deposit may be required with the balance due at the time of service.'
      },
      {
        q: 'How do refunds work?',
        a: 'Refunds are processed within 5-10 business days to your original payment method. The timing may vary depending on your bank or payment provider.'
      }
    ]
  },
  {
    category: 'Account',
    questions: [
      {
        q: 'How do I reset my password?',
        a: 'Click "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox to reset your password.'
      },
      {
        q: 'How do I update my profile information?',
        a: 'Go to Settings > Profile to update your personal information, contact details, and preferences.'
      }
    ]
  }
];

// Chatbot Component
function ChatBot({ isOpen, onClose, onEscalate }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Oryno support assistant. How can I help you today? I can answer questions about bookings, payments, your account, or any of our services.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/support/chat', {
        message: input,
        session_id: sessionId
      });

      const { response: botResponse, session_id, escalate_to_human } = response.data;
      
      if (!sessionId) {
        setSessionId(session_id);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);

      if (escalate_to_human) {
        onEscalate();
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I\'m having trouble connecting. Please try again or contact our support team directly.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${minimized ? 'w-72' : 'w-96'} transition-all duration-200`}>
      <Card className="shadow-2xl border-2 border-[#082c59]/20">
        {/* Header */}
        <CardHeader className="bg-[#082c59] text-white p-4 rounded-t-lg flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Oryno Assistant</CardTitle>
              <p className="text-xs text-white/80">AI-powered support</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMinimized(!minimized)}
              className="p-1 hover:bg-white/20 rounded"
            >
              {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        {!minimized && (
          <>
            {/* Messages */}
            <CardContent className="p-0">
              <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-[#082c59]' : 'bg-[#0a3a75]'
                      }`}>
                        {msg.role === 'user' ? (
                          <User className="h-4 w-4 text-white" />
                        ) : (
                          <Bot className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className={`p-3 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-[#082c59] text-white rounded-br-sm' 
                          : 'bg-white border border-[#082c59]/20 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#0a3a75] flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-[#082c59]/20 rounded-bl-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t bg-white rounded-b-lg">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50"
                  disabled={loading}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="bg-[#082c59] hover:bg-[#0a3a75]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <button 
                onClick={onEscalate}
                className="w-full mt-2 text-sm text-[#082c59] hover:underline flex items-center justify-center gap-1"
              >
                <Headphones className="h-4 w-4" />
                Talk to a human agent
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// Live Chat Component
function LiveChat({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(true);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = useCallback(() => {
    const userId = user?.id || `guest_${Date.now()}`;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const wsUrl = backendUrl.replace('http', 'ws').replace('https', 'wss');
    
    try {
      wsRef.current = new WebSocket(`${wsUrl}/api/support/ws/user/${userId}`);

      wsRef.current.onopen = () => {
        setConnected(true);
        setMessages(prev => [...prev, {
          type: 'system',
          content: 'Connected to live support. Please wait while we connect you with an agent...'
        }]);
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.sender === 'agent') {
          setWaitingForAgent(false);
          setMessages(prev => [...prev, {
            type: 'agent',
            content: data.content,
            sender_name: data.sender_name,
            timestamp: data.timestamp
          }]);
        }
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        setMessages(prev => [...prev, {
          type: 'system',
          content: 'Disconnected from live support.'
        }]);
      };

      wsRef.current.onerror = () => {
        setMessages(prev => [...prev, {
          type: 'system',
          content: 'Connection error. Please try again later.'
        }]);
      };
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && !wsRef.current) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen, connectWebSocket]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || !connected) return;

    wsRef.current.send(JSON.stringify({ content: input }));
    setMessages(prev => [...prev, {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }]);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="shadow-2xl border-2 border-green-500/20">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-lg flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Live Support</CardTitle>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-300 animate-pulse' : 'bg-red-400'}`}></span>
                <p className="text-xs text-white/80">{connected ? 'Connected' : 'Disconnected'}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="h-4 w-4" />
          </button>
        </CardHeader>

        {/* Messages */}
        <CardContent className="p-0">
          <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {waitingForAgent && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-600 mb-2" />
                <p className="text-sm text-amber-800">Waiting for an available agent...</p>
                <p className="text-xs text-amber-600 mt-1">Average wait time: 2-5 minutes</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.type === 'system' ? (
                  <div className="text-center">
                    <span className="text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[85%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.type === 'user' ? 'bg-[#082c59]' : 'bg-green-600'
                      }`}>
                        {msg.type === 'user' ? (
                          <User className="h-4 w-4 text-white" />
                        ) : (
                          <Headphones className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div>
                        {msg.type === 'agent' && msg.sender_name && (
                          <p className="text-xs text-slate-500 mb-1">{msg.sender_name}</p>
                        )}
                        <div className={`p-3 rounded-2xl ${
                          msg.type === 'user' 
                            ? 'bg-[#082c59] text-white rounded-br-sm' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>

        {/* Input */}
        <div className="p-4 border-t bg-white rounded-b-lg">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 bg-slate-50"
              disabled={!connected}
            />
            <Button 
              onClick={sendMessage} 
              disabled={!connected || !input.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function Support() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [chatBotOpen, setChatBotOpen] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleQuestion = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedQuestions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/support/ticket', {
        subject: contactForm.subject,
        message: contactForm.message,
        user_email: contactForm.email,
        user_name: contactForm.name,
        priority: 'medium'
      });
      toast.success('Message sent successfully! We\'ll get back to you soon.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalateToLiveChat = () => {
    setChatBotOpen(false);
    setLiveChatOpen(true);
  };

  const handleOpenLiveChat = () => {
    setChatBotOpen(false);
    setLiveChatOpen(true);
  };

  const filteredFAQ = FAQ_DATA.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
           q.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Help & Support</h1>
        <p className="text-slate-600 dark:text-slate-400">Find answers or get in touch with our team</p>
      </div>

      {/* Quick Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href="tel:+237600000000"
          className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Phone className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Call Us</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">+237 6XX XXX XXX</p>
          </div>
        </a>
        <a
          href="mailto:support@oryno.cm"
          className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
        >
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Mail className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Email Us</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">support@oryno.cm</p>
          </div>
        </a>
        <button 
          onClick={handleOpenLiveChat}
          className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all text-left"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <MessageCircle className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Live Chat</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Talk to an agent</p>
          </div>
        </button>
      </div>

      {/* AI Assistant Card */}
      <Card className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Need help? Ask our AI Assistant!</h3>
                <p className="text-white/80 mt-1">Get instant answers to your questions 24/7</p>
              </div>
            </div>
            <Button 
              onClick={() => setChatBotOpen(true)}
              className="bg-white text-[#082c59] hover:bg-white/90"
            >
              Start Chat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search FAQ..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#082c59]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {filteredFAQ.map((category, catIndex) => (
            <div key={category.category} className="p-6">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{category.category}</h3>
              <div className="space-y-3">
                {category.questions.map((item, qIndex) => {
                  const key = `${catIndex}-${qIndex}`;
                  const isExpanded = expandedQuestions[key];
                  return (
                    <div key={qIndex} className="border border-slate-200 dark:border-slate-600 rounded-lg">
                      <button
                        onClick={() => toggleQuestion(catIndex, qIndex)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{item.q}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <p className="text-slate-600 dark:text-slate-300">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Send Us a Message</h2>
        <form onSubmit={handleContactSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Subject</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              value={contactForm.subject}
              onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Message</label>
            <textarea
              rows="4"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              required
            ></textarea>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[#082c59] hover:bg-[#0a3a75]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Message'
            )}
          </Button>
        </form>
      </div>

      {/* Chatbot */}
      <ChatBot 
        isOpen={chatBotOpen} 
        onClose={() => setChatBotOpen(false)}
        onEscalate={handleEscalateToLiveChat}
      />

      {/* Live Chat */}
      <LiveChat 
        isOpen={liveChatOpen} 
        onClose={() => setLiveChatOpen(false)}
      />

      {/* Floating Chat Button */}
      {!chatBotOpen && !liveChatOpen && (
        <button
          onClick={() => setChatBotOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#082c59] text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 hover:scale-110"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
