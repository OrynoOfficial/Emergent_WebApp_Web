import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  HelpCircle, MessageCircle, Search, Plus,
  ChevronDown, ChevronRight, ChevronLeft, Send, Bot, User, Clock,
  X, Loader2, FileText, AlertCircle, CheckCircle,
  Filter, Inbox, RefreshCw, MessageSquare, Calendar, Tag,
  LayoutGrid, List, ArrowUp
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import AIChatBot from '../components/AIChatBot';
import TicketReplyBox from '../components/TicketReplyBox';

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
  closed: { bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' }
};

// Service tag colors
const TAG_COLORS = {
  booking: 'bg-blue-100 text-blue-700 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  account: 'bg-violet-100 text-violet-700 border-violet-200',
  service: 'bg-orange-100 text-orange-700 border-orange-200',
  technical: 'bg-red-100 text-red-700 border-red-200',
  feedback: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  hotels: 'bg-rose-100 text-rose-700 border-rose-200',
  travel: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  restaurants: 'bg-amber-100 text-amber-700 border-amber-200',
  'car-rental': 'bg-teal-100 text-teal-700 border-teal-200',
  events: 'bg-purple-100 text-purple-700 border-purple-200',
  cinema: 'bg-pink-100 text-pink-700 border-pink-200',
  laundry: 'bg-sky-100 text-sky-700 border-sky-200',
  banquet: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  packages: 'bg-lime-100 text-lime-700 border-lime-200',
  'from-chat': 'bg-slate-100 text-slate-600 border-slate-200',
  'waiting-for-admin': 'bg-orange-100 text-orange-700 border-orange-200',
  'waiting-for-user': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'closed': 'bg-slate-200 text-slate-700 border-slate-300',
  're-opened': 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
const getTagColor = (tag) => TAG_COLORS[tag?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';

const ITEMS_PER_PAGE = 8;

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

// ========== Create Ticket Dialog ==========
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
      if (chatSessionId && chatMessages?.length > 0) {
        const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
        setFormData(prev => ({ ...prev, subject: lastUserMsg?.content?.slice(0, 100) || 'Support request from AI Chat', description: '' }));
      }
    }
  }, [isOpen, chatSessionId, chatMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject) { toast.error('Please enter a subject'); return; }
    setSubmitting(true);
    try {
      if (chatSessionId) {
        await onSubmit({ session_id: chatSessionId, subject: formData.subject, category: formData.category, product_involved: formData.product_involved || null, service_tag: formData.service_tag || null }, 'from-chat');
      } else {
        await onSubmit(formData, 'normal');
      }
      setFormData({ subject: '', category: 'booking', priority: 'medium', description: '', product_involved: '', service_tag: '' });
      onClose();
    } catch { toast.error('Failed to create ticket'); }
    finally { setSubmitting(false); }
  };

  const filteredProducts = formData.service_tag ? products.products?.filter(p => p.category === formData.service_tag) || [] : products.products || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50 border border-slate-200 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 bg-[#082c59]/10 rounded-lg flex items-center justify-center"><Plus className="h-4 w-4 text-[#082c59]" /></div>
            {chatSessionId ? 'Create Ticket from Chat' : 'New Support Ticket'}
          </DialogTitle>
          <DialogDescription>{chatSessionId ? 'Your conversation history will be attached.' : 'Describe your issue and our team will help you.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject *</label>
            <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="Brief description of your issue" className="bg-white/70" data-testid="ticket-subject-input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{TICKET_CATEGORIES.map(cat => (<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {!isCustomer && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Service</label>
              <Select value={formData.service_tag || 'none'} onValueChange={(v) => setFormData({ ...formData, service_tag: v === 'none' ? '' : v, product_involved: '' })}>
                <SelectTrigger className="bg-white/70"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="none">None</SelectItem>{(products.categories || []).map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Involved</label>
              <Select value={formData.product_involved || 'none'} onValueChange={(v) => setFormData({ ...formData, product_involved: v === 'none' ? '' : v })}>
                <SelectTrigger className="bg-white/70"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="none">None</SelectItem>{filteredProducts.map(p => (<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          {!chatSessionId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Please describe your issue in detail..." rows={4} className="bg-white/70" data-testid="ticket-description-input" required />
            </div>
          )}
          {chatSessionId && (
            <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Chat conversation history will be attached automatically</p>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2" data-testid="submit-ticket-btn">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Ticket Detail Dialog ==========
function TicketDetailDialog({ ticket, isOpen, onClose, onRefresh, isCustomer }) {
  if (!ticket) return null;

  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const CategoryIcon = category?.icon || HelpCircle;
  const visibleMessages = (ticket.messages || []).filter(m => !m.is_internal || !isCustomer);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl border-0 shadow-2xl rounded-2xl p-0 bg-gradient-to-b from-[#082c59]/[0.04] to-slate-100/80"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/60 bg-gradient-to-r from-[#082c59]/[0.06] to-slate-100/50 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/50">{ticket.ticket_number}</span>
                <Badge className={`${status.bg} ${status.text} border ${status.border} gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{ticket.status?.replace('_', ' ')}
                </Badge>
                {!isCustomer && <Badge className="bg-slate-100 text-slate-600 border border-slate-200">{ticket.priority}</Badge>}
              </div>
              <h3 className="font-semibold text-lg text-slate-900">{ticket.subject}</h3>
              <p className="text-sm text-slate-500 mt-0.5">Created {formatDateTime(ticket.created_at)}</p>
            </div>
          </div>
          {ticket.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ticket.tags.map((tag, i) => (
                <Badge key={i} className={`text-[10px] border ${getTagColor(tag)}`}><Tag className="h-2.5 w-2.5 mr-1" />{tag}</Badge>
              ))}
            </div>
          )}
          {ticket.product_involved && (
            <div className="mt-2"><Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-xs">Product: {ticket.product_involved}</Badge></div>
          )}
        </div>
        {/* Content - scrollable */}
        <div className="px-6 py-4 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="p-4 bg-white/50 rounded-xl border border-slate-200/40 mb-4 shadow-sm">
            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </div>
          {visibleMessages.length > 1 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-slate-600 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Conversation</h4>
              {visibleMessages.slice(1).map((msg, idx) => (
                msg.is_system ? (
                  <div key={idx} className="flex items-center gap-2 py-0.5 pl-8">
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${getTagColor(msg.tag?.toLowerCase().replace(/ /g, '-') || '')}`}>{msg.tag || msg.message}</span>
                  </div>
                ) : (
                <div key={idx} className={`p-3.5 rounded-xl ${msg.sender_type === 'agent' ? 'bg-[#082c59]/[0.06] border border-[#082c59]/10 ml-4' : 'bg-white/60 border border-slate-200/40 mr-4'} shadow-sm`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className={`text-[9px] ${msg.sender_type === 'agent' ? 'bg-[#082c59] text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {msg.sender_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs text-slate-700">{msg.sender_type === 'agent' ? 'Support Agent' : msg.sender_name || 'You'}</span>
                    <span className="text-[10px] text-slate-400 ml-auto">{formatDateTime(msg.created_at || msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700 pl-8">{msg.message || msg.content}</p>
                  {/* Attachments */}
                  {msg.attachments?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2 pl-8">
                      {msg.attachments.map((att, ai) => (
                        <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                )
              ))}
            </div>
          )}
        </div>
        {ticket.status !== 'closed' && (
          <TicketReplyBox ticketId={ticket.id} onReplySent={onRefresh} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ========== Ticket Card (Grid) ==========
function TicketCardGrid({ ticket, onClick }) {
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const CategoryIcon = category?.icon || HelpCircle;
  return (
    <div
      className="bg-gradient-to-br from-[#082c59]/[0.03] to-slate-100/60 rounded-xl border border-slate-200/50 p-4 hover:shadow-lg hover:border-[#082c59]/20 transition-all cursor-pointer group shadow-sm"
      onClick={onClick}
      data-testid={`ticket-card-${ticket.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${status.bg} border ${status.border} flex items-center justify-center`}>
          <CategoryIcon className={`h-4 w-4 ${status.text}`} />
        </div>
        <Badge className={`${status.bg} ${status.text} border ${status.border} text-[10px] gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{ticket.status?.replace('_', ' ')}
        </Badge>
      </div>
      <h3 className="font-semibold text-sm text-slate-800 group-hover:text-[#082c59] transition-colors line-clamp-2 mb-1.5">{ticket.subject}</h3>
      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{ticket.description}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {ticket.tags?.slice(0, 2).map((tag, i) => (
          <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(tag)}`}>{tag}</Badge>
        ))}
        {ticket.product_involved && <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5">{ticket.product_involved}</Badge>}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/40">
        <span className="font-mono">{ticket.ticket_number}</span>
        <span>{formatDate(ticket.created_at)}</span>
      </div>
    </div>
  );
}

// ========== Ticket Card (List) ==========
function TicketCardList({ ticket, onClick }) {
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const CategoryIcon = category?.icon || HelpCircle;
  return (
    <div
      className="bg-gradient-to-r from-[#082c59]/[0.03] via-slate-50/50 to-slate-100/40 rounded-xl border border-slate-200/50 p-4 hover:shadow-md hover:border-[#082c59]/20 transition-all cursor-pointer group shadow-sm"
      onClick={onClick}
      data-testid={`ticket-card-${ticket.id}`}
    >
      <div className="flex items-start gap-3.5">
        <div className={`w-10 h-10 rounded-xl ${status.bg} border ${status.border} flex items-center justify-center flex-shrink-0`}>
          <CategoryIcon className={`h-4.5 w-4.5 ${status.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-slate-800 group-hover:text-[#082c59] transition-colors truncate">{ticket.subject}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-400 font-mono">{ticket.ticket_number}</span>
                <span className="text-xs text-slate-300">|</span>
                <span className="text-xs text-slate-400">{formatDate(ticket.created_at)}</span>
              </div>
            </div>
            <Badge className={`${status.bg} ${status.text} border ${status.border} text-[10px] gap-1 flex-shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{ticket.status?.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-2 line-clamp-1">{ticket.description}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {ticket.tags?.slice(0, 3).map((tag, i) => (
              <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(tag)}`}>{tag}</Badge>
            ))}
            {ticket.product_involved && <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5">{ticket.product_involved}</Badge>}
            {ticket.messages?.length > 1 && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto"><MessageSquare className="h-3 w-3" /> {ticket.messages.length - 1} replies</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Main Support Page ==========
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
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const topRef = useRef(null);

  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isCustomer = user?.role === 'customer';

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/support-tickets/my');
      setTickets(response.data?.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  };

  const handleCreateTicket = async (formData, type) => {
    if (type === 'from-chat') {
      const response = await api.post('/support-tickets/from-chat', formData);
      const newTicket = response.data?.ticket;
      if (newTicket) setTickets(prev => [newTicket, ...prev]);
      toast.success(`Ticket ${newTicket?.ticket_number} created from chat!`);
    } else {
      const payload = { ...formData, source: 'web', priority: isCustomer ? 'medium' : formData.priority };
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
        ...prev, messages: [...(prev.messages || []), { sender_type: 'user', sender_name: user?.full_name || 'You', message, created_at: new Date().toISOString() }]
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

  const openChatBot = () => {
    setChatBotOpen(true);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !searchTerm || t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const ticketStats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open' || t.status === 'pending').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  }), [tickets]);

  return (
    <div className="space-y-5" data-testid="support-page" ref={topRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="support-title">Help & Support</h1>
          <p className="text-slate-500 text-sm mt-0.5">{isOperator ? 'Manage your inquiries and get assistance' : 'Get help or submit a support request'}</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={openChatBot} className="gap-2 bg-white shadow-sm hover:shadow-md border-slate-200" data-testid="open-ai-assistant-btn">
            <Bot className="h-4 w-4 text-[#082c59]" /> AI Assistant
          </Button>
          <Button onClick={() => { setChatSessionForTicket(null); setChatMessagesForTicket(null); setCreateDialogOpen(true); }} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2 shadow-md" data-testid="new-ticket-btn">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>
      </div>

      {/* Tabs — prominent toggle style */}
      <div className="flex items-center gap-3">
        <div className="inline-flex bg-[#082c59]/[0.06] p-1 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tickets' ? 'bg-[#082c59] text-white shadow-md' : 'text-slate-600 hover:text-[#082c59]'}`}
            data-testid="tickets-tab"
          >
            <FileText className="h-3.5 w-3.5 inline mr-2" />My Tickets
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'faq' ? 'bg-[#082c59] text-white shadow-md' : 'text-slate-600 hover:text-[#082c59]'}`}
            data-testid="faq-tab"
          >
            <HelpCircle className="h-3.5 w-3.5 inline mr-2" />FAQ
          </button>
        </div>

        {/* Compact stats — inline badges */}
        {activeTab === 'tickets' && (
          <div className="flex items-center gap-2 ml-auto text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />{ticketStats.open} Open
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{ticketStats.inProgress} In Progress
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{ticketStats.resolved} Resolved
            </span>
          </div>
        )}
      </div>

      {/* ========== TICKETS TAB ========== */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Filters + View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white/70 border-slate-200 shadow-sm" data-testid="search-tickets-input" />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-white/70 shadow-sm border-slate-200">
                  <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /><SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Status</SelectItem><SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchTickets} size="icon" className="bg-white/70 shadow-sm" data-testid="refresh-tickets-btn"><RefreshCw className="h-4 w-4" /></Button>
              <div className="flex bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/50">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#082c59]' : 'text-slate-400 hover:text-slate-600'}`} data-testid="list-view-btn"><List className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#082c59]' : 'text-slate-400 hover:text-slate-600'}`} data-testid="grid-view-btn"><LayoutGrid className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Tickets */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#082c59] mx-auto" /><p className="mt-3 text-sm text-slate-500">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-100/60 rounded-2xl border border-dashed border-slate-200 py-16 text-center shadow-sm">
              <Inbox className="h-14 w-14 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No tickets found</h3>
              <p className="text-sm text-slate-500 mb-5">{searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : "You haven't submitted any tickets yet"}</p>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#082c59] hover:bg-[#0a3a75]"><Plus className="h-4 w-4 mr-2" /> Create Your First Ticket</Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedTickets.map(ticket => (
                <TicketCardGrid key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedTickets.map(ticket => (
                <TicketCardList key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(p)}
                    className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-[#082c59] text-white' : ''}`}>{p}</Button>
                ))}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== FAQ TAB ========== */}
      {activeTab === 'faq' && (
        <div className="bg-gradient-to-b from-[#082c59]/[0.04] to-slate-100/60 rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-[#082c59]/[0.06]">
            <h3 className="font-semibold text-slate-800">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Quick answers to common questions</p>
          </div>
          <div className="divide-y divide-slate-200/40">
            {FAQ_DATA.map((section, secIdx) => (
              <div key={section.category} className="p-5">
                <h4 className="font-semibold text-sm text-[#082c59] mb-3">{section.category}</h4>
                <div className="space-y-2">
                  {section.questions.map((item, qIdx) => {
                    const key = `${secIdx}-${qIdx}`;
                    const isExpanded = expandedFAQ[key];
                    return (
                      <div key={qIdx} className="rounded-xl overflow-hidden border border-slate-200/40 bg-white/40 shadow-sm">
                        <button onClick={() => setExpandedFAQ(prev => ({ ...prev, [key]: !prev[key] }))} className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/60 transition-colors">
                          <span className="font-medium text-sm text-slate-700">{item.q}</span>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </button>
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 border-t border-slate-200/30">
                            <p className="text-sm text-slate-600 leading-relaxed pt-3">{item.a}</p>
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
      )}

      {/* Dialogs */}
      <CreateTicketDialog isOpen={createDialogOpen} onClose={() => { setCreateDialogOpen(false); setChatSessionForTicket(null); setChatMessagesForTicket(null); }} onSubmit={handleCreateTicket} chatSessionId={chatSessionForTicket} chatMessages={chatMessagesForTicket} isCustomer={isCustomer} />
      <TicketDetailDialog ticket={selectedTicket} isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} onRefresh={async () => {
        try { const r = await api.get(`/support-tickets/${selectedTicket.id}`); setSelectedTicket(r.data); fetchTickets(); } catch {}
      }} isCustomer={isCustomer} />

      {/* AI Chatbot */}
      <AIChatBot isOpen={chatBotOpen} onClose={() => setChatBotOpen(false)} onCreateTicket={handleChatCreateTicket} />

      {/* Floating Chat Button */}
      {!chatBotOpen && (
        <button onClick={openChatBot} className="fixed bottom-6 right-6 w-14 h-14 bg-[#082c59] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 hover:scale-105" data-testid="chat-fab-button">
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
