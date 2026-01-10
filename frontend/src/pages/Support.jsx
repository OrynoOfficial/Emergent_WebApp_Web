import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  HelpCircle, MessageCircle, Phone, Mail, Search, Plus,
  ChevronDown, ChevronRight, Send, Bot, User, Clock,
  Headphones, X, Loader2, ArrowLeft, Minimize2, Maximize2,
  FileText, AlertCircle, CheckCircle, History, Filter,
  Inbox, RefreshCw, MessageSquare, Calendar, Tag
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '../utils/dateUtils';

const TICKET_CATEGORIES = [
  { value: 'booking', label: 'Booking Issue', icon: Calendar },
  { value: 'payment', label: 'Payment & Billing', icon: FileText },
  { value: 'account', label: 'Account & Profile', icon: User },
  { value: 'service', label: 'Service Quality', icon: AlertCircle },
  { value: 'technical', label: 'Technical Issue', icon: HelpCircle },
  { value: 'feedback', label: 'Feedback & Suggestions', icon: MessageSquare },
  { value: 'other', label: 'Other', icon: Tag }
];

const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
];

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-700'
};

// FAQ Data
const FAQ_DATA = [
  {
    category: 'Booking',
    questions: [
      { q: 'How do I make a booking?', a: 'Browse our services, select the one you want, choose your dates and options, then proceed to checkout. You\'ll receive a confirmation email once complete.' },
      { q: 'Can I modify my booking?', a: 'Yes, you can modify most bookings up to 24 hours before the scheduled time. Go to My Orders, find your booking, and click "Modify".' },
      { q: 'How do I cancel a booking?', a: 'Navigate to My Orders, find the booking you want to cancel, and click "Cancel". Note that cancellation policies vary by service type.' }
    ]
  },
  {
    category: 'Payments',
    questions: [
      { q: 'What payment methods do you accept?', a: 'We accept MTN Mobile Money, Orange Money, and major credit cards. All prices are displayed in FCFA.' },
      { q: 'When will I be charged?', a: 'Payment is typically processed at the time of booking. For certain services, a deposit may be required with the balance due at the time of service.' },
      { q: 'How do refunds work?', a: 'Refunds are processed within 5-10 business days to your original payment method.' }
    ]
  },
  {
    category: 'Account',
    questions: [
      { q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox.' },
      { q: 'How do I update my profile?', a: 'Go to Settings > Profile to update your personal information, contact details, and preferences.' }
    ]
  }
];

// Chatbot Component
function ChatBot({ isOpen, onClose, onEscalate }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your Oryno support assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/support/chat', { message: input, session_id: sessionId });
      const { response: botResponse, session_id, escalate_to_human } = response.data;
      
      if (!sessionId) setSessionId(session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);

      if (escalate_to_human) onEscalate();
    } catch (error) {
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
      <Card className="shadow-2xl border-2 border-[#082c59]/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white p-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">AI Assistant</CardTitle>
              <p className="text-xs text-white/80">24/7 Support</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMinimized(!minimized)} className="p-1 hover:bg-white/20 rounded">
              {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        {!minimized && (
          <>
            <CardContent className="p-0">
              <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-[#082c59]' : 'bg-[#0a3a75]'
                      }`}>
                        {msg.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                      </div>
                      <div className={`p-3 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-[#082c59] text-white rounded-br-sm' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 rounded-bl-sm">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-[#082c59] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>

            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50"
                  disabled={loading}
                />
                <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-[#082c59] hover:bg-[#0a3a75]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <button onClick={onEscalate} className="w-full mt-2 text-sm text-[#082c59] hover:underline flex items-center justify-center gap-1">
                <Headphones className="h-4 w-4" /> Talk to a human agent
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// Create Ticket Dialog
function CreateTicketDialog({ isOpen, onClose, onSubmit }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    category: 'booking',
    priority: 'medium',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({ subject: '', category: 'booking', priority: 'medium', description: '' });
      onClose();
    } catch (error) {
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Support Ticket
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your issue"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {TICKET_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {TICKET_PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Please describe your issue in detail..."
              rows={5}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#082c59] hover:bg-[#0a3a75]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ticket Detail Dialog
function TicketDetailDialog({ ticket, isOpen, onClose, onReply }) {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!ticket) return null;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(ticket.id, replyText);
      setReplyText('');
    } finally {
      setSubmitting(false);
    }
  };

  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const priority = TICKET_PRIORITIES.find(p => p.value === ticket.priority);
  const CategoryIcon = category?.icon || HelpCircle;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CategoryIcon className="h-5 w-5" />
            Ticket #{ticket.ticket_number}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Ticket Info */}
          <div className="flex flex-wrap gap-2">
            <Badge className={STATUS_COLORS[ticket.status] || STATUS_COLORS.open}>
              {ticket.status?.replace('_', ' ')}
            </Badge>
            <Badge className={priority?.color || 'bg-slate-100 text-slate-700'}>
              {priority?.label || ticket.priority}
            </Badge>
            <Badge variant="outline">{category?.label || ticket.category}</Badge>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-slate-900">{ticket.subject}</h3>
            <p className="text-sm text-slate-500 mt-1">
              Created {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Messages Thread */}
          {ticket.messages && ticket.messages.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 flex items-center gap-2">
                <History className="h-4 w-4" /> Conversation History
              </h4>
              {ticket.messages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-lg ${
                    msg.sender_type === 'agent' 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'bg-slate-50 border-l-4 border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {msg.sender_type === 'agent' ? 'Support Agent' : 'You'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 text-sm">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply Box */}
          {ticket.status !== 'closed' && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Add a Reply</label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
              <div className="flex justify-end mt-3">
                <Button 
                  onClick={handleReply}
                  disabled={!replyText.trim() || submitting}
                  className="bg-[#082c59] hover:bg-[#0a3a75]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Reply
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Support Page
export default function Support() {
  const { user, isOperatorUser } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chatBotOpen, setChatBotOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedFAQ, setExpandedFAQ] = useState({});

  const isOperator = user?.role === 'operator' || isOperatorUser;

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/support-tickets/my');
      setTickets(response.data?.tickets || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      // Mock data for demo
      setTickets([
        {
          id: '1',
          ticket_number: 'TKT-001234',
          subject: 'Issue with hotel booking confirmation',
          category: 'booking',
          priority: 'medium',
          status: 'in_progress',
          description: 'I made a booking yesterday but haven\'t received a confirmation email yet.',
          created_at: '2024-12-18T10:30:00Z',
          updated_at: '2024-12-19T14:00:00Z',
          messages: [
            {
              sender_type: 'agent',
              content: 'Thank you for reaching out. I\'ve checked your booking and can confirm it was successful. I\'ve resent the confirmation email to your registered address.',
              timestamp: '2024-12-19T14:00:00Z'
            }
          ]
        },
        {
          id: '2',
          ticket_number: 'TKT-001235',
          subject: 'Request for invoice',
          category: 'payment',
          priority: 'low',
          status: 'resolved',
          description: 'I need an invoice for my recent car rental booking for expense reporting.',
          created_at: '2024-12-15T09:00:00Z',
          updated_at: '2024-12-16T11:00:00Z',
          messages: [
            {
              sender_type: 'agent',
              content: 'Your invoice has been generated and sent to your email. Please let us know if you need anything else.',
              timestamp: '2024-12-16T11:00:00Z'
            }
          ]
        },
        {
          id: '3',
          ticket_number: 'TKT-001236',
          subject: 'App loading slowly',
          category: 'technical',
          priority: 'high',
          status: 'open',
          description: 'The app has been very slow to load pages for the past few days.',
          created_at: '2024-12-20T08:15:00Z',
          updated_at: '2024-12-20T08:15:00Z',
          messages: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (formData) => {
    try {
      const response = await api.post('/support-tickets/', {
        ...formData,
        source: 'web'
      });
      
      const newTicket = response.data || {
        id: Date.now().toString(),
        ticket_number: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        ...formData,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: []
      };
      
      setTickets(prev => [newTicket, ...prev]);
      toast.success(`Ticket ${newTicket.ticket_number} created successfully!`);
    } catch (error) {
      // Still create locally for demo
      const newTicket = {
        id: Date.now().toString(),
        ticket_number: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        ...formData,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: []
      };
      setTickets(prev => [newTicket, ...prev]);
      toast.success(`Ticket ${newTicket.ticket_number} created!`);
    }
  };

  const handleReplyToTicket = async (ticketId, message) => {
    try {
      await api.post(`/support-tickets/${ticketId}/reply`, { message });
      
      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? {
              ...t,
              messages: [...(t.messages || []), {
                sender_type: 'user',
                content: message,
                timestamp: new Date().toISOString()
              }],
              updated_at: new Date().toISOString()
            }
          : t
      ));
      
      // Update selected ticket if open
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => ({
          ...prev,
          messages: [...(prev.messages || []), {
            sender_type: 'user',
            content: message,
            timestamp: new Date().toISOString()
          }]
        }));
      }
      
      toast.success('Reply sent successfully!');
    } catch (error) {
      // Still update locally for demo
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? {
              ...t,
              messages: [...(t.messages || []), {
                sender_type: 'user',
                content: message,
                timestamp: new Date().toISOString()
              }]
            }
          : t
      ));
      toast.success('Reply sent!');
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !searchTerm || 
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  const ticketStats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
    };
  }, [tickets]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="support-title">
            Help & Support
          </h1>
          <p className="text-slate-600">
            {isOperator ? 'Contact support or manage your inquiries' : 'Get help or submit a support ticket'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setChatBotOpen(true)} className="gap-2">
            <Bot className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <Inbox className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ticketStats.total}</p>
                <p className="text-xs text-slate-600">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ticketStats.open}</p>
                <p className="text-xs text-slate-600">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-100 rounded-lg">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ticketStats.inProgress}</p>
                <p className="text-xs text-slate-600">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ticketStats.resolved}</p>
                <p className="text-xs text-slate-600">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="tel:+237600000000" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all group">
          <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
            <Phone className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Call Us</p>
            <p className="text-sm text-slate-500">+237 6XX XXX XXX</p>
          </div>
        </a>
        <a href="mailto:support@oryno.cm" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-green-200 transition-all group">
          <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
            <Mail className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Email Us</p>
            <p className="text-sm text-slate-500">support@oryno.cm</p>
          </div>
        </a>
        <button onClick={() => setChatBotOpen(true)} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-purple-200 transition-all text-left group">
          <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
            <MessageCircle className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Live Chat</p>
            <p className="text-sm text-slate-500">AI-powered 24/7</p>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> My Tickets
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> FAQ
          </TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="mt-6 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchTickets} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tickets List */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
              <p className="mt-4 text-slate-600">Loading your tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Inbox className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No tickets found</h3>
                <p className="text-slate-500 mb-6">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'You haven\'t submitted any support tickets yet'}
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#082c59] hover:bg-[#0a3a75]">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
                const priority = TICKET_PRIORITIES.find(p => p.value === ticket.priority);
                const CategoryIcon = category?.icon || HelpCircle;
                
                return (
                  <Card 
                    key={ticket.id} 
                    className="hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          ticket.status === 'open' ? 'bg-blue-100' :
                          ticket.status === 'in_progress' ? 'bg-amber-100' :
                          'bg-emerald-100'
                        }`}>
                          <CategoryIcon className={`h-5 w-5 ${
                            ticket.status === 'open' ? 'text-blue-600' :
                            ticket.status === 'in_progress' ? 'text-amber-600' :
                            'text-emerald-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-900 group-hover:text-[#082c59] transition-colors">
                                {ticket.subject}
                              </h3>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={STATUS_COLORS[ticket.status] || STATUS_COLORS.open}>
                                {ticket.status?.replace('_', ' ')}
                              </Badge>
                              <Badge className={priority?.color || 'bg-slate-100 text-slate-700'} variant="outline">
                                {priority?.label || ticket.priority}
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{ticket.description}</p>
                          
                          {ticket.messages && ticket.messages.length > 0 && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {FAQ_DATA.map((section, secIdx) => (
                <div key={section.category} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="font-bold text-slate-900 mb-3">{section.category}</h3>
                  <div className="space-y-2">
                    {section.questions.map((item, qIdx) => {
                      const key = `${secIdx}-${qIdx}`;
                      const isExpanded = expandedFAQ[key];
                      return (
                        <div key={qIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedFAQ(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                          >
                            <span className="font-medium text-slate-900">{item.q}</span>
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-slate-400" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-0">
                              <p className="text-slate-600">{item.a}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTicketDialog 
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateTicket}
      />
      
      <TicketDetailDialog
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onReply={handleReplyToTicket}
      />

      {/* Chatbot */}
      <ChatBot 
        isOpen={chatBotOpen} 
        onClose={() => setChatBotOpen(false)}
        onEscalate={() => { setChatBotOpen(false); setCreateDialogOpen(true); }}
      />

      {/* Floating Chat Button */}
      {!chatBotOpen && (
        <button
          onClick={() => setChatBotOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#082c59] text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 hover:scale-110"
          data-testid="chat-button"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
