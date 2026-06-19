import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Check, X, RefreshCw, Loader2, CreditCard, Ticket, Package,
  Bus, Car, Hotel as HotelIcon, Utensils, Calendar, MapPin,
  Clock, Users, Tag, Mail, Phone, Megaphone, History, ShieldCheck,
  CheckCircle, XCircle
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import { formatDate, formatDateTime } from '@/utils/dateUtils';

// Extracted sub-components
import { StatusTag, StatusFlowIndicator } from './validation/StatusComponents';
import { StatusHistory } from './validation/StatusHistory';
import { ValidationSubPage } from './validation/ValidationSubPage';
import IconButton from '@/components/shared/IconButton';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';

export default function ValidationManagement() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState({
    general_tickets: [], cancellation_tickets: [], pending_payments: [],
    pending_operators: [], pending_promotions: [],
    services: { travel_routes: [], hotels: [], car_rentals: [], restaurants: [], packages: [], package_services: [], events: [], cinemas: [], pressing: [], banquets: [] },
    counts: { general_tickets: 0, cancellation_tickets: 0, pending_payments: 0, pending_operators: 0, pending_promotions: 0, services: 0 }
  });
  const [history, setHistory] = useState({ entries: [], total: 0, type_counts: {} });
  const [mainTab, setMainTab] = useState('pending');
  const [pendingTab, setPendingTab] = useState('payments');
  const [validatedTab, setValidatedTab] = useState('payments');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/validation/pending'),
        api.get('/validation/history?limit=200'),
      ]);
      setData(pendingRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to load:', error);
      toast.error('Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (type, id, name) => {
    setIsProcessing(true);
    try {
      if (type === 'ticket') await api.post(`/validation/tickets/${id}/approve`, {});
      else if (type === 'payment') await api.post(`/validation/payments/${id}/verify?verified=true`);
      else if (type === 'promotion') await api.post(`/validation/promotions/${id}/approve`);
      else if (type === 'operator') await api.post(`/validation/operators/${id}/approve`);
      else await api.post(`/validation/services/${type}/${id}/approve`);
      toast.success(`${name || 'Item'} approved`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    } finally { setIsProcessing(false); }
  };

  const openRejectDialog = (type, id, name) => {
    setRejectTarget({ type, id, name });
    setRejectReason('');
    setShowRejectDialog(true);
  };

  const submitRejection = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Please enter a reason'); return; }
    setIsProcessing(true);
    try {
      const { type, id } = rejectTarget;
      if (type === 'ticket') await api.post(`/validation/tickets/${id}/reject`, { reason: rejectReason });
      else if (type === 'payment') await api.post(`/validation/payments/${id}/verify?verified=false`, { notes: rejectReason });
      else if (type === 'promotion') await api.post(`/validation/promotions/${id}/reject`, { reason: rejectReason });
      else if (type === 'operator') await api.post(`/validation/operators/${id}/reject`, { reason: rejectReason });
      else await api.post(`/validation/services/${type}/${id}/reject`, { reason: rejectReason });
      toast.success('Rejected');
      setShowRejectDialog(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Rejection failed');
    } finally { setIsProcessing(false); }
  };

  const allTickets = [...data.general_tickets, ...data.cancellation_tickets];
  const allServices = useMemo(() => [
    ...data.services.travel_routes.map(s => ({ ...s, type: 'travel_route' })),
    ...data.services.hotels.map(s => ({ ...s, type: 'hotel' })),
    ...data.services.car_rentals.map(s => ({ ...s, type: 'car_rental' })),
    ...data.services.restaurants.map(s => ({ ...s, type: 'restaurant' })),
    ...data.services.packages.map(s => ({ ...s, type: 'package' })),
    ...(data.services.package_services || []).map(s => ({ ...s, type: 'package_service' })),
    ...data.services.events.map(s => ({ ...s, type: 'event' })),
    ...data.services.cinemas.map(s => ({ ...s, type: 'cinema' })),
    ...data.services.pressing.map(s => ({ ...s, type: 'pressing' })),
    ...data.services.banquets.map(s => ({ ...s, type: 'banquet' })),
    ...(isSuperAdmin ? (data.pending_operators || []).map(s => ({ ...s, type: 'operator' })) : []),
  ], [data, isSuperAdmin]);

  // Operator scope filter — if an operator is selected, filter all collections by operator_id
  const byOperator = useCallback((arr) => {
    if (!operatorFilter) return arr;
    return arr.filter(x => (x.operator_id || x.raw?.operator_id) === operatorFilter);
  }, [operatorFilter]);

  const filteredPayments = useMemo(() => byOperator(data.pending_payments || []), [data.pending_payments, byOperator]);
  const filteredTickets = useMemo(() => byOperator(allTickets), [allTickets, byOperator]);
  const filteredServices = useMemo(() => byOperator(allServices), [allServices, byOperator]);
  const filteredPromotions = useMemo(() => byOperator(data.pending_promotions || []), [data.pending_promotions, byOperator]);
  const filteredHistory = useMemo(() => {
    const entries = (history.entries || []);
    return operatorFilter ? entries.filter(e => e.operator_id === operatorFilter) : entries;
  }, [history.entries, operatorFilter]);
  const filteredHistoryByType = useCallback((type) => filteredHistory.filter(e => e.item_type === type), [filteredHistory]);

  const pendingCounts = {
    payments: data.counts.pending_payments || 0,
    tickets: (data.counts.general_tickets || 0) + (data.counts.cancellation_tickets || 0),
    services: (data.counts.services || 0) + (data.counts.pending_operators || 0),
    promotions: data.counts.pending_promotions || 0,
  };
  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);
  const validatedCounts = history.type_counts || {};
  const totalValidated = Object.values(validatedCounts).reduce((a, b) => a + b, 0);
  const historyByType = (type) => (history.entries || []).filter(e => e.item_type === type);

  if (!isAdmin) {
    return <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-center"><Card className="text-center p-8"><XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" /><h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1></Card></div>;
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center items-center min-h-[60vh]"><Loader2 className="animate-spin h-10 w-10 text-[#082c59]" /></div>;
  }

  // ========== RENDER CARD FUNCTIONS ==========
  const renderPaymentCard = (order) => {
    const details = typeof order.booking_details === 'string' ? {} : (order.booking_details || {});
    return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
      <CardContent className="p-4 pl-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize font-medium">{order.service_category || 'Order'}</Badge>
            <Badge className="bg-amber-100 text-amber-800 text-[10px]">Payment Pending</Badge>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{order.order_number}</span>
        </div>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">{order.service_name || 'Order'}</h3>
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" /><span>{order.customer_name || order.user_email || 'Customer'}</span></div>
          {order.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium text-slate-800">{order.operator_name}</span></span></div>}
          {(details.travel_date || details.check_in) && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-slate-400" /><span>{details.travel_date || details.check_in}{details.check_out ? ` \u2192 ${details.check_out}` : ''}</span></div>}
          {details.seats && <div className="flex items-center gap-1.5"><Ticket className="h-3 w-3 text-slate-400" /><span>Seats: {Array.isArray(details.seats) ? details.seats.join(', ') : details.seats}</span></div>}
          {(details.origin || details.from_city) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /><span>{details.origin || details.from_city} \u2192 {details.destination || details.to_city}</span></div>}
          {order.customer_phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /><span>{order.customer_phone}</span></div>}
          {order.customer_email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" /><span>{order.customer_email}</span></div>}
          <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>Created: {formatDateTime(order.created_at)}</span></div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div>
            <p className="font-bold text-emerald-700 text-base">{formatFCFA(order.total_amount || 0)}</p>
            <p className="text-[10px] text-slate-400">{order.currency || 'XAF'} &middot; {order.payment_method || 'N/A'}</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[11px] px-3" onClick={() => handleApprove('payment', order.id, order.service_name)} disabled={isProcessing}><CheckCircle className="h-3 w-3 mr-1" />Verify</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 text-[11px] px-3" onClick={() => openRejectDialog('payment', order.id, order.service_name)} disabled={isProcessing}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )};

  const renderTicketCard = (ticket) => {
    const isCancellation = ticket.status === 'cancel_pending' || ticket.status === 'cancel_confirmed';
    return (
    <Card className={`bg-white shadow-sm hover:shadow-md transition-shadow border-l-4 ${isCancellation ? 'border-l-orange-400' : 'border-l-blue-400'}`}>
      <CardContent className="p-4 pl-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusTag status={ticket.status} size="small" />
            <Badge variant="outline" className="text-[10px] capitalize">{ticket.service_category || 'order'}</Badge>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{ticket.order_number || ticket.id?.slice(0, 8)}</span>
        </div>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">{ticket.service_name || 'Ticket'}</h3>
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" /><span>{ticket.customer_name || ticket.user_email || 'Customer'}</span></div>
          {ticket.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium">{ticket.operator_name}</span></span></div>}
          {ticket.payment_method && <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-slate-400" /><span>Payment: {ticket.payment_method} ({ticket.payment_status})</span></div>}
          <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>Created: {formatDateTime(ticket.created_at)}</span></div>
          {isCancellation && ticket.cancellation_details?.reason && (
            <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-[10px] font-medium text-orange-800">Cancellation reason:</p>
              <p className="text-[11px] text-orange-700">{ticket.cancellation_details.reason}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="font-bold text-slate-800 text-base">{formatFCFA(ticket.total_amount || 0)}</p>
          <div className="flex gap-1.5">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[11px] px-3" onClick={() => handleApprove('ticket', ticket.id, ticket.service_name)} disabled={isProcessing}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 text-[11px] px-3" onClick={() => openRejectDialog('ticket', ticket.id, ticket.service_name)} disabled={isProcessing}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )};

  const renderServiceCard = (service) => (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-purple-400">
      <CardContent className="p-4 pl-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize font-medium">{service.type?.replace('_', ' ')}</Badge>
            <StatusTag status={service.status || 'pending'} size="small" />
          </div>
          <span className="text-[10px] text-slate-400">{formatDate(service.created_at)}</span>
        </div>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">
          {service.type === 'travel_route' ? `${service.from_city} \u2192 ${service.to_city}` : (service.name || service.title || 'Service')}
        </h3>
        <div className="space-y-1.5 text-xs text-slate-600">
          {service.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium">{service.operator_name}</span></span></div>}
          {service.type === 'travel_route' && service.departure_time && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>Departure: {service.departure_time} \u2192 Arrival: {service.arrival_time}</span></div>}
          {service.type === 'travel_route' && <div className="flex items-center gap-1.5"><Bus className="h-3 w-3 text-slate-400" /><span>Vehicle: {service.vehicle_name || 'N/A'} ({service.vehicle_type}) &middot; {service.total_seats} seats</span></div>}
          {(service.type === 'hotel' || service.type === 'restaurant') && service.city && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /><span>{service.city}{service.address ? `, ${service.address}` : ''}</span></div>}
          {service.description && <p className="text-slate-500 line-clamp-2 mt-1">{service.description}</p>}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          {service.price ? <p className="font-bold text-emerald-700">{formatFCFA(service.price)}</p> : <span />}
          <div className="flex gap-1.5">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[11px] px-3" onClick={() => handleApprove(service.type, service.id, service.name || service.title)} disabled={isProcessing}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 text-[11px] px-3" onClick={() => openRejectDialog(service.type, service.id, service.name || service.title)} disabled={isProcessing}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPromotionCard = (promo) => (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-violet-400">
      <CardContent className="p-4 pl-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-100 text-violet-800 text-[10px] capitalize">{promo.promotion_type || 'promotion'}</Badge>
            <Badge className="bg-amber-100 text-amber-800 text-[10px]">Pending Approval</Badge>
          </div>
          <span className="text-[10px] text-slate-400">{formatDate(promo.created_at)}</span>
        </div>
        <h3 className="font-semibold text-sm text-slate-900 mb-1">{promo.title}</h3>
        <p className="text-xs text-slate-600 mb-2">{promo.message}</p>
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium text-slate-800">{promo.operator_name}</span></span></div>
          <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" /><span>Submitted by: {promo.created_by_name}</span></div>
          {promo.discount_value && <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-slate-400" /><span>Discount: <span className="font-bold text-emerald-700">{promo.discount_value}</span></span></div>}
        </div>
        <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-7 text-[11px]" onClick={() => handleApprove('promotion', promo.id, promo.title)} disabled={isProcessing}><CheckCircle className="h-3 w-3 mr-1" />Approve & Send</Button>
          <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 h-7 text-[11px]" onClick={() => openRejectDialog('promotion', promo.id, promo.title)} disabled={isProcessing}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderHistoryCard = (entry) => {
    const isRejected = entry.action === 'rejected';
    const actionColors = { approved: 'bg-green-100 text-green-700 border-green-200', rejected: 'bg-red-100 text-red-700 border-red-200', verified: 'bg-blue-100 text-blue-700 border-blue-200' };
    return (
      <Card className={`bg-white shadow-sm border-l-4 ${isRejected ? 'border-l-red-400' : 'border-l-green-400'}`}>
        <CardContent className="p-4 pl-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] capitalize border ${actionColors[entry.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{entry.action}</Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{entry.item_type}</Badge>
            </div>
            <span className="text-[10px] text-slate-400">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
          </div>
          <h3 className="font-semibold text-sm text-slate-900">{entry.item_name || 'Item'}</h3>
          <div className="space-y-1.5 text-xs text-slate-600 mt-2">
            <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" /><span>By: <span className="font-medium">{entry.performed_by_name}</span> <span className="text-slate-400">({entry.performed_by_role})</span></span></div>
            {entry.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: {entry.operator_name}</span></div>}
            {entry.amount && <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-slate-400" /><span className="font-medium text-emerald-700">{formatFCFA(entry.amount)}</span></div>}
          </div>
          {entry.reason && (
            <div className={`mt-3 p-2.5 rounded-lg text-xs ${isRejected ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
              <p className={`font-medium text-[10px] mb-0.5 ${isRejected ? 'text-red-700' : 'text-slate-700'}`}>{isRejected ? 'Rejection Reason:' : 'Note:'}</p>
              <p className={isRejected ? 'text-red-600' : 'text-slate-600'}>{entry.reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8" data-testid="validation-page">
      <div className="bg-white mb-6 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#082c59]">Service Validation Center</h1>
            <p className="text-slate-500 text-sm mt-1">Review, approve, and track validations</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
            <IconButton icon={RefreshCw} label={isLoading ? 'Refreshing…' : 'Refresh'} variant="outline" onClick={loadData} disabled={isLoading} data-testid="validation-refresh" />
          </div>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100">
          <TabsTrigger value="pending" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="pending-main-tab">
            <Clock className="h-4 w-4" /> Pending {totalPending > 0 && <Badge className="bg-amber-500 text-white text-[10px] ml-1">{totalPending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="validated" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="validated-main-tab">
            <ShieldCheck className="h-4 w-4" /> Validated {totalValidated > 0 && <Badge variant="outline" className="text-[10px] ml-1">{totalValidated}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Tabs value={pendingTab} onValueChange={setPendingTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-slate-100">
              <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><CreditCard className="h-3.5 w-3.5" />Payments {pendingCounts.payments > 0 && <Badge className="bg-amber-500 text-white text-[9px] px-1">{pendingCounts.payments}</Badge>}</TabsTrigger>
              <TabsTrigger value="tickets" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Ticket className="h-3.5 w-3.5" />Tickets {pendingCounts.tickets > 0 && <Badge className="bg-blue-500 text-white text-[9px] px-1">{pendingCounts.tickets}</Badge>}</TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Package className="h-3.5 w-3.5" />Services {pendingCounts.services > 0 && <Badge className="bg-purple-500 text-white text-[9px] px-1">{pendingCounts.services}</Badge>}</TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Megaphone className="h-3.5 w-3.5" />Promotions {pendingCounts.promotions > 0 && <Badge className="bg-violet-500 text-white text-[9px] px-1">{pendingCounts.promotions}</Badge>}</TabsTrigger>
            </TabsList>
            <TabsContent value="payments"><ValidationSubPage items={filteredPayments} renderCard={renderPaymentCard} emptyText="No pending payments" /></TabsContent>
            <TabsContent value="tickets"><ValidationSubPage items={filteredTickets} renderCard={renderTicketCard} emptyText="No pending tickets" /></TabsContent>
            <TabsContent value="services"><ValidationSubPage items={filteredServices} renderCard={renderServiceCard} emptyText="No pending services" /></TabsContent>
            <TabsContent value="promotions"><ValidationSubPage items={filteredPromotions} renderCard={renderPromotionCard} emptyText="No pending promotions" /></TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="validated">
          <Tabs value={validatedTab} onValueChange={setValidatedTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-slate-100">
              <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><CreditCard className="h-3.5 w-3.5" />Payments <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.payment || 0}</Badge></TabsTrigger>
              <TabsTrigger value="tickets" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Ticket className="h-3.5 w-3.5" />Tickets <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.ticket || 0}</Badge></TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Package className="h-3.5 w-3.5" />Services <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.service || 0}</Badge></TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Megaphone className="h-3.5 w-3.5" />Promotions <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.promotion || 0}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="payments"><ValidationSubPage items={filteredHistoryByType('payment')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated payments yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="tickets"><ValidationSubPage items={filteredHistoryByType('ticket')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated tickets yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="services"><ValidationSubPage items={filteredHistoryByType('service')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated services yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="promotions"><ValidationSubPage items={filteredHistoryByType('promotion')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated promotions yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-50 to-[#082c59]/5 max-w-sm" data-testid="reject-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />Reject: {rejectTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <label className="text-sm font-medium">Reason for rejection *</label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this item is being rejected..." rows={3} className="mt-2 bg-white" data-testid="reject-reason-input" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button onClick={submitRejection} disabled={isProcessing || !rejectReason.trim()} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-reject-btn">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
