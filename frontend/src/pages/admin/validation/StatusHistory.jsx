import React from 'react';
import { Tag } from 'lucide-react';
import { StatusTag } from './StatusComponents';
import { formatDateTime } from '@/utils/dateUtils';

export const StatusHistory = ({ ticket }) => {
  const history = [];
  if (ticket.created_at) history.push({ status: 'pending', date: ticket.created_at, actor: 'Customer', action: 'Created' });
  if (ticket.status === 'confirmed' || ticket.status === 'completed') history.push({ status: 'confirmed', date: ticket.updated_at, actor: 'Admin', action: 'Approved' });
  if (ticket.status === 'not_confirmed' && ticket.rejection_details) {
    history.push({ status: 'not_confirmed', date: ticket.rejection_details.rejected_at, actor: ticket.rejection_details.rejected_by_name || 'Admin', action: 'Rejected', reason: ticket.rejection_details.reason });
  }
  if (ticket.cancellation_details?.approved_at) history.push({ status: 'cancel_confirmed', date: ticket.cancellation_details.approved_at, actor: ticket.cancellation_details.approved_by_name || 'Admin', action: 'Cancellation Approved' });
  if (ticket.cancellation_details?.refund_approved_at) history.push({ status: 'money_refunded', date: ticket.cancellation_details.refund_approved_at, actor: ticket.cancellation_details.refund_approved_by_name || 'Admin', action: 'Refund Processed' });
  if (history.length === 0) return null;
  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> Status History</p>
      <div className="space-y-1">
        {history.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <StatusTag status={item.status} size="small" />
            <span className="text-slate-500">by {item.actor}</span>
            <span className="text-slate-400">{formatDateTime(item.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
