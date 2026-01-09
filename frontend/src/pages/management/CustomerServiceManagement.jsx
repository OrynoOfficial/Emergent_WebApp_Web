import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  HeadphonesIcon, MessageSquare, Clock, CheckCircle, AlertCircle, User, Search, 
  Filter, Send, Plus, RefreshCw, MoreHorizontal,
  AlertTriangle, Inbox, Users, UserPlus, Calendar, Tag, ArrowUpDown, X,
  SlidersHorizontal, Eye, Trash2, Mail, Phone, Building2, FileText, Check,
  Activity, Zap, BarChart2, PieChart, ExternalLink,
  Briefcase, UserCheck, Timer, MessageCircle, Archive, Flag, UserMinus, Shield
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';

// Import extracted components and constants
import { 
  TICKET_CATEGORIES, 
  TICKET_PRIORITIES, 
  TICKET_STATUSES, 
  USER_TYPES, 
  CHART_COLORS, 
  ITEMS_PER_PAGE,
  getStatusConfig,
  getPriorityConfig,
  getCategoryIcon,
  getTimeAgo
} from '@/components/customer-service/constants';
import { StatsCard } from '@/components/customer-service/StatsCard';
import { Pagination } from '@/components/customer-service/Pagination';

// Ticket Card Component with enhanced styling
const TicketCard = ({ ticket, isSelected, onSelect, onView, onAssign, teamMembers }) => {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const timeAgo = getTimeAgo(ticket.created_at);

  // Get background gradient based on status
  const getStatusBackground = () => {
    switch (ticket.status) {
      case 'open':
        return 'bg-gradient-to-r from-blue-50 via-white to-white border-l-4 border-l-blue-500';
      case 'pending':
        return 'bg-gradient-to-r from-amber-50 via-white to-white border-l-4 border-l-amber-500';
      case 'in_progress':
        return 'bg-gradient-to-r from-purple-50 via-white to-white border-l-4 border-l-purple-500';
      case 'resolved':
        return 'bg-gradient-to-r from-green-50 via-white to-white border-l-4 border-l-green-500';
      case 'closed':
        return 'bg-gradient-to-r from-slate-50 via-white to-white border-l-4 border-l-slate-400';
      default:
        return 'bg-white border-l-4 border-l-slate-300';
    }
  };

  return (
    <div
      className={`p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg ${getStatusBackground()} ${
        isSelected ? 'ring-2 ring-[#082c59] shadow-lg' : 'shadow-sm hover:shadow-md'
      }`}
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => { onSelect(ticket.id, checked); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] px-1.5 py-0 h-5 shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`}></span>
                  {ticket.priority}
                </Badge>
                {ticket.user_type === 'operator' && (
                  <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0 h-5 shadow-sm">
                    <Building2 className="w-3 h-3 mr-1" />Operator
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 truncate">{ticket.subject}</h3>
              <p className="text-sm text-slate-500 truncate mt-0.5 line-clamp-1">{ticket.description}</p>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.text} text-xs flex items-center gap-1 shrink-0 shadow-sm px-2.5 py-1`}>
              {statusConfig.icon}
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100/80">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium">{ticket.customer_name}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                {getCategoryIcon(ticket.category)}
                <span className="capitalize">{ticket.category}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeAgo}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {ticket.assigned_to_name ? (
                <div className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-slate-100 to-slate-50 px-2.5 py-1.5 rounded-full shadow-sm">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-[#082c59] text-white">
                      {ticket.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-700 font-medium">{ticket.assigned_to_name}</span>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs text-slate-500 hover:text-[#082c59] hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); onAssign(ticket); }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Assign
                </Button>
              )}
              {ticket.response_count > 0 && (
                <Badge variant="outline" className="text-xs h-6 bg-white shadow-sm">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {ticket.response_count}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-9 w-9 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {start > 1 && (<><Button variant="ghost" size="sm" onClick={() => onPageChange(1)} className="h-9 w-9 p-0">1</Button>{start > 2 && <span className="px-1 text-slate-400">...</span>}</>)}
      {pages.map(page => (
        <Button key={page} variant={currentPage === page ? 'default' : 'ghost'} size="sm" onClick={() => onPageChange(page)} className={`h-9 w-9 p-0 ${currentPage === page ? 'bg-[#082c59]' : ''}`}>{page}</Button>
      ))}
      {end < totalPages && (<>{end < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}<Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)} className="h-9 w-9 p-0">{totalPages}</Button></>)}
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-9 w-9 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Helper function for time ago
function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Main Component
export default function CustomerServiceManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ticketSubTab, setTicketSubTab] = useState('open'); // open, in_progress, closed
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Selected ticket for detail view
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [ticketToAssign, setTicketToAssign] = useState(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  
  // Filters and Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    user_type: '',
    assigned_to: '',
    unassigned: false
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Reply state
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  
  // Assignment state
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Team management state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Get status filters based on sub-tab
  const getSubTabStatuses = useCallback(() => {
    switch (ticketSubTab) {
      case 'open':
        return ['open', 'pending'];
      case 'in_progress':
        return ['in_progress'];
      case 'closed':
        return ['resolved', 'closed'];
      default:
        return [];
    }
  }, [ticketSubTab]);

  // Load tickets
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Apply sub-tab status filter (multiple statuses)
      const subTabStatuses = getSubTabStatuses();
      if (subTabStatuses.length > 0 && !filters.status) {
        // If no manual status filter, use sub-tab statuses
        subTabStatuses.forEach(s => params.append('status', s));
      } else if (filters.status) {
        params.append('status', filters.status);
      }
      
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.category) params.append('category', filters.category);
      if (filters.user_type) params.append('user_type', filters.user_type);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
      if (filters.unassigned) params.append('unassigned', 'true');
      if (searchTerm) params.append('search', searchTerm);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      params.append('skip', String((currentPage - 1) * ITEMS_PER_PAGE));
      params.append('limit', String(ITEMS_PER_PAGE));
      
      const response = await api.get(`/support-tickets/?${params.toString()}`);
      setTickets(response.data.tickets || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, sortBy, sortOrder, currentPage, getSubTabStatuses]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await api.get('/support-tickets/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    try {
      const response = await api.get('/support-tickets/team-members');
      setTeamMembers(response.data.team_members || []);
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    loadStats();
    loadTeamMembers();
  }, [loadTickets, loadStats, loadTeamMembers]);

  // Filter change resets page
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  // Sub-tab change resets page and clears selection
  useEffect(() => {
    setCurrentPage(1);
    setSelectedTickets([]);
  }, [ticketSubTab]);

  // Handle ticket selection
  const handleSelectTicket = (ticketId, checked) => {
    setSelectedTickets(prev => 
      checked ? [...prev, ticketId] : prev.filter(id => id !== ticketId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectedTickets(checked ? tickets.map(t => t.id) : []);
  };

  // View ticket detail
  const handleViewTicket = async (ticket) => {
    try {
      const response = await api.get(`/support-tickets/${ticket.id}`);
      setSelectedTicket(response.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load ticket details');
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    
    setSendingReply(true);
    try {
      await api.post(`/support-tickets/${selectedTicket.id}/reply`, {
        message: replyText,
        is_internal: isInternalNote
      });
      
      // Reload ticket
      const response = await api.get(`/support-tickets/${selectedTicket.id}`);
      setSelectedTicket(response.data);
      setReplyText('');
      setIsInternalNote(false);
      toast.success(isInternalNote ? 'Internal note added' : 'Reply sent');
      loadTickets();
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Update ticket status
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    
    try {
      await api.put(`/support-tickets/${selectedTicket.id}`, { status: newStatus });
      setSelectedTicket(prev => ({ ...prev, status: newStatus }));
      toast.success('Status updated');
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Assign ticket
  const handleAssignTicket = async () => {
    if (!selectedAssignee || !ticketToAssign) return;
    
    const member = teamMembers.find(m => m.id === selectedAssignee);
    if (!member) return;
    
    try {
      await api.post(`/support-tickets/${ticketToAssign.id}/assign`, {
        assignee_id: member.id,
        assignee_name: member.name,
        notes: assignmentNotes
      });
      
      toast.success(`Ticket assigned to ${member.name}`);
      setShowAssignModal(false);
      setTicketToAssign(null);
      setSelectedAssignee('');
      setAssignmentNotes('');
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error('Failed to assign ticket');
    }
  };

  // Bulk assign
  const handleBulkAssign = async () => {
    if (!selectedAssignee || selectedTickets.length === 0) return;
    
    const member = teamMembers.find(m => m.id === selectedAssignee);
    if (!member) return;
    
    try {
      await api.post('/support-tickets/bulk-action', {
        ticket_ids: selectedTickets,
        action: 'assign',
        assignee_id: member.id,
        assignee_name: member.name
      });
      
      toast.success(`${selectedTickets.length} tickets assigned to ${member.name}`);
      setShowBulkAssignModal(false);
      setSelectedTickets([]);
      setSelectedAssignee('');
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error('Failed to assign tickets');
    }
  };

  // Bulk status update
  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedTickets.length === 0) return;
    
    try {
      await api.post('/support-tickets/bulk-action', {
        ticket_ids: selectedTickets,
        action: 'update_status',
        value: newStatus
      });
      
      toast.success(`${selectedTickets.length} tickets updated`);
      setSelectedTickets([]);
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error('Failed to update tickets');
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      user_type: '',
      assigned_to: '',
      unassigned: false
    });
    setSearchTerm('');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== false).length;

  // Load available members for adding to team
  const loadAvailableMembers = useCallback(async () => {
    try {
      const response = await api.get('/support-tickets/available-members');
      setAvailableMembers(response.data.available_members || []);
    } catch (error) {
      console.error('Failed to load available members:', error);
    }
  }, []);

  // Add team member
  const handleAddTeamMember = async (member) => {
    try {
      await api.post('/support-tickets/team-members', {
        user_id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        department: member.department,
        type: member.type
      });
      
      toast.success(`${member.name} added to support team`);
      loadTeamMembers();
      loadAvailableMembers();
    } catch (error) {
      toast.error('Failed to add team member');
    }
  };

  // Remove team member
  const handleRemoveTeamMember = async (member) => {
    if (member.is_auto) {
      toast.error('Cannot remove auto-added team members');
      return;
    }
    
    try {
      await api.delete(`/support-tickets/team-members/${member.id}`);
      toast.success(`${member.name} removed from support team`);
      loadTeamMembers();
      loadAvailableMembers();
    } catch (error) {
      toast.error('Failed to remove team member');
    }
  };

  // Load available members when modal opens
  useEffect(() => {
    if (showAddMemberModal) {
      loadAvailableMembers();
    }
  }, [showAddMemberModal, loadAvailableMembers]);

  // Prepare chart data
  const categoryChartData = stats ? Object.entries(stats.by_category || {}).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })) : [];
  const statusChartData = stats ? Object.entries(stats.by_status || {}).map(([name, value]) => ({ name: name.replace('_', ' ').charAt(0).toUpperCase() + name.replace('_', ' ').slice(1), value })) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#082c59]">Customer Service Center</h1>
            <p className="text-slate-600 mt-1">Manage support tickets, inquiries, and customer communications</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { loadTickets(); loadStats(); }} className="gap-2">
              <RefreshCw className="w-4 h-4" />Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md bg-white shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <BarChart2 className="h-4 w-4" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <Inbox className="h-4 w-4" />Tickets
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <Users className="h-4 w-4" />Team
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <StatsCard title="Total Tickets" value={stats?.total || 0} subtitle="All time" icon={<MessageSquare className="w-6 h-6" />} color="blue" />
              <StatsCard title="Open" value={stats?.by_status?.open || 0} subtitle="Needs attention" icon={<Inbox className="w-6 h-6" />} color="blue" />
              <StatsCard title="In Progress" value={stats?.by_status?.in_progress || 0} subtitle="Being worked on" icon={<Activity className="w-6 h-6" />} color="purple" />
              <StatsCard title="Unassigned" value={stats?.unassigned || 0} subtitle="Needs assignment" icon={<UserPlus className="w-6 h-6" />} color="amber" />
              <StatsCard title="Urgent" value={stats?.urgent || 0} subtitle="High priority" icon={<AlertTriangle className="w-6 h-6" />} color="red" />
              <StatsCard title="Resolved Today" value={stats?.today || 0} subtitle="This day" icon={<CheckCircle className="w-6 h-6" />} color="green" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PieChart className="w-5 h-5 text-[#082c59]" />Tickets by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart2 className="w-5 h-5 text-[#082c59]" />Tickets by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#082c59" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Workload */}
            {stats?.team_workload?.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-[#082c59]" />Team Workload
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.team_workload.map((member, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-[#082c59] text-white">
                            {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{member.count} tickets assigned</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-500 rounded-xl">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Customer Tickets</p>
                      <p className="text-3xl font-bold text-blue-800">{stats?.by_user_type?.customer || 0}</p>
                      <p className="text-blue-600/70 text-xs mt-1">From end users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-500 rounded-xl">
                      <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-indigo-600 text-sm font-medium">Operator Tickets</p>
                      <p className="text-3xl font-bold text-indigo-800">{stats?.by_user_type?.operator || 0}</p>
                      <p className="text-indigo-600/70 text-xs mt-1">From service operators</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="mt-6 space-y-4">
            {/* Sub-tabs for ticket categories */}
            <div className="bg-white rounded-xl shadow-sm p-1.5 inline-flex gap-1">
              <button
                onClick={() => setTicketSubTab('open')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  ticketSubTab === 'open'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Open
                <Badge className={`ml-1 ${ticketSubTab === 'open' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'} text-xs h-5 min-w-[20px] flex items-center justify-center`}>
                  {(stats?.by_status?.open || 0) + (stats?.by_status?.pending || 0)}
                </Badge>
              </button>
              <button
                onClick={() => setTicketSubTab('in_progress')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  ticketSubTab === 'in_progress'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-4 h-4" />
                In Progress
                <Badge className={`ml-1 ${ticketSubTab === 'in_progress' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'} text-xs h-5 min-w-[20px] flex items-center justify-center`}>
                  {stats?.by_status?.in_progress || 0}
                </Badge>
              </button>
              <button
                onClick={() => setTicketSubTab('closed')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  ticketSubTab === 'closed'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Closed
                <Badge className={`ml-1 ${ticketSubTab === 'closed' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'} text-xs h-5 min-w-[20px] flex items-center justify-center`}>
                  {(stats?.by_status?.resolved || 0) + (stats?.by_status?.closed || 0)}
                </Badge>
              </button>
            </div>

            {/* Search and Filters Bar */}
            <Card className="shadow-sm border-0 bg-gradient-to-r from-slate-50 to-white">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search tickets by subject, name, email, or ticket number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white border-slate-200 shadow-sm"
                    />
                  </div>
                  
                  {/* Filter Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={showFilters ? 'default' : 'outline'}
                      onClick={() => setShowFilters(!showFilters)}
                      className={`gap-2 shadow-sm ${showFilters ? 'bg-[#082c59]' : 'bg-white'}`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                      {activeFiltersCount > 0 && (
                        <Badge className="ml-1 bg-white text-[#082c59] h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                    
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40 bg-white shadow-sm">
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="created_at">Date Created</SelectItem>
                        <SelectItem value="updated_at">Last Updated</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button variant="outline" size="icon" onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </Button>
                  </div>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Status</Label>
                        <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Statuses</SelectItem>
                            {TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Priority</Label>
                        <Select value={filters.priority || 'all'} onValueChange={(v) => setFilters(p => ({ ...p, priority: v === 'all' ? '' : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Priorities</SelectItem>
                            {TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Category</Label>
                        <Select value={filters.category || 'all'} onValueChange={(v) => setFilters(p => ({ ...p, category: v === 'all' ? '' : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Categories</SelectItem>
                            {TICKET_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">User Type</Label>
                        <Select value={filters.user_type || 'all'} onValueChange={(v) => setFilters(p => ({ ...p, user_type: v === 'all' ? '' : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="customer">Customers</SelectItem>
                            <SelectItem value="operator">Operators</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Assigned To</Label>
                        <Select value={filters.assigned_to || 'all'} onValueChange={(v) => setFilters(p => ({ ...p, assigned_to: v === 'all' ? '' : v, unassigned: false }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Assignees</SelectItem>
                            {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={filters.unassigned} 
                            onCheckedChange={(checked) => setFilters(p => ({ ...p, unassigned: checked, assigned_to: '' }))}
                          />
                          <span className="text-sm text-slate-600">Unassigned only</span>
                        </label>
                      </div>
                    </div>
                    {activeFiltersCount > 0 && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                          <X className="w-4 h-4 mr-1" />Clear all filters
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedTickets.length > 0 && (
              <Card className="shadow-sm bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedTickets.length === tickets.length} onCheckedChange={handleSelectAll} />
                      <span className="text-sm font-medium text-blue-800">{selectedTickets.length} ticket(s) selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => setShowBulkAssignModal(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />Assign
                      </Button>
                      <Select onValueChange={handleBulkStatusUpdate}>
                        <SelectTrigger className="w-36 h-9 bg-white">
                          <SelectValue placeholder="Change Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedTickets([])}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tickets Count */}
            <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-3 rounded-lg">
              <p className="text-sm text-slate-600 font-medium">
                Showing <span className="text-[#082c59]">{tickets.length}</span> of <span className="text-[#082c59]">{total}</span> tickets
                <span className="text-slate-400 ml-2">
                  ({ticketSubTab === 'open' ? 'Open & Pending' : ticketSubTab === 'in_progress' ? 'In Progress' : 'Resolved & Closed'})
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedTickets.length === tickets.length && tickets.length > 0} onCheckedChange={handleSelectAll} />
                <span className="text-sm text-slate-500">Select all</span>
              </div>
            </div>

            {/* Tickets List */}
            {loading ? (
              <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                <RefreshCw className="w-8 h-8 animate-spin text-[#082c59]" />
              </div>
            ) : tickets.length === 0 ? (
              <Card className={`shadow-sm border-0 ${
                ticketSubTab === 'open' ? 'bg-gradient-to-br from-blue-50 to-white' :
                ticketSubTab === 'in_progress' ? 'bg-gradient-to-br from-purple-50 to-white' :
                'bg-gradient-to-br from-green-50 to-white'
              }`}>
                <CardContent className="py-16 text-center">
                  {ticketSubTab === 'open' ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <Inbox className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800">No open tickets</h3>
                      <p className="text-slate-500 mt-1">All caught up! No pending tickets waiting for attention.</p>
                    </>
                  ) : ticketSubTab === 'in_progress' ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                        <Activity className="w-8 h-8 text-purple-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800">No tickets in progress</h3>
                      <p className="text-slate-500 mt-1">No tickets are currently being worked on.</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800">No closed tickets</h3>
                      <p className="text-slate-500 mt-1">No tickets have been resolved or closed yet.</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    isSelected={selectedTickets.includes(ticket.id)}
                    onSelect={handleSelectTicket}
                    onView={() => handleViewTicket(ticket)}
                    onAssign={(t) => { setTicketToAssign(t); setShowAssignModal(true); }}
                    teamMembers={teamMembers}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-6 space-y-6">
            {/* Add Team Member Card */}
            <Card className="shadow-lg border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserPlus className="w-5 h-5 text-[#082c59]" />Add Team Member
                    </CardTitle>
                    <CardDescription className="mt-1">Add employees or users to your support team. Only team members can be assigned tickets.</CardDescription>
                  </div>
                  <Button onClick={() => setShowAddMemberModal(true)} className="bg-[#082c59] gap-2">
                    <Plus className="w-4 h-4" />Add Member
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Current Team Members */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#082c59]" />Support Team ({teamMembers.length})
                    </CardTitle>
                    <CardDescription>Team members who can be assigned tickets</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadTeamMembers} className="gap-2">
                    <RefreshCw className="w-4 h-4" />Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="font-medium text-lg mb-1">No team members yet</h3>
                    <p className="text-sm mb-4">Add employees or admins to handle support tickets</p>
                    <Button onClick={() => setShowAddMemberModal(true)} className="bg-[#082c59] gap-2">
                      <Plus className="w-4 h-4" />Add Your First Team Member
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamMembers.map((member, i) => (
                      <div key={i} className="group flex items-center gap-4 p-4 border rounded-xl hover:shadow-md transition-all bg-white relative">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-[#082c59] text-white text-lg">
                            {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{member.name}</p>
                          <p className="text-sm text-slate-500">{member.role}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {member.department}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${
                                member.type === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                member.type === 'employee' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <Shield className="w-3 h-3 mr-1" />{member.type}
                            </Badge>
                            {member.is_auto && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                Auto-added
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {member.email && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.href = `mailto:${member.email}`}>
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          {!member.is_auto && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveTeamMember(member)}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="shadow-sm bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900">About Team Members</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Tickets can only be assigned to members listed here. Add team members based on their roles - 
                      Admins and Super Admins have full access, while employees can handle tickets assigned to them.
                      Members marked as &quot;Auto-added&quot; are detected from system roles and cannot be removed from here.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Team Member Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#082c59]" />Add Team Member
            </DialogTitle>
            <DialogDescription>
              Select from available employees and users to add to your support team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Search Available Members */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search available members..."
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>

            {/* Available Members List */}
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {availableMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">No available members to add</p>
                  <p className="text-xs text-slate-400 mt-1">All eligible users are already in the team</p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableMembers
                    .filter(m => 
                      !memberSearchTerm || 
                      m.name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      m.email?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      m.role?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                    )
                    .map((member, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-4 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => handleAddTeamMember(member)}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-slate-200 text-slate-700">
                            {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
                            <Badge variant="outline" className="text-[10px]">{member.department}</Badge>
                          </div>
                        </div>
                        <Button size="sm" className="bg-[#082c59] h-8">
                          <Plus className="w-3 h-3 mr-1" />Add
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono text-slate-500">{selectedTicket?.ticket_number}</span>
              {selectedTicket && (
                <>
                  <Badge className={`${getPriorityConfig(selectedTicket.priority).bg} ${getPriorityConfig(selectedTicket.priority).text}`}>
                    {selectedTicket.priority}
                  </Badge>
                  <Badge className={`${getStatusConfig(selectedTicket.status).bg} ${getStatusConfig(selectedTicket.status).text}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 pr-2">
                {/* Ticket Info */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedTicket.subject}</h3>
                  <p className="text-slate-600 mt-1">{selectedTicket.description}</p>
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="text-xs text-slate-500">Customer</Label>
                    <p className="font-medium">{selectedTicket.customer_name}</p>
                    <p className="text-xs text-slate-500">{selectedTicket.customer_email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Category</Label>
                    <p className="font-medium capitalize">{selectedTicket.category}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">User Type</Label>
                    <Badge variant="outline" className="capitalize">{selectedTicket.user_type}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Assigned To</Label>
                    <p className="font-medium">{selectedTicket.assigned_to_name || 'Unassigned'}</p>
                  </div>
                </div>

                {/* Status Update */}
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">Update Status:</Label>
                  <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => { setTicketToAssign(selectedTicket); setShowAssignModal(true); }}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {selectedTicket.assigned_to_name ? 'Reassign' : 'Assign'}
                  </Button>
                </div>

                {/* Conversation */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Conversation</Label>
                  <ScrollArea className="h-64 border rounded-lg p-4 bg-slate-50">
                    <div className="space-y-4">
                      {selectedTicket.messages?.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            msg.is_internal 
                              ? 'bg-amber-50 border border-amber-200' 
                              : msg.sender_type === 'agent' 
                                ? 'bg-[#082c59] text-white' 
                                : 'bg-white border'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${msg.sender_type === 'agent' && !msg.is_internal ? 'text-white/80' : 'text-slate-500'}`}>
                                {msg.sender_name}
                              </span>
                              {msg.is_internal && (
                                <Badge variant="outline" className="text-[10px] h-4 bg-amber-100 border-amber-300 text-amber-700">
                                  Internal Note
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm ${msg.sender_type === 'agent' && !msg.is_internal ? 'text-white' : 'text-slate-700'}`}>
                              {msg.message}
                            </p>
                            <p className={`text-xs mt-1 ${msg.sender_type === 'agent' && !msg.is_internal ? 'text-white/60' : 'text-slate-400'}`}>
                              {new Date(msg.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Reply Box */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">Send Reply</Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={isInternalNote} onCheckedChange={setIsInternalNote} />
                      <span className="text-sm text-slate-600">Internal note (not visible to customer)</span>
                    </label>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={isInternalNote ? "Add an internal note..." : "Type your response to the customer..."}
                    rows={3}
                    className="bg-white"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendReply} disabled={!replyText.trim() || sendingReply} className="bg-[#082c59]">
                      {sendingReply ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      {isInternalNote ? 'Add Note' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Assign Ticket</DialogTitle>
            <DialogDescription>
              Assign ticket {ticketToAssign?.ticket_number} to a team member
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="text-xs text-slate-500">({m.role})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Assignment Notes (optional)</Label>
              <Textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={3}
                className="bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setTicketToAssign(null); setSelectedAssignee(''); setAssignmentNotes(''); }}>
              Cancel
            </Button>
            <Button onClick={handleAssignTicket} disabled={!selectedAssignee} className="bg-[#082c59]">
              <UserCheck className="w-4 h-4 mr-2" />Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Bulk Assign Tickets</DialogTitle>
            <DialogDescription>
              Assign {selectedTickets.length} ticket(s) to a team member
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="text-xs text-slate-500">({m.role})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkAssignModal(false); setSelectedAssignee(''); }}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={!selectedAssignee} className="bg-[#082c59]">
              <UserCheck className="w-4 h-4 mr-2" />Assign {selectedTickets.length} Tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
