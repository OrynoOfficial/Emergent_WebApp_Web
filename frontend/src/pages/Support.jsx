import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  HelpCircle, MessageCircle, Phone, Mail, Search, Plus,
  ChevronDown, ChevronRight, Send, Bot, User, Clock,
  Headphones, X, Loader2, FileText, AlertCircle, CheckCircle,
  Filter, Inbox, RefreshCw, MessageSquare, Calendar, Tag,
  Sparkles, ExternalLink, ArrowRight
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import AIChatBot from '../components/AIChatBot';

const TICKET_CATEGORIES = [
  { value: 'booking', label: 'Booking Issue', icon: Calendar },
  { value: 'payment', label: 'Payment & Billing', icon: FileText },
  { value: 'account', label: 'Account & Profile', icon: User },
  { value: 'service', label: 'Service Quality', icon: AlertCircle },
  { value: 'technical', label: 'Technical Issue', icon: HelpCircle },
  { value: 'feedback', label: 'Feedback & Suggestions', icon: MessageSquare },
  { value: 'other', label: 'Other', icon: Tag }
];

const STATUS_CONFIG = {
  open: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  pending: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  closed: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' }
};

const FAQ_DATA = [
  {
    category: 'Booking',
    questions: [
      { q: 'How do I make a booking?', a: 'Browse our services, select the one you want, choose your dates and options, then proceed to checkout.' },
      { q: 'Can I modify my booking?', a: 'Yes, you can modify most bookings up to 24 hours before the scheduled time from My Orders.' },
      { q: 'How do I cancel a booking?', a: 'Navigate to My Orders, find the booking, and click "Cancel". Cancellation policies vary by service.' }
    ]
  },
  {
    category: 'Payments',
    questions: [
      { q: 'What payment methods do you accept?', a: 'We accept MTN Mobile Money, Orange Money, and major credit cards. All prices are in FCFA.' },
      { q: 'How do refunds work?', a: 'Refunds are processed within 5-10 business days to your original payment method.' }
    ]
  },
  {
    category: 'Account',
    questions: [
      { q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page and follow the instructions sent to your inbox.' },
      { q: 'How do I update my profile?', a: 'Go to Settings > Profile to update your personal information and preferences.' }
    ]
  }
];

// Create Ticket Dialog
function CreateTicketDialog({ isOpen, onClose, onSubmit, chatSessionId, chatMessages, isCustomer }) {
  const [formData, setFormData] = useState({
    subject: '', category: 'booking', priority: 'medium', description: '',
    product_involved: '', service_tag: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState({ categories: [], products: [] });

  useEffect(() => {
    if (isOpen) {
      api.get('/support-tickets/products').then(r => setProducts(r.data)).catch(() => {});
      // If from chat, pre-populate
      if (chatSessionId && chatMessages?.length > 0) {
        const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
        setFormData(prev => ({
          ...prev,
          subject: lastUserMsg?.content?.slice(0, 100) || 'Support request from AI Chat',
          description: ''
        }));
      }
    }
  }, [isOpen, chatSessionId, chatMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject) { toast.error('Please enter a subject'); return; }
    setSubmitting(true);
    try {
      if (chatSessionId) {
        await onSubmit({
          session_id: chatSessionId,
          subject: formData.subject,
          category: formData.category,
          product_involved: formData.product_involved || null,
          service_tag: formData.service_tag || null
        }, 'from-chat');
      } else {
        await onSubmit(formData, 'normal');
      }
      setFormData({ subject: '', category: 'booking', priority: 'medium', description: '', product_involved: '', service_tag: '' });
      onClose();
    } catch { toast.error('Failed to create ticket'); }
    finally { setSubmitting(false); }
  };

  const filteredProducts = formData.service_tag
    ? products.products?.filter(p => p.category === formData.service_tag) || []
    : products.products || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white border-0 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 bg-[#082c59]/10 rounded-lg flex items-center justify-center">
              <Plus className="h-4 w-4 text-[#082c59]" />
            </div>
            {chatSessionId ? 'Create Ticket from Chat' : 'New Support Ticket'}
          </DialogTitle>
          <DialogDescription>
            {chatSessionId ? 'Your conversation history will be attached to this ticket.' : 'Describe your issue and our team will help you.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject *</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your issue"
              className="bg-slate-50/50"
              data-testid="ticket-subject-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-slate-50/50"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {TICKET_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isCustomer && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="bg-slate-50/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Product Involved */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Service</label>
              <Select value={formData.service_tag || 'none'} onValueChange={(v) => setFormData({ ...formData, service_tag: v === 'none' ? '' : v, product_involved: '' })}>
                <SelectTrigger className="bg-slate-50/50"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">None</SelectItem>
                  {(products.categories || []).map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Involved</label>
              <Select value={formData.product_involved || 'none'} onValueChange={(v) => setFormData({ ...formData, product_involved: v === 'none' ? '' : v })}>
                <SelectTrigger className="bg-slate-50/50"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">None</SelectItem>
                  {filteredProducts.map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!chatSessionId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please describe your issue in detail..."
                rows={4}
                className="bg-slate-50/50"
                data-testid="ticket-description-input"
                required
              />
            </div>
          )}

          {chatSessionId && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Chat conversation history will be attached automatically
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2" data-testid="submit-ticket-btn">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ticket Detail Dialog (Customer/Operator view)
function TicketDetailDialog({ ticket, isOpen, onClose, onReply, isCustomer }) {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!ticket) return null;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(ticket.id, replyText);
      setReplyText('');
    } finally { setSubmitting(false); }
  };

  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const CategoryIcon = category?.icon || HelpCircle;

  // Filter out internal messages for customers
  const visibleMessages = (ticket.messages || []).filter(m => !m.is_internal || !isCustomer);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-hidden flex flex-col border-0 shadow-2xl rounded-2xl p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{ticket.ticket_number}</span>
                <Badge className={`${status.bg} ${status.text} border ${status.border} gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {ticket.status?.replace('_', ' ')}
                </Badge>
                {!isCustomer && (
                  <Badge className="bg-slate-100 text-slate-600 border border-slate-200">{ticket.priority}</Badge>
                )}
              </div>
              <h3 className="font-semibold text-lg text-slate-900">{ticket.subject}</h3>
              <p className="text-sm text-slate-500 mt-0.5">Created {formatDateTime(ticket.created_at)}</p>
            </div>
          </div>
          {/* Tags */}
          {ticket.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ticket.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="bg-white text-xs font-normal">
                  <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          )}
          {ticket.product_involved && (
            <div className="mt-2">
              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-xs">
                Product: {ticket.product_involved}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {/* Description */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 mb-4">
            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </div>

          {/* Messages */}
          {visibleMessages.length > 1 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-slate-600 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversation
              </h4>
              {visibleMessages.slice(1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl ${
                    msg.sender_type === 'agent'
                      ? 'bg-[#082c59]/5 border border-[#082c59]/10 ml-4'
                      : 'bg-slate-50 border border-slate-100 mr-4'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className={`text-[9px] ${msg.sender_type === 'agent' ? 'bg-[#082c59] text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {msg.sender_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs text-slate-700">
                      {msg.sender_type === 'agent' ? 'Support Agent' : msg.sender_name || 'You'}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">{formatDateTime(msg.created_at || msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700 pl-8">{msg.message || msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Reply */}
        {ticket.status !== 'closed' && (
          <div className="px-6 py-4 border-t bg-white/80">
            <div className="flex gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="flex-1 resize-none bg-slate-50/50"
              />
              <Button
                onClick={handleReply}
                disabled={!replyText.trim() || submitting}
                className="bg-[#082c59] hover:bg-[#0a3a75] self-end"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
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
  const [chatSessionForTicket, setChatSessionForTicket] = useState(null);
  const [chatMessagesForTicket, setChatMessagesForTicket] = useState(null);

  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isCustomer = user?.role === 'customer';

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/support-tickets/my');
      setTickets(response.data?.tickets || []);
    } catch {
      setTickets([]);
    } finally { setLoading(false); }
  };

  const handleCreateTicket = async (formData, type) => {
    if (type === 'from-chat') {
      const response = await api.post('/support-tickets/from-chat', formData);
      const newTicket = response.data?.ticket;
      if (newTicket) setTickets(prev => [newTicket, ...prev]);
      toast.success(`Ticket ${newTicket?.ticket_number} created from chat!`);
    } else {
      const payload = {
        ...formData,
        source: 'web',
        priority: isCustomer ? 'medium' : formData.priority
      };
      const response = await api.post('/support-tickets/', payload);
      const newTicket = response.data?.ticket;
      if (newTicket) setTickets(prev => [newTicket, ...prev]);
      toast.success(`Ticket ${newTicket?.ticket_number} created!`);
    }
    setChatSessionForTicket(null);
    setChatMessagesForTicket(null);
  };

  const handleReplyToTicket = async (ticketId, message) => {
    await api.post(`/support-tickets/${ticketId}/reply`, { message });
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? { ...t, messages: [...(t.messages || []), { sender_type: 'user', message, created_at: new Date().toISOString() }], updated_at: new Date().toISOString() }
        : t
    ));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => ({
        ...prev,
        messages: [...(prev.messages || []), { sender_type: 'user', sender_name: user?.full_name || 'You', message, created_at: new Date().toISOString() }]
      }));
    }
    toast.success('Reply sent!');
  };

  const handleChatCreateTicket = (sessionId, messages) => {
    setChatSessionForTicket(sessionId);
    setChatMessagesForTicket(messages);
    setChatBotOpen(false);
    setCreateDialogOpen(true);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !searchTerm ||
        t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  const ticketStats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open' || t.status === 'pending').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  }), [tickets]);

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="support-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="support-title">Help & Support</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isOperator ? 'Manage your inquiries and get assistance' : 'Get help or submit a support request'}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            onClick={() => setChatBotOpen(true)}
            className="gap-2 bg-white shadow-sm hover:shadow-md border-slate-200"
            data-testid="open-ai-assistant-btn"
          >
            <Bot className="h-4 w-4 text-[#082c59]" />
            AI Assistant
          </Button>
          <Button
            onClick={() => { setChatSessionForTicket(null); setChatMessagesForTicket(null); setCreateDialogOpen(true); }}
            className="bg-[#082c59] hover:bg-[#0a3a75] gap-2 shadow-md"
            data-testid="new-ticket-btn"
          >
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: ticketStats.total, icon: Inbox, bg: 'from-slate-50 to-slate-100/50', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
          { label: 'Open', value: ticketStats.open, icon: AlertCircle, bg: 'from-sky-50 to-sky-100/30', iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
          { label: 'In Progress', value: ticketStats.inProgress, icon: Clock, bg: 'from-amber-50 to-amber-100/30', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
          { label: 'Resolved', value: ticketStats.resolved, icon: CheckCircle, bg: 'from-emerald-50 to-emerald-100/30', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.bg} rounded-xl p-4 border border-white/50 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 ${stat.iconBg} rounded-lg`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a href="tel:+237600000000" className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all group">
          <div className="p-2.5 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
            <Phone className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-800">Call Us</p>
            <p className="text-xs text-slate-500">+237 6XX XXX XXX</p>
          </div>
        </a>
        <a href="mailto:support@oryno.cm" className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all group">
          <div className="p-2.5 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
            <Mail className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-800">Email Us</p>
            <p className="text-xs text-slate-500">support@oryno.cm</p>
          </div>
        </a>
        <button onClick={() => setChatBotOpen(true)} className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all text-left group">
          <div className="p-2.5 bg-violet-50 rounded-lg group-hover:bg-violet-100 transition-colors">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-800">AI Chat</p>
            <p className="text-xs text-slate-500">24/7 Instant Help</p>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs bg-slate-100/80 p-1 rounded-xl">
          <TabsTrigger value="tickets" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
            <FileText className="h-3.5 w-3.5" /> My Tickets
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
            <HelpCircle className="h-3.5 w-3.5" /> FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-5 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-slate-200 shadow-sm"
                data-testid="search-tickets-input"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-white shadow-sm border-slate-200">
                  <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
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
              <Button variant="outline" onClick={fetchTickets} size="icon" className="bg-white shadow-sm" data-testid="refresh-tickets-btn">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#082c59] mx-auto" />
              <p className="mt-3 text-sm text-slate-500">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center shadow-sm">
              <Inbox className="h-14 w-14 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No tickets found</h3>
              <p className="text-sm text-slate-500 mb-5">
                {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : "You haven't submitted any tickets yet"}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#082c59] hover:bg-[#0a3a75]">
                <Plus className="h-4 w-4 mr-2" /> Create Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTickets.map((ticket) => {
                const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
                const CategoryIcon = category?.icon || HelpCircle;
                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

                return (
                  <div
                    key={ticket.id}
                    className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group"
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`ticket-card-${ticket.id}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl ${status.bg} border ${status.border} flex items-center justify-center flex-shrink-0`}>
                        <CategoryIcon className={`h-4.5 w-4.5 ${status.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-slate-800 group-hover:text-[#082c59] transition-colors truncate">
                              {ticket.subject}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-slate-400 font-mono">{ticket.ticket_number}</span>
                              <span className="text-xs text-slate-300">|</span>
                              <span className="text-xs text-slate-400">{formatDate(ticket.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge className={`${status.bg} ${status.text} border ${status.border} text-[10px] gap-1`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {ticket.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-1">{ticket.description}</p>
                        {/* Tags */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {ticket.tags?.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] bg-slate-50 border-slate-100 text-slate-500 h-5">
                              {tag}
                            </Badge>
                          ))}
                          {ticket.product_involved && (
                            <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5">
                              {ticket.product_involved}
                            </Badge>
                          )}
                          {ticket.messages?.length > 1 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto">
                              <MessageSquare className="h-3 w-3" /> {ticket.messages.length - 1} replies
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="mt-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Frequently Asked Questions</h3>
              <p className="text-xs text-slate-500 mt-0.5">Quick answers to common questions</p>
            </div>
            <div className="divide-y divide-slate-100">
              {FAQ_DATA.map((section, secIdx) => (
                <div key={section.category} className="p-5">
                  <h4 className="font-semibold text-sm text-[#082c59] mb-3">{section.category}</h4>
                  <div className="space-y-2">
                    {section.questions.map((item, qIdx) => {
                      const key = `${secIdx}-${qIdx}`;
                      const isExpanded = expandedFAQ[key];
                      return (
                        <div key={qIdx} className="rounded-xl overflow-hidden border border-slate-100">
                          <button
                            onClick={() => setExpandedFAQ(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50/50 transition-colors"
                          >
                            <span className="font-medium text-sm text-slate-700">{item.q}</span>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </button>
                          {isExpanded && (
                            <div className="px-3.5 pb-3.5">
                              <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
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
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTicketDialog
        isOpen={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setChatSessionForTicket(null); setChatMessagesForTicket(null); }}
        onSubmit={handleCreateTicket}
        chatSessionId={chatSessionForTicket}
        chatMessages={chatMessagesForTicket}
        isCustomer={isCustomer}
      />

      <TicketDetailDialog
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onReply={handleReplyToTicket}
        isCustomer={isCustomer}
      />

      {/* AI Chatbot (full-screen overlay) */}
      <AIChatBot
        isOpen={chatBotOpen}
        onClose={() => setChatBotOpen(false)}
        onCreateTicket={handleChatCreateTicket}
      />

      {/* Floating Chat Button */}
      {!chatBotOpen && (
        <button
          onClick={() => setChatBotOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#082c59] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 hover:scale-105"
          data-testid="chat-fab-button"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
