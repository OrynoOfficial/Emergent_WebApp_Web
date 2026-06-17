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
  useAuth();
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
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) { console.error('Failed to load operators:', err); }
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally { setLoading(false); }
  }, [scopeOperatorId]);

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
              <TabsTrigger value="legacy" className="data-[state=active]:bg-white text-slate-500" data-testid="events-tab-legacy">
                <History className="w-4 h-4 mr-1.5" /> Legacy Events
                {events.length > 0 && <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">{events.length}</Badge>}
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

            <TabsContent value="legacy" className="mt-5 space-y-4">
              <Card className="border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-start gap-3">
                  <History className="w-5 h-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">Legacy Events (read-only)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      These were created before the new <strong>Location → Showtime</strong> flow.
                      You can still edit or delete them, but new events should be scheduled as Showtimes against a Location.
                    </p>
                  </div>
                </div>
              </Card>

              <SubpageCard title="Legacy Events" icon={Calendar} count={filteredEvents.length} testId="events-mgmt-subpage-card">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search legacy events…"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="pl-9 h-8 bg-white text-sm"
                    data-testid="events-search-input"
                  />
                </div>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </SubpageCard>

              {loading ? (
                <div className="text-center py-8">Loading…</div>
              ) : filteredEvents.length === 0 ? (
                <Card className="p-12 text-center">
                  <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">{eventSearch ? 'No events match your search.' : 'No legacy events.'}</p>
                </Card>
              ) : viewMode === 'list' ? (
                <Card className="overflow-hidden" data-testid="events-list-view">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3 w-8">
                            <BulkSelectHeader
                              allSelected={eventBulk.allSelected}
                              partiallySelected={eventBulk.partiallySelected}
                              onToggleAll={eventBulk.toggleAll}
                              testid="events-bulk-select-all"
                            />
                          </th>
                          <th className="px-4 py-3">Event</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Venue</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Capacity</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedEvents.map(event => (
                          <tr key={event._id || event.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-3 w-8">
                              <BulkSelectCell
                                selected={eventBulk.isSelected(event._id || event.id)}
                                onToggle={eventBulk.toggle}
                                id={event._id || event.id}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{event.name || event.title}</td>
                            <td className="px-4 py-3 capitalize text-slate-700">{event.event_type || event.type || '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{event.venue_name || event.venue || '—'}{event.city ? `, ${event.city}` : ''}</td>
                            <td className="px-4 py-3 text-slate-700">{event.start_date || event.date || '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{event.total_capacity || event.capacity || '—'}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{formatFCFA(event.ticket_price || 0)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleViewEvent(event)}>View</Button>
                                <PermissionGate permission="events.edit">
                                  <Button size="sm" variant="ghost" onClick={() => openEventDialog(event)}>Edit</Button>
                                </PermissionGate>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className={viewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`events-${viewMode}-view`}>
                  {pagedEvents.map(event => (
                    <Card key={event._id || event.id} className="hover:shadow-lg transition-shadow border-slate-200">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {getEventIcon(event.event_type || event.type)}
                            <h3 className="font-semibold">{event.name || event.title}</h3>
                          </div>
                          <Badge variant="outline" className="capitalize text-[10px]">Legacy</Badge>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{event.venue_name || event.venue}{event.city ? `, ${event.city}` : ''}</div>
                          <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{event.start_date || event.date || '—'}</div>
                          <div className="flex items-center gap-2"><Users className="w-4 h-4" />{event.total_capacity || event.capacity || 0} capacity</div>
                          {viewMode === 'details' && event.description && (
                            <p className="text-slate-600 text-sm pt-2 border-t border-slate-100">{event.description}</p>
                          )}
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

              {filteredEvents.length > 0 && (
                <Pagination
                  page={eventPage}
                  totalPages={eventTotalPages}
                  onChange={setEventPage}
                  total={filteredEvents.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="event"
                />
              )}
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

      {/* Legacy Event Edit Dialog (kept so admins can fix old records) */}
      <ServiceFormShell
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        icon={Calendar}
        title="Edit Legacy Event"
        subtitle="Update venue, schedule and ticket info on an old-format event. New events should use the Showtime flow."
        editing
        accent="navy"
        leftColumn={
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Event Name</Label>
              <Input value={eventForm.name} onChange={e => setEventForm(p => ({ ...p, name: e.target.value }))} placeholder="Event name" />
            </div>
            <div className="col-span-2">
              <Label>Cover Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {eventForm.cover_image && (
                  <img src={eventForm.cover_image} alt="Cover" className="h-20 w-32 object-cover rounded-lg border" />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('files', file);
                      formData.append('folder', 'events');
                      try {
                        const res = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = res.data.urls?.[0] || res.data.files?.[0]?.url;
                        if (url) setEventForm(p => ({ ...p, cover_image: url }));
                      } catch { toast.error('Upload failed'); }
                    }}
                    className="h-10"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Gallery</Label>
              <MiniImageUploader
                images={eventForm.images || []}
                onChange={(imgs) => setEventForm(p => ({ ...p, images: imgs }))}
                max={3} folder="events" accent="navy"
              />
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
            <div><Label>City</Label><Input value={eventForm.city} onChange={e => setEventForm(p => ({ ...p, city: e.target.value }))} /></div>
            <div><Label>Venue Name</Label><Input value={eventForm.venue_name} onChange={e => setEventForm(p => ({ ...p, venue_name: e.target.value }))} /></div>
            <div><Label>Venue Address</Label><Input value={eventForm.venue_address} onChange={e => setEventForm(p => ({ ...p, venue_address: e.target.value }))} /></div>
            <div>
              <Label>Start Date</Label>
              <DatePickerField value={eventForm.start_date} onChange={(v) => setEventForm(p => ({ ...p, start_date: v }))} placeholder="Start date" title="Event Start Date" minDate={null} />
            </div>
            <div>
              <Label>End Date</Label>
              <DatePickerField value={eventForm.end_date} onChange={(v) => setEventForm(p => ({ ...p, end_date: v }))} placeholder="End date" title="Event End Date" minDate={eventForm.start_date ? new Date(eventForm.start_date) : null} />
            </div>
            <div><Label>Doors Open</Label><Input type="time" value={eventForm.doors_open} onChange={e => setEventForm(p => ({ ...p, doors_open: e.target.value }))} /></div>
            <div><Label>Ticket Price (FCFA)</Label><Input type="number" value={eventForm.ticket_price} onChange={e => setEventForm(p => ({ ...p, ticket_price: e.target.value }))} /></div>
            <div><Label>Total Capacity</Label><Input type="number" value={eventForm.total_capacity} onChange={e => setEventForm(p => ({ ...p, total_capacity: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={eventForm.contact_email} onChange={e => setEventForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
            <div><Label>Contact Phone</Label><Input value={eventForm.contact_phone} onChange={e => setEventForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
            <div className="col-span-2">
              <OperatorSelector
                value={eventForm.operator_id || ''}
                onChange={(id, name) => setEventForm(p => ({ ...p, operator_id: id, operator_name: name }))}
                operators={operators}
                helperText="Operator managing this event"
                testId="event-operator-selector"
              />
            </div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
        }
        preview={
          <GenericPreviewCard
            cover={eventForm.cover_image || (eventForm.images || [])[0]}
            thumbs={(eventForm.images || []).slice(0, 2)}
            icon={Calendar}
            badgeText={(eventForm.event_type || 'event').replace('_', ' ')}
            badgeClass="bg-yellow-400 text-slate-900"
            placeholderColor="from-[#082c59] via-[#0a3a75] to-[#0d4a8f]"
            title={eventForm.name || 'Event title'}
            subtitle={eventForm.venue_name || 'Venue'}
            location={[eventForm.city, eventForm.start_date].filter(Boolean).join(' · ') || 'City · Date'}
            tags={(eventForm.tags && eventForm.tags.length > 0) ? eventForm.tags : [eventForm.event_type, eventForm.doors_open && `Doors ${eventForm.doors_open}`].filter(Boolean)}
            tagsAccentClass="bg-blue-50 text-[#082c59]"
            priceLabel="From"
            priceValue={eventForm.ticket_price ? `${Number(eventForm.ticket_price).toLocaleString()} FCFA` : '—'}
            accentTextClass="text-[#082c59]"
          />
        }
        submitting={false}
        submitLabel="Update Legacy Event"
        onSubmit={handleSaveEvent}
        submitDataTestId="save-event-btn"
      />

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-purple-600" />
              Legacy Event Details
            </DialogTitle>
          </DialogHeader>
          {viewingEvent && (
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-purple-900">{viewingEvent.name}</h3>
                <Badge className="mt-1 capitalize">{viewingEvent.event_type || viewingEvent.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Date</p><p className="font-medium">{viewingEvent.start_date || viewingEvent.date}</p></div>
                <div><p className="text-slate-500">Venue</p><p className="font-medium">{viewingEvent.venue_name || viewingEvent.venue}, {viewingEvent.city}</p></div>
                <div><p className="text-slate-500">Capacity</p><p className="font-medium">{viewingEvent.total_capacity || viewingEvent.capacity}</p></div>
                <div><p className="text-slate-500">Price</p><p className="font-bold text-green-600">{formatFCFA(viewingEvent.ticket_price)}</p></div>
              </div>
              {viewingEvent.description && (
                <div><p className="text-slate-500 text-sm mb-1">Description</p><p className="text-sm bg-slate-50 p-3 rounded">{viewingEvent.description}</p></div>
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

      <BulkActionsBar
        count={eventBulk.count}
        entityLabel="event"
        selectedIds={eventBulk.selectedIds}
        selectedRows={eventBulk.selectedRows}
        onClear={eventBulk.clear}
        onDelete={bulkEventsDelete}
        onActivate={bulkEventsActivate}
        onDeactivate={bulkEventsDeactivate}
      />
    </>
  );
}
