import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock, User, Mail, Phone, Building2, Send, Calendar, Tag,
  MessageSquare, Loader2, UserPlus, CheckCircle, FileText,
  Package, ExternalLink
} from 'lucide-react';
import { getStatusConfig, getPriorityConfig, getCategoryIcon, getTimeAgo, TICKET_STATUSES, TICKET_PRIORITIES } from './constants';

export const TicketDetailModal = ({
  open,
  onOpenChange,
  ticket,
  replyText,
  onReplyChange,
  isInternalNote,
  onInternalNoteChange,
  sendingReply,
  onSendReply,
  onStatusChange,
  onPriorityChange,
  onAssign,
  teamMembers
}) => {
  if (!ticket) return null;

  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 bg-white overflow-hidden border-0 shadow-2xl rounded-2xl [&>button]:hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {ticket.ticket_number}
                </span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} gap-1 text-xs`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
                  {ticket.priority}
                </Badge>
                <Badge className={`${statusConfig.bg} ${statusConfig.text} gap-1 text-xs`}>
                  {statusConfig.icon}
                  {ticket.status.replace('_', ' ')}
                </Badge>
                {ticket.user_type === 'operator' && (
                  <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Building2 className="w-3 h-3 mr-1" /> Operator
                  </Badge>
                )}
                {ticket.source === 'chat' && (
                  <Badge className="bg-violet-50 text-violet-700 border border-violet-100 text-[10px]">
                    From Chat
                  </Badge>
                )}
                {ticket.source === 'admin' && (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px]">
                    Admin Created
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg">{ticket.subject}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Created {getTimeAgo(ticket.created_at)} by {ticket.customer_name}
                {ticket.created_by_admin_name && (
                  <span className="text-amber-600"> (Created by admin: {ticket.created_by_admin_name})</span>
                )}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-slate-600">
              Close
            </Button>
          </div>
          {/* Tags & Product */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {ticket.product_involved && (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-xs gap-1">
                <Package className="w-3 h-3" /> {ticket.product_involved}
              </Badge>
            )}
            {ticket.service_tag && (
              <Badge className="bg-teal-50 text-teal-700 border border-teal-100 text-xs">
                {ticket.service_tag}
              </Badge>
            )}
            {ticket.tags?.map((tag, i) => (
              <Badge key={i} variant="outline" className="bg-white text-xs font-normal text-slate-500">
                <Tag className="w-2.5 h-2.5 mr-1" />{tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/60">
            <ScrollArea className="flex-1 p-6">
              {/* Original Message — distinct card against modal body */}
              <div className="mb-6 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-[#082c59] text-white text-xs">
                      {ticket.customer_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{ticket.customer_name}</span>
                      <span className="text-[10px] text-slate-400">
                        <Clock className="w-3 h-3 inline mr-1" />{getTimeAgo(ticket.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                      {ticket.customer_email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{ticket.customer_email}</span>
                      )}
                      {ticket.customer_phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{ticket.customer_phone}</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>

              {/* Responses */}
              {ticket.messages?.length > 1 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Conversation ({ticket.messages.length - 1})
                  </h4>
                  {ticket.messages.slice(1).map((response, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl shadow-sm ${
                        response.is_internal
                          ? 'bg-amber-50 border border-amber-200'
                          : response.sender_type === 'agent'
                          ? 'bg-[#082c59]/5 border border-[#082c59]/20 ml-4'
                          : 'bg-white border border-slate-200 mr-4'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className={`text-[9px] ${response.sender_type === 'agent' ? 'bg-[#082c59] text-white' : 'bg-slate-200'}`}>
                            {response.sender_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs">{response.sender_name}</span>
                              {response.is_internal && (
                                <Badge className="bg-amber-100 text-amber-700 text-[9px] h-4">Internal</Badge>
                              )}
                              {response.sender_type === 'agent' && !response.is_internal && (
                                <Badge className="bg-[#082c59]/10 text-[#082c59] text-[9px] h-4">Staff</Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{getTimeAgo(response.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{response.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Reply Box */}
            <div className="p-4 border-t bg-white/80">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox checked={isInternalNote} onCheckedChange={onInternalNoteChange} />
                  <span className={isInternalNote ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                    {isInternalNote ? 'Internal Note' : 'Public Reply'}
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => onReplyChange(e.target.value)}
                  placeholder={isInternalNote ? "Add an internal note..." : "Type your reply..."}
                  className="flex-1 min-h-[70px] resize-none bg-slate-50/50"
                />
                <Button
                  onClick={onSendReply}
                  disabled={!replyText?.trim() || sendingReply}
                  className="bg-[#082c59] hover:bg-[#0a3a75] self-end"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-64 border-l border-slate-200 bg-slate-100/70 p-4 overflow-auto hidden lg:block">
            <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-4">Details</h4>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                <Select value={ticket.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="bg-white h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {TICKET_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                <Select value={ticket.priority} onValueChange={onPriorityChange}>
                  <SelectTrigger className="bg-white h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {TICKET_PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Assigned To</label>
                {ticket.assigned_to_name ? (
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm text-xs">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[8px] bg-[#082c59] text-white">
                        {ticket.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{ticket.assigned_to_name}</span>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full justify-start h-8 text-xs" onClick={onAssign}>
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Assign
                  </Button>
                )}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm text-xs">
                  {getCategoryIcon(ticket.category)}
                  <span className="capitalize">{ticket.category}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Requester</label>
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
                  <p className="font-medium">{ticket.customer_name}</p>
                  {ticket.customer_email && <p className="text-slate-500">{ticket.customer_email}</p>}
                  <Badge className="text-[9px] bg-slate-100 text-slate-600 capitalize">{ticket.user_type || 'customer'}</Badge>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Created</label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>

              {ticket.product_involved && (
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Product</label>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
                    <Package className="w-3.5 h-3.5" />
                    {ticket.product_involved}
                  </div>
                </div>
              )}

              {ticket.tags?.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="bg-white text-[10px] font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
