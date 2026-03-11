import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Check, X, RefreshCw, Loader2, CreditCard, Ticket, Package,
  Bus, Car, Hotel as HotelIcon, Utensils, Calendar, MapPin,
  Clock, Users, ChevronDown, ChevronUp, AlertTriangle, XCircle, CheckCircle,
  Tag, ArrowRight, CircleDot, Mail, Phone, Search, Filter, Megaphone,
  LayoutGrid, List, History, Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import { activityLogger } from '@/utils/activityLogger';
import { formatDate, formatDateTime } from '@/utils/dateUtils';

// Status Tag System - matching original validation workflow
const STATUS_TAGS = {
  // Order/Ticket Statuses
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: CircleDot },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  not_confirmed: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  cancel_pending: { label: 'Cancellation Pending', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle },
  cancel_confirmed: { label: 'Cancellation Approved', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Check },
  money_refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: CreditCard },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  
  // Service Statuses
  active: { label: 'Active', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: CircleDot },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  suspended: { label: 'Suspended', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: AlertTriangle },
};

// Status Tag Component
const StatusTag = ({ status, size = 'default' }) => {
  const statusInfo = STATUS_TAGS[status] || STATUS_TAGS.pending;
  const Icon = statusInfo.icon;
  const sizeClasses = size === 'small' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  
  return (
    <Badge className={`${statusInfo.color} border ${sizeClasses} flex items-center gap-1.5 font-medium`}>
      <Icon className={size === 'small' ? 'h-3 w-3' : 'h-4 w-4'} />
      {statusInfo.label}
    </Badge>
  );
};

