import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MessageSquare, CheckCircle, Search, 
  RefreshCw, AlertTriangle, Inbox, Users, UserPlus, ArrowUpDown, X,
  SlidersHorizontal, Activity, BarChart2
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Import extracted components and constants
import { 
  TICKET_CATEGORIES, 
  TICKET_PRIORITIES, 
  TICKET_STATUSES, 
  ITEMS_PER_PAGE,
  getStatusConfig,
  getPriorityConfig
} from '@/components/customer-service/constants';
import { Pagination } from '@/components/customer-service/Pagination';
import { TicketCard } from '@/components/customer-service/TicketCard';
import { TicketDetailModal } from '@/components/customer-service/TicketDetailModal';
import { DashboardTab } from '@/components/customer-service/DashboardTab';
import { TeamTab } from '@/components/customer-service/TeamTab';
import { AssignModal, BulkAssignModal } from '@/components/customer-service/AssignModal';
import { AddMemberModal } from '@/components/customer-service/AddMemberModal';

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
          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab 
              stats={stats} 
              categoryChartData={categoryChartData} 
              statusChartData={statusChartData} 
            />
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
          <TabsContent value="team" className="mt-6">
            <TeamTab 
              teamMembers={teamMembers}
              onAddMember={() => setShowAddMemberModal(true)}
              onRemoveMember={handleRemoveTeamMember}
              onRefresh={loadTeamMembers}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Team Member Modal */}
      <AddMemberModal
        open={showAddMemberModal}
        onOpenChange={setShowAddMemberModal}
        availableMembers={availableMembers}
        searchTerm={memberSearchTerm}
        onSearchChange={setMemberSearchTerm}
        onAddMember={handleAddTeamMember}
      />

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        ticket={selectedTicket}
        teamMembers={teamMembers}
        onStatusChange={handleStatusChange}
        onAssign={() => { setTicketToAssign(selectedTicket); setShowAssignModal(true); }}
        replyText={replyText}
        onReplyChange={setReplyText}
        isInternalNote={isInternalNote}
        onInternalNoteChange={setIsInternalNote}
        onSendReply={handleSendReply}
        sendingReply={sendingReply}
      />

      {/* Assign Modal */}
      <AssignModal
        open={showAssignModal}
        onOpenChange={(open) => {
          setShowAssignModal(open);
          if (!open) {
            setTicketToAssign(null);
            setSelectedAssignee('');
            setAssignmentNotes('');
          }
        }}
        ticket={ticketToAssign}
        teamMembers={teamMembers}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={setSelectedAssignee}
        notes={assignmentNotes}
        onNotesChange={setAssignmentNotes}
        onAssign={handleAssignTicket}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        open={showBulkAssignModal}
        onOpenChange={(open) => {
          setShowBulkAssignModal(open);
          if (!open) setSelectedAssignee('');
        }}
        selectedCount={selectedTickets.length}
        teamMembers={teamMembers}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={setSelectedAssignee}
        onAssign={handleBulkAssign}
      />
    </div>
  );
}
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
