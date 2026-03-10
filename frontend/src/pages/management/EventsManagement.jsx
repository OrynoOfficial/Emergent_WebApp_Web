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
  LayoutDashboard, MessageSquare, RefreshCw,
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
import { useRealDashboardData } from '@/hooks/useRealDashboardData';

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
// Dashboard data now fetched from API via useRealDashboardData hook

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
  const dashboardData = useRealDashboardData('events');

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
          <p className="text-gray-600">Manage events, tickets, and communications</p>
        </div>
        <Button onClick={loadEvents} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Calendar className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Events"
            serviceIcon={<Calendar className="h-8 w-8" />}
            primaryColor="purple"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Events"
            secondaryLabel="Total Capacity"
            secondaryCount={dashboardData.secondaryCount}
          />
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
          <ServiceCommunicationsHub
            serviceType="Events"
            serviceTag="events"
            serviceIcon={<Calendar className="h-5 w-5 text-purple-600" />}
            primaryColor="purple"
          />
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
