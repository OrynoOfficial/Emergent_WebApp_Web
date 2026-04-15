import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CircleDot, CheckCircle, XCircle, AlertTriangle, Check, CreditCard, ArrowRight } from 'lucide-react';

export const STATUS_TAGS = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: CircleDot },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  not_confirmed: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  cancel_pending: { label: 'Cancellation Pending', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle },
  cancel_confirmed: { label: 'Cancellation Approved', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Check },
  money_refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: CreditCard },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  active: { label: 'Active', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: CircleDot },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  suspended: { label: 'Suspended', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: AlertTriangle },
};

export const StatusTag = ({ status, size = 'default' }) => {
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

export const StatusFlowIndicator = ({ currentStatus, type = 'ticket' }) => {
  const ticketFlow = ['pending', 'confirmed', 'completed'];
  const cancellationFlow = ['cancel_pending', 'cancel_confirmed', 'money_refunded'];
  const serviceFlow = ['pending', 'active'];
  const flow = type === 'cancellation' ? cancellationFlow : type === 'service' ? serviceFlow : ticketFlow;
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
            {idx < flow.length - 1 && <ArrowRight className={`h-3 w-3 ${isActive ? 'text-slate-600' : 'text-slate-300'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};