// Status Flow Indicator
const StatusFlowIndicator = ({ currentStatus, type = 'ticket' }) => {
  const ticketFlow = ['pending', 'confirmed', 'completed'];
  const cancellationFlow = ['cancel_pending', 'cancel_confirmed', 'money_refunded'];
  const serviceFlow = ['pending', 'active'];
  
  const flow = type === 'cancellation' ? cancellationFlow : 
               type === 'service' ? serviceFlow : ticketFlow;
  
  const currentIndex = flow.indexOf(currentStatus);
  
  return (
    <div className="flex items-center gap-1 text-xs text-slate-500">
      {flow.map((status, idx) => {
        const isActive = idx <= currentIndex;
        const isCurrent = status === currentStatus;
        const statusInfo = STATUS_TAGS[status];
        
        return (
          <React.Fragment key={status}>
            <span className={`px-2 py-0.5 rounded ${isActive ? statusInfo.color : 'bg-slate-100 text-slate-400'} ${isCurrent ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}>
              {statusInfo.label}
            </span>
            {idx < flow.length - 1 && (
              <ArrowRight className={`h-3 w-3 ${isActive ? 'text-slate-600' : 'text-slate-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// formatDate is now imported from dateUtils as formatDate
// formatDateTime is now imported from dateUtils as formatDateTime

// Status History Component - shows the journey of an item
const StatusHistory = ({ ticket }) => {
  const history = [];
  
  if (ticket.created_at) {
    history.push({ status: 'pending', date: ticket.created_at, actor: 'Customer', action: 'Created' });
  }
  
  if (ticket.status === 'confirmed' || ticket.status === 'completed') {
    history.push({ status: 'confirmed', date: ticket.updated_at, actor: 'Admin', action: 'Approved' });
  }
  
  if (ticket.status === 'not_confirmed' && ticket.rejection_details) {
    history.push({ 
      status: 'not_confirmed', 
      date: ticket.rejection_details.rejected_at, 
      actor: ticket.rejection_details.rejected_by_name || 'Admin',
      action: 'Rejected',
      reason: ticket.rejection_details.reason
    });
  }
  
  if (ticket.cancellation_details?.approved_at) {
    history.push({
      status: 'cancel_confirmed',
      date: ticket.cancellation_details.approved_at,
      actor: ticket.cancellation_details.approved_by_name || 'Admin',
      action: 'Cancellation Approved'
    });
  }
  
  if (ticket.cancellation_details?.refund_approved_at) {
    history.push({
      status: 'money_refunded',
      date: ticket.cancellation_details.refund_approved_at,
      actor: ticket.cancellation_details.refund_approved_by_name || 'Admin',
      action: 'Refund Processed'
    });
  }
  
  if (history.length === 0) return null;
  
  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <Tag className="h-3 w-3" /> Status History
      </p>
      <div className="space-y-1">
        {history.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <StatusTag status={item.status} size="small" />
            <span className="text-slate-500">by {item.actor}</span>
            <span className="text-slate-400">• {formatDateTime(item.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Ticket Approval Card Component
const TicketApprovalCard = ({ ticket, onApprove, onReject, isProcessing }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const handleRejectClick = () => setShowRejectionInput(true);

  const handleConfirmReject = () => {
    if (rejectionReason.trim()) {
      onReject(ticket.id, rejectionReason, ticket.customer_id);
      setShowRejectionInput(false);
      setRejectionReason('');
    }
  };

  const handleCancelReject = () => {
    setShowRejectionInput(false);
    setRejectionReason('');
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryIcon = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('travel')) return <Bus className="h-5 w-5 text-blue-600" />;
    if (c.includes('car')) return <Car className="h-5 w-5 text-green-500" />;
    if (c.includes('hotel')) return <HotelIcon className="h-5 w-5 text-purple-500" />;
    if (c.includes('restaurant')) return <Utensils className="h-5 w-5 text-orange-500" />;
    if (c.includes('package')) return <Package className="h-5 w-5 text-indigo-500" />;
    if (c.includes('event')) return <Calendar className="h-5 w-5 text-rose-500" />;
    return <Ticket className="h-5 w-5 text-blue-600" />;
  };

  const isCancellation = ticket.status === 'cancel_pending';
  const isRefund = ticket.status === 'cancel_confirmed';

  // Determine flow type for status indicator
  const getFlowType = () => {
    if (isCancellation || isRefund || ticket.status === 'money_refunded') return 'cancellation';
    return 'ticket';
  };

  return (
    <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-3 text-lg">
              {getCategoryIcon(ticket.service_category)}
              <span className="font-bold truncate">
                {ticket.service_title || ticket.service_category?.replace('_', ' ') || 'Ticket'}
              </span>
            </CardTitle>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">Order:</span>
              <span className="font-mono">{ticket.order_number}</span>
              <span>•</span>
              <span>{formatDateTime(ticket.booking_date || ticket.created_at)}</span>
            </div>
          </div>
          <StatusTag status={ticket.status} />
        </div>
        
        {/* Status Flow Indicator */}
        <div className="mt-3">
          <StatusFlowIndicator currentStatus={ticket.status} type={getFlowType()} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <div>
              <div className="font-medium">{ticket.customer_name || 'Customer'}</div>
              <div className="text-xs text-slate-500">Customer</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <div>
              <div className="font-medium">{formatDate(ticket.service_date || ticket.booking_date)}</div>
              <div className="text-xs text-slate-500">Service Date</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Expandable Details */}
        <div>
          <button
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="bg-slate-100 p-3 rounded-lg w-full flex items-center justify-between hover:bg-slate-200 transition-colors"
          >
            <span className="font-medium text-slate-700 text-sm">Booking Details</span>
            {isDetailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {isDetailsExpanded && ticket.booking_details && (
            <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm space-y-2">
              {Object.entries(ticket.booking_details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize text-slate-600">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment & Amount */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-1">Category</div>
            <Badge variant="outline" className="capitalize">
              {ticket.service_category?.replace('_', ' ') || 'N/A'}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Payment</div>
            <Badge className={getPaymentStatusColor(ticket.payment_status)}>
              {ticket.payment_status || 'pending'}
            </Badge>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Amount</div>
              <div className="font-bold text-slate-900">{formatFCFA(ticket.amount || ticket.total_amount)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Final Amount</div>
              <div className="font-bold text-emerald-600">{formatFCFA(ticket.final_amount || ticket.total_amount)}</div>
            </div>
          </div>
        </div>

        {/* Operator */}
        {ticket.operator_name && (
          <div className="text-xs text-slate-500">
            Operator: <span className="font-medium text-slate-700">{ticket.operator_name}</span>
          </div>
        )}
        
        {/* Status History */}
        <StatusHistory ticket={ticket} />
      </CardContent>

      <CardFooter className="bg-slate-50 p-4 flex flex-col items-stretch gap-3">
        {showRejectionInput ? (
          <div className="w-full">
            <Textarea
              placeholder="Please provide a reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || isProcessing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
              <Button variant="outline" onClick={handleCancelReject}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={() => onApprove(ticket.id, ticket.customer_id)}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              <Check className="mr-2 h-4 w-4" />
              {isCancellation ? 'Approve Cancellation' : isRefund ? 'Approve Refund' : 'Approve'}
            </Button>
            <Button
              onClick={handleRejectClick}
              className="w-full bg-red-600 hover:bg-red-700"
              variant="destructive"
              disabled={isProcessing}
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

// Service Approval Card Component
const ServiceApprovalCard = ({ service, serviceType, onApprove, onReject, isProcessing }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  const handleRejectClick = () => setShowRejectionInput(true);
  const handleConfirmReject = () => {
    if (rejectionReason.trim()) {
      onReject(service.id, rejectionReason, service.operator_id, serviceType);
      setShowRejectionInput(false);
      setRejectionReason('');
    }
  };
  const handleCancelReject = () => {
    setShowRejectionInput(false);
    setRejectionReason('');
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case 'travel_route': return <Bus className="h-5 w-5 text-blue-500" />;
      case 'car_rental': return <Car className="h-5 w-5 text-green-500" />;
      case 'restaurant': return <Utensils className="h-5 w-5 text-orange-500" />;
      case 'hotel': return <HotelIcon className="h-5 w-5 text-purple-500" />;
      case 'package': return <Package className="h-5 w-5 text-indigo-500" />;
      case 'event': return <Calendar className="h-5 w-5 text-rose-500" />;
      default: return <Package className="h-5 w-5 text-slate-500" />;
    }
  };

  const getServiceName = () => {
    return service.name || service.service_name || service.title || 
           (serviceType === 'travel_route' ? `${service.from_city} → ${service.to_city}` : 'Service');
  };

  return (
    <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-3 text-lg">
            {getServiceIcon()}
            <span className="font-bold truncate">{getServiceName()}</span>
          </CardTitle>
          <div className="flex flex-col items-end gap-2">
            <Badge className="bg-purple-100 text-purple-800 capitalize">
              {serviceType.replace('_', ' ')}
            </Badge>
            <StatusTag status={service.status || 'pending'} size="small" />
          </div>
        </div>
        {service.operator_name && (
          <p className="text-xs text-slate-500 mt-1">Operator: {service.operator_name}</p>
        )}
        
        {/* Service Status Flow */}
        <div className="mt-3">
          <StatusFlowIndicator currentStatus={service.status || 'pending'} type="service" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Service specific details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {serviceType === 'travel_route' && (
            <>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{service.from_city} → {service.to_city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>{service.departure_time} - {service.arrival_time}</span>
              </div>
            </>
          )}
          {(serviceType === 'hotel' || serviceType === 'restaurant') && (
            <>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{service.city}</span>
              </div>
              {service.address && (
                <div className="text-slate-600 text-xs col-span-2">{service.address}</div>
              )}
            </>
          )}
        </div>

        {/* Price */}
        {(service.price || service.base_price || service.price_per_night) && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Price</div>
            <div className="font-bold text-emerald-600">
              {formatFCFA(service.price || service.base_price || service.price_per_night)}
              {serviceType === 'hotel' && '/night'}
              {serviceType === 'car_rental' && '/day'}
            </div>
          </div>
        )}

        {/* Created date */}
        <div className="text-xs text-slate-500">
          Submitted: {formatDateTime(service.created_at || service.created_date)}
        </div>
      </CardContent>

      <CardFooter className="bg-slate-50 p-4 flex flex-col items-stretch gap-3">
        {showRejectionInput ? (
          <div className="w-full">
            <Textarea
              placeholder="Please provide a reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || isProcessing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
              <Button variant="outline" onClick={handleCancelReject}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={() => onApprove(service.id, service.operator_id, serviceType)}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              <Check className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button
              onClick={handleRejectClick}
              className="w-full bg-red-600 hover:bg-red-700"
              variant="destructive"
              disabled={isProcessing}
            >
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

// Operator Approval Card Component (super_admin only)
const OperatorApprovalCard = ({ operator, onApprove, onReject, isProcessing }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  const handleRejectClick = () => setShowRejectionInput(true);
  const handleConfirmReject = () => {
    if (rejectionReason.trim()) {
      onReject(operator.id, rejectionReason);
      setShowRejectionInput(false);
      setRejectionReason('');
    }
  };
  const handleCancelReject = () => {
    setShowRejectionInput(false);
    setRejectionReason('');
  };

  return (
    <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-3 text-lg">
            <Users className="h-5 w-5 text-indigo-500" />
            <span className="font-bold truncate">{operator.name || operator.business_name}</span>
          </CardTitle>
          <div className="flex flex-col items-end gap-2">
            <Badge className="bg-indigo-100 text-indigo-800 capitalize">
              {operator.operator_type || 'Operator'}
            </Badge>
            <StatusTag status="pending" size="small" />
          </div>
        </div>
        {operator.created_by_name && (
          <p className="text-xs text-slate-500 mt-1">
            Created by: {operator.created_by_name} ({operator.created_by_role || 'admin'})
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <span>{operator.email || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-500" />
            <span>{operator.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <span>{operator.city || operator.address || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>{formatDate(operator.created_at)}</span>
          </div>
        </div>
        
        {operator.service_types && operator.service_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {operator.service_types.map(service => (
              <Badge key={service} variant="outline" className="text-xs">
                {service}
              </Badge>
            ))}
          </div>
        )}
        
        {operator.description && (
          <p className="text-sm text-slate-600 line-clamp-2">{operator.description}</p>
        )}
      </CardContent>

      <CardFooter className="bg-slate-50 border-t p-4 flex flex-col gap-3">
        {showRejectionInput ? (
          <div className="w-full space-y-3">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-sm"
            />
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || isProcessing}
                className="flex-1"
              >
                Confirm Rejection
              </Button>
              <Button variant="outline" onClick={handleCancelReject}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => onApprove(operator.id)}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              <Check className="mr-2 h-4 w-4" /> Approve Operator
            </Button>
            <Button
              onClick={handleRejectClick}
              className="w-full bg-red-600 hover:bg-red-700"
              variant="destructive"
              disabled={isProcessing}
            >
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

// Main Component
// --- Reusable SubPage Component: search, filters, list/grid, pagination, bulk ---
const ITEMS_PER_PAGE = 8;

function ValidationSubPage({ items, renderCard, renderListRow, emptyIcon, emptyText, onBulkApprove, onBulkReject, showBulk = true }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => {
      const text = [item.service_name, item.order_number, item.customer_name, item.user_email, item.name, item.title, item.operator_name, item.service_category, item.type, item.item_name, item.performed_by_name].filter(Boolean).join(' ').toLowerCase();
      return text.includes(s);
    });
  }, [items, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = (checked) => setSelected(checked ? new Set(paginated.map(i => i.id)) : new Set());

  useEffect(() => { setPage(1); }, [search]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        {emptyIcon || <CheckCircle className="h-14 w-14 mb-3 text-green-300" />}
        <p className="font-medium text-slate-600">{emptyText || 'No items'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-10 bg-white h-9" />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('list')} className={`px-2 py-1.5 ${viewMode === 'list' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} data-testid="list-view-btn"><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('grid')} className={`px-2 py-1.5 ${viewMode === 'grid' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} data-testid="grid-view-btn"><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulk && selected.size > 0 && (
        <Card className="bg-[#082c59] text-white border-0">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm">{selected.size} selected</span>
            <div className="flex gap-2">
              {onBulkApprove && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7" onClick={() => { onBulkApprove(Array.from(selected)); setSelected(new Set()); }}><CheckCircle className="h-3 w-3 mr-1" />Approve All</Button>}
              {onBulkReject && <Button size="sm" variant="destructive" className="h-7" onClick={() => { onBulkReject(Array.from(selected)); setSelected(new Set()); }}><XCircle className="h-3 w-3 mr-1" />Reject All</Button>}
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={() => setSelected(new Set())}><X className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Select All */}
      {showBulk && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox checked={paginated.length > 0 && selected.size >= paginated.length} onCheckedChange={selectAll} />
          <span className="text-xs text-slate-500">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Items */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        {paginated.map(item => (
          <div key={item.id || item._id || Math.random()} className="relative">
            {showBulk && (
              <div className="absolute top-3 left-3 z-10">
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
              </div>
            )}
            {viewMode === 'grid' ? renderCard(item) : (renderListRow ? renderListRow(item) : renderCard(item))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">Page {page} of {totalPages} ({filtered.length} items)</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-7 h-7 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function ValidationManagement() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState({
    general_tickets: [], cancellation_tickets: [], pending_payments: [],
    pending_operators: [], pending_promotions: [],
    services: { travel_routes: [], hotels: [], car_rentals: [], restaurants: [], packages: [], events: [], cinemas: [], pressing: [], banquets: [] },
    counts: { general_tickets: 0, cancellation_tickets: 0, pending_payments: 0, pending_operators: 0, pending_promotions: 0, services: 0 }
  });
  const [history, setHistory] = useState({ entries: [], total: 0, type_counts: {} });
  const [mainTab, setMainTab] = useState('pending');
  const [pendingTab, setPendingTab] = useState('payments');
  const [validatedTab, setValidatedTab] = useState('payments');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

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
    ...data.services.events.map(s => ({ ...s, type: 'event' })),
    ...data.services.cinemas.map(s => ({ ...s, type: 'cinema' })),
    ...data.services.pressing.map(s => ({ ...s, type: 'pressing' })),
    ...data.services.banquets.map(s => ({ ...s, type: 'banquet' })),
    ...(isSuperAdmin ? (data.pending_operators || []).map(s => ({ ...s, type: 'operator' })) : []),
  ], [data, isSuperAdmin]);

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
          <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" /><span>{order.customer_name || order.user_email || order.user_id?.slice(0, 8) || 'Customer'}</span></div>
          {order.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium text-slate-800">{order.operator_name}</span></span></div>}
          {(details.travel_date || details.check_in) && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-slate-400" /><span>{details.travel_date || details.check_in}{details.check_out ? ` → ${details.check_out}` : ''}</span></div>}
          {details.seats && <div className="flex items-center gap-1.5"><Ticket className="h-3 w-3 text-slate-400" /><span>Seats: {Array.isArray(details.seats) ? details.seats.join(', ') : details.seats}</span></div>}
          {(details.origin || details.from_city) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /><span>{details.origin || details.from_city} → {details.destination || details.to_city}</span></div>}
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
    const cancDetails = ticket.cancellation_details || {};
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
          {isCancellation && cancDetails.reason && (
            <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-[10px] font-medium text-orange-800">Cancellation reason:</p>
              <p className="text-[11px] text-orange-700">{cancDetails.reason}</p>
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

  const renderServiceCard = (service) => {
    const isTravel = service.type === 'travel_route';
    const isHotel = service.type === 'hotel';
    return (
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
          {isTravel ? `${service.from_city} → ${service.to_city}` : (service.name || service.title || 'Service')}
        </h3>
        <div className="space-y-1.5 text-xs text-slate-600">
          {service.operator_name && <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-slate-400" /><span>Operator: <span className="font-medium">{service.operator_name}</span></span></div>}
          {isTravel && service.departure_time && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>Departure: {service.departure_time} → Arrival: {service.arrival_time}</span></div>}
          {isTravel && <div className="flex items-center gap-1.5"><Bus className="h-3 w-3 text-slate-400" /><span>Vehicle: {service.vehicle_name || 'N/A'} ({service.vehicle_type}) &middot; {service.total_seats} seats</span></div>}
          {isHotel && service.city && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /><span>{service.city}{service.address ? `, ${service.address}` : ''}</span></div>}
          {isHotel && service.star_rating && <div className="flex items-center gap-1.5"><span className="text-amber-500">{'★'.repeat(service.star_rating)}</span></div>}
          {service.description && <p className="text-slate-500 line-clamp-2 mt-1">{service.description}</p>}
          {service.amenities?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{service.amenities.slice(0, 5).map(a => <Badge key={a} variant="outline" className="text-[9px] px-1 py-0">{a}</Badge>)}</div>}
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
  )};

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
          {promo.valid_until && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>Valid until: {formatDate(promo.valid_until)}</span></div>}
          {promo.service_type && <div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-slate-400" /><span>Service: {promo.service_type}</span></div>}
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
            {entry.subscribers_notified && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" /><span>Notified {entry.subscribers_notified} subscribers</span></div>}
          </div>
          {entry.reason && (
            <div className={`mt-3 p-2.5 rounded-lg text-xs ${isRejected ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
              <p className={`font-medium text-[10px] mb-0.5 ${isRejected ? 'text-red-700' : 'text-slate-700'}`}>
                {isRejected ? 'Rejection Reason:' : 'Note:'}
              </p>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#082c59]">Service Validation Center</h1>
            <p className="text-slate-500 text-sm mt-1">Review, approve, and track validations</p>
          </div>
          <Button onClick={loadData} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-white shadow-sm mb-6">
          <TabsTrigger value="pending" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="pending-main-tab">
            <Clock className="h-4 w-4" /> Pending {totalPending > 0 && <Badge className="bg-amber-500 text-white text-[10px] ml-1">{totalPending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="validated" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="validated-main-tab">
            <ShieldCheck className="h-4 w-4" /> Validated {totalValidated > 0 && <Badge variant="outline" className="text-[10px] ml-1">{totalValidated}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Tabs value={pendingTab} onValueChange={setPendingTab}>
            <TabsList className="bg-white shadow-sm mb-4">
              <TabsTrigger value="payments" className="text-xs gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800"><CreditCard className="h-3.5 w-3.5" />Payments {pendingCounts.payments > 0 && <Badge className="bg-amber-500 text-white text-[9px] px-1">{pendingCounts.payments}</Badge>}</TabsTrigger>
              <TabsTrigger value="tickets" className="text-xs gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800"><Ticket className="h-3.5 w-3.5" />Tickets {pendingCounts.tickets > 0 && <Badge className="bg-blue-500 text-white text-[9px] px-1">{pendingCounts.tickets}</Badge>}</TabsTrigger>
              <TabsTrigger value="services" className="text-xs gap-1.5 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-800"><Package className="h-3.5 w-3.5" />Services {pendingCounts.services > 0 && <Badge className="bg-purple-500 text-white text-[9px] px-1">{pendingCounts.services}</Badge>}</TabsTrigger>
              <TabsTrigger value="promotions" className="text-xs gap-1.5 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-800"><Megaphone className="h-3.5 w-3.5" />Promotions {pendingCounts.promotions > 0 && <Badge className="bg-violet-500 text-white text-[9px] px-1">{pendingCounts.promotions}</Badge>}</TabsTrigger>
            </TabsList>
            <TabsContent value="payments"><ValidationSubPage items={data.pending_payments} renderCard={renderPaymentCard} emptyText="No pending payments" /></TabsContent>
            <TabsContent value="tickets"><ValidationSubPage items={allTickets} renderCard={renderTicketCard} emptyText="No pending tickets" /></TabsContent>
            <TabsContent value="services"><ValidationSubPage items={allServices} renderCard={renderServiceCard} emptyText="No pending services" /></TabsContent>
            <TabsContent value="promotions"><ValidationSubPage items={data.pending_promotions || []} renderCard={renderPromotionCard} emptyText="No pending promotions" /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="validated">
          <Tabs value={validatedTab} onValueChange={setValidatedTab}>
            <TabsList className="bg-white shadow-sm mb-4">
              <TabsTrigger value="payments" className="text-xs gap-1.5 data-[state=active]:bg-green-50 data-[state=active]:text-green-800"><CreditCard className="h-3.5 w-3.5" />Payments <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.payment || 0}</Badge></TabsTrigger>
              <TabsTrigger value="tickets" className="text-xs gap-1.5 data-[state=active]:bg-green-50 data-[state=active]:text-green-800"><Ticket className="h-3.5 w-3.5" />Tickets <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.ticket || 0}</Badge></TabsTrigger>
              <TabsTrigger value="services" className="text-xs gap-1.5 data-[state=active]:bg-green-50 data-[state=active]:text-green-800"><Package className="h-3.5 w-3.5" />Services <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.service || 0}</Badge></TabsTrigger>
              <TabsTrigger value="promotions" className="text-xs gap-1.5 data-[state=active]:bg-green-50 data-[state=active]:text-green-800"><Megaphone className="h-3.5 w-3.5" />Promotions <Badge variant="outline" className="text-[9px] px-1 ml-1">{validatedCounts.promotion || 0}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="payments"><ValidationSubPage items={historyByType('payment')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated payments yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="tickets"><ValidationSubPage items={historyByType('ticket')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated tickets yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="services"><ValidationSubPage items={historyByType('service')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated services yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
            <TabsContent value="promotions"><ValidationSubPage items={historyByType('promotion')} renderCard={renderHistoryCard} showBulk={false} emptyText="No validated promotions yet" emptyIcon={<History className="h-14 w-14 mb-3 text-slate-300" />} /></TabsContent>
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
