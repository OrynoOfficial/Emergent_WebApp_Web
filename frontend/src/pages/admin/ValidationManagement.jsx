import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Check, X, RefreshCw, Loader2, CreditCard, Ticket, Package,
  Bus, Car, Hotel as HotelIcon, Utensils, Calendar, MapPin,
  Clock, Users, ChevronDown, ChevronUp, AlertTriangle, XCircle, CheckCircle,
  Tag, ArrowRight, CircleDot, Mail, Phone, Search, Filter
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

const safeFormatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

const safeFormatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Invalid Date';
  }
};

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
            <span className="text-slate-400">• {safeFormatDateTime(item.date)}</span>
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
              <span>{safeFormatDateTime(ticket.booking_date || ticket.created_at)}</span>
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
              <div className="font-medium">{safeFormatDate(ticket.service_date || ticket.booking_date)}</div>
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
          Submitted: {safeFormatDateTime(service.created_at || service.created_date)}
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
            <span>{safeFormatDate(operator.created_at)}</span>
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
export default function ValidationManagement() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState({
    general_tickets: [],
    cancellation_tickets: [],
    pending_payments: [],
    pending_operators: [],
    services: {
      travel_routes: [], hotels: [], car_rentals: [], restaurants: [],
      packages: [], events: [], cinemas: [], pressing: [], banquets: []
    },
    counts: { general_tickets: 0, cancellation_tickets: 0, pending_payments: 0, pending_operators: 0, services: 0 }
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/validation/pending');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load validation data:', error);
      toast.error('Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    activityLogger.pageView('Service Validation Center', '/admin/validation');
  }, [loadData]);

  const handleTicketApproval = async (ticketId, customerId) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/tickets/${ticketId}/approve`, {});
      activityLogger.validationApprove('ticket', ticketId, `Ticket #${ticketId}`);
      toast.success('Ticket approved successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve ticket');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTicketRejection = async (ticketId, reason, customerId) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/tickets/${ticketId}/reject`, { reason });
      activityLogger.validationReject('ticket', ticketId, `Ticket #${ticketId}`, reason);
      toast.success('Ticket rejected');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject ticket');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentVerification = async (orderId, verified, notes) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/payments/${orderId}/verify?verified=${verified}`, { notes });
      activityLogger.paymentVerify(orderId, orderId);
      toast.success(verified ? 'Payment verified' : 'Payment rejected');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPaymentVerification = async () => {
    setIsProcessing(true);
    try {
      const result = await api.post('/validation/payments/bulk-verify');
      toast.success(result.data.message || 'All payments verified');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to bulk verify payments');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleServiceApproval = async (serviceId, operatorId, serviceType) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/services/${serviceType}/${serviceId}/approve`);
      activityLogger.validationApprove('service', serviceId, `${serviceType} #${serviceId}`);
      toast.success(`${serviceType.replace('_', ' ')} approved`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve service');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleServiceRejection = async (serviceId, reason, operatorId, serviceType) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/services/${serviceType}/${serviceId}/reject`, { reason });
      activityLogger.validationReject('service', serviceId, `${serviceType} #${serviceId}`, reason);
      toast.success(`${serviceType.replace('_', ' ')} rejected`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject service');
    } finally {
      setIsProcessing(false);
    }
  };

  // Operator approval handlers (super_admin only)
  const handleOperatorApproval = async (operatorId) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/operators/${operatorId}/approve`);
      activityLogger.validationApprove('operator', operatorId, `Operator #${operatorId}`);
      toast.success('Operator approved and activated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve operator');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOperatorRejection = async (operatorId, reason) => {
    setIsProcessing(true);
    try {
      await api.post(`/validation/operators/${operatorId}/reject`, { reason });
      activityLogger.validationReject('operator', operatorId, `Operator #${operatorId}`, reason);
      toast.success('Operator rejected');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject operator');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute all pending services
  const allServices = [
    ...data.services.travel_routes.map(s => ({ ...s, type: 'travel_route' })),
    ...data.services.hotels.map(s => ({ ...s, type: 'hotel' })),
    ...data.services.car_rentals.map(s => ({ ...s, type: 'car_rental' })),
    ...data.services.restaurants.map(s => ({ ...s, type: 'restaurant' })),
    ...data.services.packages.map(s => ({ ...s, type: 'package' })),
    ...data.services.events.map(s => ({ ...s, type: 'event' })),
    ...data.services.cinemas.map(s => ({ ...s, type: 'cinema' })),
    ...data.services.pressing.map(s => ({ ...s, type: 'pressing' })),
    ...data.services.banquets.map(s => ({ ...s, type: 'banquet' }))
  ].sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));

  const pendingOperators = data.pending_operators || [];

  // Filter function for items
  const filterItem = useCallback((item) => {
    const search = searchQuery.toLowerCase().trim();
    
    // Category filter
    if (categoryFilter !== 'all') {
      const itemCategory = item.service_category || item.service_type || item.type || '';
      if (itemCategory !== categoryFilter) return false;
    }
    
    // Search filter
    if (search) {
      const customerName = (item.customer_name || item.user_email || '').toLowerCase();
      const orderNumber = (item.order_number || item.id || item._id || '').toLowerCase();
      const serviceName = (item.service_name || item.service_title || item.name || item.title || '').toLowerCase();
      const category = (item.service_category || item.service_type || item.type || '').toLowerCase();
      const createdAt = item.created_at || item.created_date || '';
      
      return customerName.includes(search) || 
             orderNumber.includes(search) || 
             serviceName.includes(search) ||
             category.includes(search) ||
             createdAt.includes(search);
    }
    
    return true;
  }, [searchQuery, categoryFilter]);

  // Filtered data
  const filteredGeneralTickets = useMemo(() => 
    data.general_tickets.filter(filterItem), [data.general_tickets, filterItem]);
  const filteredCancellationTickets = useMemo(() => 
    data.cancellation_tickets.filter(filterItem), [data.cancellation_tickets, filterItem]);
  const filteredPendingPayments = useMemo(() => 
    data.pending_payments.filter(filterItem), [data.pending_payments, filterItem]);
  const filteredServices = useMemo(() => 
    allServices.filter(filterItem), [allServices, filterItem]);

  const totalCount = data.counts.general_tickets + data.counts.cancellation_tickets + 
                     data.counts.pending_payments + data.counts.services + (data.counts.pending_operators || 0);

  if (!isAdmin && !isOperator) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-center">
        <Card className="text-center p-8 bg-white shadow-lg max-w-md">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-slate-600">You need admin or operator permissions to access this page.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-500 mx-auto" />
          <p className="text-lg text-gray-700 mt-2">Loading validation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-white mb-8 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#082c59]">
              Service Validation Center
            </h1>
            <p className="text-slate-600 mt-1">
              Review and approve/reject pending tickets and service submissions
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="w-full lg:w-auto" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Search and Filter Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by customer name, order number, service name, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="travel">Travel / Bus</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
                <SelectItem value="car_rental">Car Rental</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="package">Packages</SelectItem>
                <SelectItem value="cinema">Cinema</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="banquet">Banquet</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Clear Filters Button */}
            {(searchQuery || categoryFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
                className="text-slate-600"
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          
          {/* Active Filters Display */}
          {(searchQuery || categoryFilter !== 'all') && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span>Showing results for:</span>
              {searchQuery && (
                <Badge variant="secondary" className="font-normal">
                  Search: "{searchQuery}"
                </Badge>
              )}
              {categoryFilter !== 'all' && (
                <Badge variant="secondary" className="font-normal capitalize">
                  Category: {categoryFilter.replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Pending Operators Section (Super Admin Only) */}
        {isSuperAdmin && pendingOperators.length > 0 && (
          <Card className="border-2 border-indigo-200 bg-indigo-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Pending Operator Approvals
                <Badge className="ml-2 bg-indigo-100 text-indigo-800">
                  {pendingOperators.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-600">
                Operators created by admins require super admin approval to become active.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOperators.map((operator) => (
                  <OperatorApprovalCard
                    key={operator.id}
                    operator={operator}
                    onApprove={handleOperatorApproval}
                    onReject={handleOperatorRejection}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Payments Section (Admin Only) */}
        {isAdmin && filteredPendingPayments.length > 0 && (
          <Card className="border-2 border-orange-200 bg-orange-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    Pending Payment Verification
                    <Badge className="ml-2 bg-orange-100 text-orange-800">
                      {filteredPendingPayments.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Orders awaiting payment confirmation. Verify payments manually.
                  </p>
                </div>
                <Button
                  onClick={handleBulkPaymentVerification}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isProcessing}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify All ({data.pending_payments.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPendingPayments.map((order) => (
                  <Card key={order.id || order._id} className="bg-white shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline">{order.service_category || order.service_type}</Badge>
                        <Badge className="bg-yellow-100 text-yellow-800">Payment Pending</Badge>
                      </div>
                      <h3 className="font-semibold mb-2">{order.service_name || order.service_title || 'Order'}</h3>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>Order: {order.order_number}</p>
                        <p>Customer: {order.customer_name || order.user_email || 'N/A'}</p>
                        <p className="font-bold text-emerald-600">{formatFCFA(order.total_amount || order.final_amount || order.amount || 0)}</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => handlePaymentVerification(order.id || order._id, true)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          size="sm"
                          disabled={isProcessing}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" /> Verify
                        </Button>
                        <Button
                          onClick={() => handlePaymentVerification(order.id || order._id, false)}
                          variant="outline"
                          className="flex-1 text-red-600 border-red-600"
                          size="sm"
                          disabled={isProcessing}
                        >
                          <XCircle className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* General Tickets Section */}
        {filteredGeneralTickets.length > 0 && (
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-blue-600" />
                Tickets for Approval
                <Badge className="ml-2 bg-blue-100 text-blue-800">
                  {filteredGeneralTickets.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-600">Review and approve pending ticket bookings.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGeneralTickets.map((ticket) => (
                  <TicketApprovalCard
                    key={ticket.id}
                    ticket={ticket}
                    onApprove={handleTicketApproval}
                    onReject={handleTicketRejection}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancellation & Refund Requests */}
        {filteredCancellationTickets.length > 0 && (
          <Card className="border-2 border-red-200 bg-red-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Cancellation & Refund Requests
                <Badge className="ml-2 bg-red-100 text-red-800">
                  {filteredCancellationTickets.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-600">Review and approve cancellation and refund requests.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCancellationTickets.map((ticket) => (
                  <TicketApprovalCard
                    key={ticket.id}
                    ticket={ticket}
                    onApprove={handleTicketApproval}
                    onReject={handleTicketRejection}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services for Approval */}
        {filteredServices.length > 0 && (
          <Card className="border-2 border-purple-200 bg-purple-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                Services for Approval
                <Badge className="ml-2 bg-purple-100 text-purple-800">
                  {filteredServices.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-600">Review and approve pending service submissions.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServices.map((service) => (
                  <ServiceApprovalCard
                    key={`${service.type}-${service.id}`}
                    service={service}
                    serviceType={service.type}
                    onApprove={handleServiceApproval}
                    onReject={handleServiceRejection}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results from Search/Filter */}
        {(searchQuery || categoryFilter !== 'all') && 
         filteredGeneralTickets.length === 0 && 
         filteredCancellationTickets.length === 0 && 
         filteredPendingPayments.length === 0 && 
         filteredServices.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Search className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
              <p className="text-slate-500 mb-4">
                No items match your search criteria. Try adjusting your filters.
              </p>
              <Button 
                variant="outline" 
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* All Clear State */}
        {totalCount === 0 && !searchQuery && categoryFilter === 'all' && (
          <Card className="text-center py-16 bg-white shadow-lg">
            <CardContent>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
              <p className="text-slate-600">All tickets and services have been reviewed. Great job!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
