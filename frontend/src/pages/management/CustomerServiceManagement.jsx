import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { HeadphonesIcon, MessageSquare, Clock, CheckCircle, AlertCircle, User, Search, Filter, Send } from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const TICKET_CATEGORIES = ['booking', 'payment', 'refund', 'technical', 'complaint', 'inquiry', 'other'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function CustomerServiceManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      setTickets([
        {
          id: '1',
          ticket_number: 'TKT-001',
          subject: 'Unable to complete booking',
          category: 'booking',
          priority: 'high',
          status: 'open',
          customer_name: 'Jean Dupont',
          customer_email: 'jean@example.com',
          created_at: '2024-12-20T10:30:00Z',
          messages: [
            { id: '1', sender: 'customer', text: 'I tried to book a bus ticket but the payment failed.', timestamp: '2024-12-20T10:30:00Z' },
            { id: '2', sender: 'agent', text: 'I apologize for the inconvenience. Can you provide your booking reference?', timestamp: '2024-12-20T10:45:00Z' }
          ]
        },
        {
          id: '2',
          ticket_number: 'TKT-002',
          subject: 'Refund request',
          category: 'refund',
          priority: 'medium',
          status: 'pending',
          customer_name: 'Marie Claire',
          customer_email: 'marie@example.com',
          created_at: '2024-12-19T14:00:00Z',
          messages: []
        },
        {
          id: '3',
          ticket_number: 'TKT-003',
          subject: 'Hotel booking question',
          category: 'inquiry',
          priority: 'low',
          status: 'resolved',
          customer_name: 'Pierre Martin',
          customer_email: 'pierre@example.com',
          created_at: '2024-12-18T09:00:00Z',
          messages: []
        }
      ]);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: newStatus }));
      }
      toast.success('Ticket status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      const newMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: replyText,
        timestamp: new Date().toISOString()
      };
      setTickets(prev => prev.map(t =>
        t.id === selectedTicket.id
          ? { ...t, messages: [...t.messages, newMessage] }
          : t
      ));
      setSelectedTicket(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));
      setReplyText('');
      toast.success('Reply sent');
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={colors[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[priority] || 'bg-gray-100'}>{priority}</Badge>;
  };

  const filteredTickets = tickets.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.category && t.category !== filter.category) return false;
    if (searchTerm && !t.subject.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !t.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  return (
    <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#082c59]">Customer Service</h1>
            <p className="text-gray-600">Manage support tickets and customer inquiries</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg"><MessageSquare className="text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-gray-600 text-sm">Total Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg"><AlertCircle className="text-yellow-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-gray-600 text-sm">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg"><Clock className="text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-gray-600 text-sm">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                  <p className="text-gray-600 text-sm">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter.status || 'all'} onValueChange={v => setFilter(p => ({ ...p, status: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filter.priority || 'all'} onValueChange={v => setFilter(p => ({ ...p, priority: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Priority</SelectItem>
                  {TICKET_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filter.category || 'all'} onValueChange={v => setFilter(p => ({ ...p, category: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Categories</SelectItem>
                  {TICKET_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List and Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No tickets found.</div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedTicket?.id === ticket.id ? 'border-[#082c59] bg-blue-50' : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{ticket.subject}</div>
                          <div className="text-sm text-gray-500">{ticket.ticket_number} • {ticket.customer_name}</div>
                        </div>
                        <div className="flex gap-2">
                          {getPriorityBadge(ticket.priority)}
                          {getStatusBadge(ticket.status)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span className="capitalize">{ticket.category}</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ticket Detail */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTicket ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-500">Subject</Label>
                    <p className="font-medium">{selectedTicket.subject}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500">Customer</Label>
                      <p>{selectedTicket.customer_name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Email</Label>
                      <p className="text-sm">{selectedTicket.customer_email}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-500">Status</Label>
                    <Select value={selectedTicket.status} onValueChange={v => handleStatusChange(selectedTicket.id, v)}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Messages */}
                  <div className="border-t pt-4">
                    <Label className="text-gray-500 mb-2 block">Conversation</Label>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {selectedTicket.messages.map(msg => (
                        <div key={msg.id} className={`p-3 rounded-lg ${msg.sender === 'agent' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}>
                          <div className="text-xs text-gray-500 mb-1">
                            {msg.sender === 'agent' ? 'Support Agent' : selectedTicket.customer_name}
                          </div>
                          <p className="text-sm">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reply */}
                  <div className="border-t pt-4">
                    <Label className="text-gray-500">Reply</Label>
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your response..."
                      className="mt-1"
                      rows={3}
                    />
                    <Button onClick={handleSendReply} className="mt-2 bg-[#082c59]" disabled={!replyText.trim()}>
                      <Send className="w-4 h-4 mr-2" /> Send Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a ticket to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
