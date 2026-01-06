import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar, Plus, Edit, Trash2, MapPin, Clock, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Ticket, Music, Mic, Eye
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const CHART_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
const EVENT_TYPES = ['concert', 'conference', 'workshop', 'festival', 'sports', 'exhibition', 'party', 'other'];

const DEFAULT_EVENT_FORM = {
  name: '',
  event_type: 'concert',
  description: '',
  venue_name: '',
  venue_address: '',
  city: '',
  start_date: '',
  end_date: '',
  doors_open: '',
  total_capacity: 100,
  ticket_types: [],
  images: [],
  tags: [],
  age_restriction: null,
  contact_email: '',
  contact_phone: '',
  operator_id: '',
  operator_name: ''
};

// Events specific dashboard data generator
const useEventsDashboardData = (events) => {
  return useMemo(() => {
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => new Date(e.start_date || e.date) > new Date()).length;
    const totalCapacity = events.reduce((sum, e) => sum + (e.total_capacity || e.capacity || 100), 0);
    const totalRevenue = events.reduce((sum, e) => sum + (e.ticket_price || 15000) * 50, 0);

    // Type distribution
    const typeCount = {};
    events.forEach(e => {
      const type = e.event_type || e.type || 'other';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const distribution = Object.entries(typeCount).slice(0, 5).map(([type, count], i) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      color: CHART_COLORS[i]
    }));

    // Daily trend - fixed data
    const dailyTrend = [
      { date: 'Mon', bookings: 45, revenue: 280000 },
      { date: 'Tue', bookings: 38, revenue: 235000 },
      { date: 'Wed', bookings: 52, revenue: 320000 },
      { date: 'Thu', bookings: 65, revenue: 420000 },
      { date: 'Fri', bookings: 95, revenue: 680000 },
      { date: 'Sat', bookings: 125, revenue: 950000 },
      { date: 'Sun', bookings: 85, revenue: 580000 }
    ];

    return {
      stats: {
        totalItems: totalEvents,
        activeItems: upcomingEvents,
        totalBookings: totalEvents * 35 + 80,
        totalRevenue: totalRevenue || totalEvents * 650000,
        avgRating: 4.5,
        occupancyRate: 75,
        bookingsGrowth: 32.1,
        revenueGrowth: 26.4
      },
      bookingsByStatus: {
        confirmed: Math.max(85, totalEvents * 12),
        pending: Math.max(22, totalEvents * 3),
        cancelled: 5,
        completed: Math.max(65, totalEvents * 8)
      },
      dailyTrend,
      distribution,
      secondaryCount: totalCapacity,
      recentBookings: []
    };
  }, [events])
};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Total Events</p>
                <p className="text-2xl font-bold text-purple-900">{dashboardData.totalEvents}</p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <Calendar className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-600 mb-1">Upcoming</p>
                <p className="text-2xl font-bold text-pink-900">{dashboardData.upcomingEvents}</p>
              </div>
              <div className="bg-pink-200 rounded-full p-3">
                <Clock className="h-6 w-6 text-pink-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Total Capacity</p>
                <p className="text-2xl font-bold text-blue-900">{dashboardData.totalCapacity.toLocaleString()}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <Users className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Avg. Attendance</p>
                <p className="text-2xl font-bold text-green-900">82%</p>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <TrendingUp className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-purple-600" />
              Weekly Ticket Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.weeklySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-pink-600" />
              Events by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {dashboardData.typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardData.typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {dashboardData.typeData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No events data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CommunicationsHub = ({ user }) => {
  const [messages] = useState([
    { id: 1, from: 'Organizer', subject: 'New event registration - Jazz Festival', time: '1 hour ago', unread: true },
    { id: 2, from: 'Customer', subject: 'Group booking inquiry', time: '4 hours ago', unread: true },
    { id: 3, from: 'Venue', subject: 'Setup confirmation for Saturday', time: '1 day ago', unread: false }
  ]);

  const [announcementText, setAnnouncementText] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-lg border ${msg.unread ? 'bg-purple-50 border-purple-200' : 'bg-white'}`}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{msg.from}</p>
                    <p className="text-xs text-slate-600">{msg.subject}</p>
                  </div>
                  <span className="text-xs text-slate-500">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Send Announcement</Label>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Type announcement..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} />
              <Button className="bg-[#082c59]" onClick={() => { toast.success('Sent!'); setAnnouncementText(''); }}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="pt-4 space-y-2">
            <Button variant="outline" className="w-full justify-start"><Bell className="mr-2 h-4 w-4" /> Create Promotion</Button>
            <Button variant="outline" className="w-full justify-start"><Ticket className="mr-2 h-4 w-4" /> Manage Tickets</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const BusinessAnalytics = ({ events }) => {
  const analyticsData = useMemo(() => {
    const monthlyTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
      month,
      events: Math.floor(Math.random() * 20) + 5,
      revenue: Math.floor(Math.random() * 2000000) + 300000
    }));

    return { monthlyTrend };
  }, [events]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="events" stroke="#8B5CF6" strokeWidth={2} name="Events" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function EventsManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [events, setEvents] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(DEFAULT_EVENT_FORM);

  // Use the events dashboard data hook
  const dashboardData = useEventsDashboardData(events);

  const handleViewEvent = (event) => {
    setViewingEvent(event);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(event.id, event.name);
  };

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/events/');
      setEvents(res.data.events || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openEventDialog = (event = null) => {
    setEditingEvent(event);
    if (event) {
      setEventForm({
        ...event,
        venue_name: event.venue_name || event.venue || '',
        venue_address: event.venue_address || '',
        start_date: event.start_date ? event.start_date.split('T')[0] : '',
        end_date: event.end_date ? event.end_date.split('T')[0] : '',
        total_capacity: event.total_capacity || event.total_seats || 100,
        ticket_types: event.ticket_types || [],
        operator_id: event.operator_id || '',
        operator_name: event.operator_name || ''
      });
    } else {
      setEventForm(DEFAULT_EVENT_FORM);
    }
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      // Find operator name if only ID is set
      const operator = operators.find(op => (op._id || op.id) === eventForm.operator_id);
      const data = { 
        ...eventForm, 
        total_capacity: parseInt(eventForm.total_capacity) || 100,
        operator_name: operator?.name || eventForm.operator_name || ''
      };
      // Remove old field names
      delete data.venue;
      delete data.total_seats;
      delete data.ticket_price;
      delete data.event_date;
      delete data.start_time;
      delete data.end_time;
      delete data.country;
      
      const eventId = editingEvent?._id || editingEvent?.id;
      if (editingEvent) {
        await api.put(`/events/${eventId}`, data);
        toast.success('Event updated');
      } else {
        await api.post('/events/', data);
        toast.success('Event created');
      }
      setIsEventDialogOpen(false);
      loadEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteEvent = async (event) => {
    const eventId = event._id || event.id;
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      toast.success('Event deleted');
      loadEvents();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'concert': return <Music className="w-4 h-4" />;
      case 'conference': return <Mic className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Events Management Center</h1>
          <p className="text-gray-600">Manage events, tickets, analytics, and communications</p>
        </div>
        <Button onClick={loadEvents} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Calendar className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard events={events} />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Events</CardTitle>
              <PermissionGate permission="events.create">
                <Button onClick={() => openEventDialog()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> Add Event
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No events found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map(event => (
                    <Card key={event._id || event.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {getEventIcon(event.type)}
                            <h3 className="font-semibold">{event.name}</h3>
                          </div>
                          <Badge variant="outline" className="capitalize">{event.type}</Badge>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{event.venue}, {event.city}</div>
                          <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{event.date}</div>
                          <div className="flex items-center gap-2"><Users className="w-4 h-4" />{event.capacity} capacity</div>
                        </div>
                        <div className="mt-3 font-bold text-green-600">{formatFCFA(event.ticket_price)}</div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewEvent(event)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <PermissionGate permission="events.edit">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openEventDialog(event)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="events.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteEvent(event)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <CommunicationsHub user={user} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics events={events} />
        </TabsContent>
      </Tabs>

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Event Name</Label>
              <Input value={eventForm.name} onChange={e => setEventForm(p => ({ ...p, name: e.target.value }))} placeholder="Event name" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={eventForm.event_type} onValueChange={v => setEventForm(p => ({ ...p, event_type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {EVENT_TYPES.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Input value={eventForm.city} onChange={e => setEventForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
            </div>
            <div>
              <Label>Venue Name</Label>
              <Input value={eventForm.venue_name} onChange={e => setEventForm(p => ({ ...p, venue_name: e.target.value }))} placeholder="Venue name" />
            </div>
            <div>
              <Label>Venue Address</Label>
              <Input value={eventForm.venue_address} onChange={e => setEventForm(p => ({ ...p, venue_address: e.target.value }))} placeholder="Address" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={eventForm.start_date} onChange={e => setEventForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={eventForm.end_date} onChange={e => setEventForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div>
              <Label>Doors Open Time</Label>
              <Input type="time" value={eventForm.doors_open} onChange={e => setEventForm(p => ({ ...p, doors_open: e.target.value }))} />
            </div>
            <div>
              <Label>Total Capacity</Label>
              <Input type="number" value={eventForm.total_capacity} onChange={e => setEventForm(p => ({ ...p, total_capacity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input type="email" value={eventForm.contact_email} onChange={e => setEventForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="contact@event.cm" />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={eventForm.contact_phone} onChange={e => setEventForm(p => ({ ...p, contact_phone: e.target.value }))} placeholder="+237 6XX XXX XXX" />
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={eventForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setEventForm(p => ({ 
                    ...p, 
                    operator_id: v,
                    operator_name: op?.name || ''
                  }));
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select an operator..." />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  {operators.map(op => (
                    <SelectItem key={op._id || op.id} value={op._id || op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Select the operator managing this event</p>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} placeholder="Event description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEvent} className="bg-[#082c59]">{editingEvent ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Event Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-purple-600" />
              Event Details
            </DialogTitle>
          </DialogHeader>
          {viewingEvent && (
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-purple-900">{viewingEvent.name}</h3>
                <Badge className="mt-1 capitalize">{viewingEvent.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Date & Time</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {viewingEvent.date}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Venue</p>
                  <p className="font-medium">{viewingEvent.venue}, {viewingEvent.city}</p>
                </div>
                <div>
                  <p className="text-slate-500">Duration</p>
                  <p className="font-medium">{viewingEvent.duration || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Capacity</p>
                  <p className="font-medium">{viewingEvent.capacity} attendees</p>
                </div>
                <div>
                  <p className="text-slate-500">Ticket Price</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingEvent.ticket_price)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={viewingEvent.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                    {viewingEvent.status}
                  </Badge>
                </div>
              </div>
              {viewingEvent.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingEvent.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openEventDialog(viewingEvent); setIsViewDialogOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
