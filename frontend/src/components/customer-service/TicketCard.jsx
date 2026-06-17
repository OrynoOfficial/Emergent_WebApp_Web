import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, User, MessageSquare, UserPlus, Building2, Tag, Package } from 'lucide-react';
import { getStatusConfig, getPriorityConfig, getCategoryIcon, getTimeAgo } from './constants';

// Service tag colors
const TAG_COLORS = {
  booking: 'bg-blue-100 text-blue-700 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  account: 'bg-violet-100 text-violet-700 border-violet-200',
  service: 'bg-orange-100 text-orange-700 border-orange-200',
  technical: 'bg-red-100 text-red-700 border-red-200',
  feedback: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  hotels: 'bg-rose-100 text-rose-700 border-rose-200',
  travel: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  restaurants: 'bg-amber-100 text-amber-700 border-amber-200',
  'car-rental': 'bg-teal-100 text-teal-700 border-teal-200',
  events: 'bg-purple-100 text-purple-700 border-purple-200',
  cinema: 'bg-pink-100 text-pink-700 border-pink-200',
  laundry: 'bg-sky-100 text-sky-700 border-sky-200',
  banquet: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  packages: 'bg-lime-100 text-lime-700 border-lime-200',
  'from-chat': 'bg-slate-100 text-slate-600 border-slate-200',
};
const getTagColor = (tag) => TAG_COLORS[tag?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';

export const TicketCard = ({ ticket, isSelected, onSelect, onView, onAssign, teamMembers }) => {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const timeAgo = getTimeAgo(ticket.created_at);

  return (
    <div
      data-testid={`ticket-card-${ticket.id}`}
      className={`p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg bg-white border border-slate-200 shadow-sm ${
        isSelected ? 'ring-2 ring-[#082c59] shadow-lg border-[#082c59]/40' : 'hover:border-[#082c59]/30 hover:shadow-md'
      }`}
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => { onSelect(ticket.id, checked); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] px-1.5 py-0 h-5 shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`}></span>
                  {ticket.priority}
                </Badge>
                {ticket.user_type === 'operator' && (
                  <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] px-1.5 py-0 h-5 shadow-sm">
                    <Building2 className="w-3 h-3 mr-1" />Operator
                  </Badge>
                )}
                {ticket.source === 'chat' && (
                  <Badge className="bg-violet-50 text-violet-700 border border-violet-100 text-[10px] h-5">From Chat</Badge>
                )}
                {ticket.source === 'admin' && (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] h-5">Admin</Badge>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 truncate">{ticket.subject}</h3>
              <p className="text-sm text-slate-500 truncate mt-0.5 line-clamp-1">{ticket.description}</p>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.text} text-xs flex items-center gap-1 shrink-0 shadow-sm px-2.5 py-1`}>
              {statusConfig.icon}
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>
          
          {/* Tags row */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {ticket.tags?.slice(0, 4).map((tag, i) => (
              <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(tag)}`}>{tag}</Badge>
            ))}
            {ticket.product_involved && (
              <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5 gap-0.5">
                <Package className="w-2.5 h-2.5" />{ticket.product_involved}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium">{ticket.customer_name}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                {getCategoryIcon(ticket.category)}
                <span className="capitalize">{ticket.category}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeAgo}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {ticket.assigned_to_name ? (
                <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-full shadow-sm border border-slate-200">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-[#082c59] text-white">
                      {ticket.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-700 font-medium">{ticket.assigned_to_name}</span>
                </div>
              ) : (
                <Button 
                  size="sm" variant="ghost" 
                  className="h-7 text-xs text-slate-500 hover:text-[#082c59] hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); onAssign(ticket); }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />Assign
                </Button>
              )}
              {ticket.response_count > 0 && (
                <Badge variant="outline" className="text-xs h-6 bg-slate-50 shadow-sm border-slate-200">
                  <MessageSquare className="w-3 h-3 mr-1" />{ticket.response_count}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
