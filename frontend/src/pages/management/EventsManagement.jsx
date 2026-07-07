import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar, Plus, Edit, Trash2, MapPin, Users,
  LayoutDashboard, MessageSquare, Building2, Ticket,
  Music, Mic, Eye, History, Search,
} from 'lucide-react';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { canListOperators } from '@/utils/roleHelpers';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import DatePickerField from '@/components/shared/DatePickerField';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import BulkActionsBar, { BulkSelectHeader, BulkSelectCell } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import {
  LocationsSubTab,
  ShowtimesSubTab,
} from '@/components/management/events/LocationsAndShowtimesTabs';

const PAGE_SIZE = 12;
const EVENT_TYPES = ['concert', 'conference', 'workshop', 'festival', 'sports', 'exhibition', 'party', 'other'];

const DEFAULT_EVENT_FORM = {
  name: '', event_type: 'concert', description: '',
  venue_name: '', venue_address: '', city: '',
  start_date: '', end_date: '', doors_open: '',
  total_capacity: 100, ticket_price: '',
  ticket_types: [], cover_image: '', images: [], tags: [],
  age_restriction: null, contact_email: '', contact_phone: '',
  operator_id: '', operator_name: '',
};

export default function EventsManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mgmtSubTab, setMgmtSubTab] = useState('locations');
  const [events, setEvents] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(DEFAULT_EVENT_FORM);
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  const [eventPage, setEventPage] = useState(1);
  const [eventSearch, setEventSearch] = useState('');

  const dashboardData = useRealDashboardData('events', '30days', scopeOperatorId);

  const filteredEvents = useMemo(() => {
    if (!eventSearch) return events;
    const s = eventSearch.toLowerCase();
    return events.filter(e =>
      (e.name || e.title || '').toLowerCase().includes(s) ||
      (e.venue_name || e.venue || '').toLowerCase().includes(s) ||
      (e.city || '').toLowerCase().includes(s) ||
      (e.event_type || e.type || '').toLowerCase().includes(s)
    );
  }, [events, eventSearch]);

  useEffect(() => { setEventPage(1); }, [eventSearch]);
  const eventTotalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const pagedEvents = useMemo(
    () => filteredEvents.slice((eventPage - 1) * PAGE_SIZE, eventPage * PAGE_SIZE),
    [filteredEvents, eventPage]
  );

  // Bulk selection on the visible event rows. Backend cascade is no-op for events.
  const eventBulk = useBulkSelection(pagedEvents, { idKey: '_id' });
  const bulkEventsRun = async (action, ids) => {
    await api.post('/admin/bulk', { collection: 'events', action, ids });
    await loadEvents();
  };
  const bulkEventsDelete     = (ids) => bulkEventsRun('delete', ids);
  const bulkEventsActivate   = (ids) => bulkEventsRun('activate', ids);
  const bulkEventsDeactivate = (ids) => bulkEventsRun('deactivate', ids);

  const handleViewEvent = (event) => {
    setViewingEvent(event);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(event.id, event.name);
  };

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/events/management/my-events${params}`);
      setEvents(res.data.events || res.data || []);
      if (canListOperators(user)) {
        try {
          const opRes = await api.get('/operators/');
          setOperators(opRes.data.operators || opRes.data || []);
        } catch { /* silent */ }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally { setLoading(false); }
  }, [scopeOperatorId, user]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const openEventDialog = (event = null) => {
    setEditingEvent(event);
    if (event) {
      setEventForm({
        ...event,
        venue_name: event.venue_name || event.venue || '',
        venue_address: event.venue_address || '',
        start_date: event.start_date || (event.event_date ? event.event_date.split('T')[0] : ''),
        end_date: event.end_date || '',
        doors_open: event.doors_open || event.start_time || '',
        total_capacity: event.total_capacity || event.total_seats || 100,
        ticket_price: event.ticket_price ?? '',
        ticket_types: event.ticket_types || [],
        cover_image: event.cover_image || '',
        contact_email: event.contact_email || '',
        contact_phone: event.contact_phone || '',
        operator_id: event.operator_id || '',
        operator_name: event.operator_name || '',
      });
    } else {
      setEventForm(DEFAULT_EVENT_FORM);
    }
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      const operator = operators.find(op => (op._id || op.id) === eventForm.operator_id);
      const eventId = editingEvent?._id || editingEvent?.id;
      const updateData = {
        name: eventForm.name,
        event_type: eventForm.event_type,
        description: eventForm.description,
        venue: eventForm.venue_name || eventForm.venue || '',
        city: eventForm.city,
        country: eventForm.country || 'CM',
        total_seats: parseInt(eventForm.total_capacity) || 100,
        ticket_price: parseFloat(eventForm.ticket_price) || 0,
        cover_image: eventForm.cover_image || null,
        images: eventForm.images || [],
        contact_email: eventForm.contact_email || null,
        contact_phone: eventForm.contact_phone || null,
        doors_open: eventForm.doors_open || null,
        end_date: eventForm.end_date || null,
        operator_id: eventForm.operator_id || '',
        operator_name: operator?.name || eventForm.operator_name || '',
      };
      if (eventForm.start_date) updateData.event_date = new Date(eventForm.start_date).toISOString();
      if (eventForm.doors_open) updateData.start_time = eventForm.doors_open;
      await api.put(`/events/${eventId}`, updateData);
      toast.success('Legacy event updated');
      setIsEventDialogOpen(false);
      loadEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteEvent = async (event) => {
    const eventId = event._id || event.id;
    if (!confirm('Delete this legacy event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      toast.success('Event deleted');
      loadEvents();
    } catch { toast.error('Failed to delete'); }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'concert': return <Music className="w-4 h-4" />;
      case 'conference': return <Mic className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <>
      <ManagementShell
        title="Events Management Center"
        icon={Calendar}
        subtitle="Locations · Showtimes · Tickets · Communications"
        scopeFilter={<OperatorScopeFilter serviceType="events" value={scopeOperatorId} onChange={setScopeOperatorId} />}
        onRefresh={() => { loadEvents(); setBookingsRefreshKey(k => k + 1); }}
        refreshing={loading}
        tabs={[
          { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { value: 'management', label: 'Management', icon: Calendar },
          { value: 'communications', label: 'Communications', icon: MessageSquare },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        testIdPrefix="events-mgmt"
      >

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
            recentBookingsSlot={
              <OperatorBookingsList serviceType="event" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
            }
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Tabs value={mgmtSubTab} onValueChange={setMgmtSubTab}>
            <TabsList className="bg-slate-100 p-1 rounded-lg">
              <TabsTrigger value="locations" className="data-[state=active]:bg-white" data-testid="events-tab-locations">
                <Building2 className="w-4 h-4 mr-1.5" /> Locations
              </TabsTrigger>
              <TabsTrigger value="showtimes" className="data-[state=active]:bg-white" data-testid="events-tab-showtimes">
                <Ticket className="w-4 h-4 mr-1.5" /> Showtimes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="locations" className="mt-5">
              <LocationsSubTab
                operators={operators}
                scopeOperatorId={scopeOperatorId}
                onReload={() => setBookingsRefreshKey(k => k + 1)}
              />
            </TabsContent>

            <TabsContent value="showtimes" className="mt-5">
              <ShowtimesSubTab
                scopeOperatorId={scopeOperatorId}
                onReload={() => setBookingsRefreshKey(k => k + 1)}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Events"
            serviceTag="events"
            operatorId={scopeOperatorId}
            serviceIcon={<Calendar className="h-5 w-5 text-purple-600" />}
            primaryColor="purple"
          />
        </TabsContent>
      </ManagementShell>

    </>
  );
}
