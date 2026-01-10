import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, User, MessageSquare, UserPlus, Building2 } from 'lucide-react';
import { getStatusConfig, getPriorityConfig, getCategoryIcon, getTimeAgo } from './constants';

export const TicketCard = ({ ticket, isSelected, onSelect, onView, onAssign, teamMembers }) => {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const timeAgo = getTimeAgo(ticket.created_at);

  // Get background gradient based on status
  const getStatusBackground = () => {
    switch (ticket.status) {
      case 'open':
        return 'bg-gradient-to-r from-blue-50 via-white to-white border-l-4 border-l-blue-500';
      case 'pending':
        return 'bg-gradient-to-r from-amber-50 via-white to-white border-l-4 border-l-amber-500';
      case 'in_progress':
        return 'bg-gradient-to-r from-purple-50 via-white to-white border-l-4 border-l-purple-500';
      case 'resolved':
        return 'bg-gradient-to-r from-green-50 via-white to-white border-l-4 border-l-green-500';
      case 'closed':
        return 'bg-gradient-to-r from-slate-50 via-white to-white border-l-4 border-l-slate-400';
      default:
        return 'bg-white border-l-4 border-l-slate-300';
    }
  };

  return (
    <div
      data-testid={`ticket-card-${ticket.id}`}
      className={`p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg ${getStatusBackground()} ${
        isSelected ? 'ring-2 ring-[#082c59] shadow-lg' : 'shadow-sm hover:shadow-md'
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
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] px-1.5 py-0 h-5 shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`}></span>
                  {ticket.priority}
                </Badge>
                {ticket.user_type === 'operator' && (
                  <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0 h-5 shadow-sm">
                    <Building2 className="w-3 h-3 mr-1" />Operator
                  </Badge>
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
          
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100/80">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium">{ticket.customer_name}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
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
                <div className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-slate-100 to-slate-50 px-2.5 py-1.5 rounded-full shadow-sm">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-[#082c59] text-white">
                      {ticket.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-700 font-medium">{ticket.assigned_to_name}</span>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs text-slate-500 hover:text-[#082c59] hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); onAssign(ticket); }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Assign
                </Button>
              )}
              {ticket.response_count > 0 && (
                <Badge variant="outline" className="text-xs h-6 bg-white shadow-sm">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {ticket.response_count}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
