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
  X, Clock, User, Mail, Phone, Building2, Send, Calendar, Tag, 
  MessageSquare, AlertTriangle, Loader2, UserPlus, CheckCircle,
  FileText
} from 'lucide-react';
import { getStatusConfig, getPriorityConfig, getCategoryIcon, getTimeAgo, TICKET_STATUSES, TICKET_PRIORITIES } from './constants';

export const TicketDetailModal = ({
  open,
  onClose,
  ticket,
  replyText,
  setReplyText,
  isInternalNote,
  setIsInternalNote,
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 bg-white overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {ticket.ticket_number}
                </span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text}`}>
                  {ticket.priority}
                </Badge>
                <Badge className={`${statusConfig.bg} ${statusConfig.text}`}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
                {ticket.user_type === 'operator' && (
                  <Badge className="bg-indigo-100 text-indigo-700">
                    <Building2 className="w-3 h-3 mr-1" />
                    Operator
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl">{ticket.subject}</DialogTitle>
              <DialogDescription className="mt-1">
                Created {getTimeAgo(ticket.created_at)} by {ticket.customer_name}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-6">
              {/* Original Message */}
              <Card className="mb-6 border-l-4 border-l-[#082c59]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-[#082c59] text-white">
                        {ticket.customer_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{ticket.customer_name}</span>
                        <span className="text-xs text-slate-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {getTimeAgo(ticket.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {ticket.customer_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {ticket.customer_email}
                          </span>
                        )}
                        {ticket.customer_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {ticket.customer_phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                  {ticket.attachments?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-slate-500 mb-2">Attachments:</p>
                      <div className="flex flex-wrap gap-2">
                        {ticket.attachments.map((att, i) => (
                          <Badge key={i} variant="outline" className="bg-slate-50">
                            <FileText className="w-3 h-3 mr-1" />
                            {att.name || `Attachment ${i + 1}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Responses */}
              {ticket.responses?.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Conversation ({ticket.responses.length})
                  </h4>
                  {ticket.responses.map((response, idx) => (
                    <Card 
                      key={idx} 
                      className={`${response.is_internal ? 'bg-amber-50 border-amber-200' : response.is_staff ? 'bg-blue-50 border-blue-200' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={response.is_staff ? 'bg-[#082c59] text-white' : 'bg-slate-200'}>
                              {response.author_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{response.author_name}</span>
                                {response.is_internal && (
                                  <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                                    Internal Note
                                  </Badge>
                                )}
                                {response.is_staff && !response.is_internal && (
                                  <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                                    Staff
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">{getTimeAgo(response.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{response.message}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {/* Reply Box */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox 
                    checked={isInternalNote}
                    onCheckedChange={setIsInternalNote}
                  />
                  <span className={isInternalNote ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                    {isInternalNote ? 'Internal Note (not visible to customer)' : 'Public Reply'}
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={isInternalNote ? "Add an internal note..." : "Type your reply..."}
                  className="flex-1 min-h-[80px] resize-none"
                />
                <Button 
                  onClick={onSendReply}
                  disabled={!replyText.trim() || sendingReply}
                  className="bg-[#082c59] hover:bg-[#0a3a75]"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="w-72 border-l bg-slate-50 p-4 overflow-auto">
            <h4 className="font-semibold text-sm mb-4">Ticket Details</h4>
            
            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Status</label>
                <Select value={ticket.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {TICKET_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Priority */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Priority</label>
                <Select value={ticket.priority} onValueChange={onPriorityChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {TICKET_PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Assigned To */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Assigned To</label>
                {ticket.assigned_to_name ? (
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-[#082c59] text-white">
                        {ticket.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{ticket.assigned_to_name}</span>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full justify-start" onClick={onAssign}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign Agent
                  </Button>
                )}
              </div>
              
              {/* Category */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Category</label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
                  {getCategoryIcon(ticket.category)}
                  <span className="text-sm capitalize">{ticket.category}</span>
                </div>
              </div>
              
              {/* Created */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Created</label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>
              
              {/* Tags */}
              {ticket.tags?.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="bg-white">
                        <Tag className="w-3 h-3 mr-1" />
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
