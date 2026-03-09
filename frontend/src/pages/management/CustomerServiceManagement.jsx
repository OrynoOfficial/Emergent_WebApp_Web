import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, CheckCircle, Search, RefreshCw, AlertTriangle, Inbox, Users, UserPlus, ArrowUpDown, X,
  SlidersHorizontal, Activity, BarChart2, Plus, Loader2, Send, Tag, Package, Bot,
  LayoutGrid, List, ChevronLeft, ChevronRight, Clock, User, Mail, Phone, Building2, Calendar,
  TrendingUp, FileText, Headphones
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES_LIST as TICKET_PRIORITIES,
  TICKET_STATUSES_LIST as TICKET_STATUSES,
  ITEMS_PER_PAGE,
  getStatusConfig, getPriorityConfig, getCategoryIcon, getTimeAgo
} from '@/components/customer-service/constants';
import { Pagination } from '@/components/customer-service/Pagination';
import { TeamTab } from '@/components/customer-service/TeamTab';
import { AssignModal, BulkAssignModal } from '@/components/customer-service/AssignModal';
import { AddMemberModal } from '@/components/customer-service/AddMemberModal';
import AIChatBot from '@/components/AIChatBot';

// Tag colors
const TAG_COLORS = {
  booking: 'bg-blue-100 text-blue-700 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  technical: 'bg-red-100 text-red-700 border-red-200',
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

// ========== Ticket Card (List) ==========
function AdminTicketCard({ ticket, isSelected, onSelect, onView, onAssign }) {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  return (
    <div data-testid={`ticket-card-${ticket.id}`}
      className={`p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg bg-gradient-to-r from-[#082c59]/[0.03] via-slate-50/50 to-slate-100/40 border border-slate-200/50 shadow-sm ${isSelected ? 'ring-2 ring-[#082c59]' : 'hover:border-[#082c59]/20'}`}
      onClick={onView}>
      <div className="flex items-start gap-3">
        <Checkbox checked={isSelected} onCheckedChange={(c) => onSelect(ticket.id, c)} onClick={(e) => e.stopPropagation()} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/50">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] h-5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`} />{ticket.priority}
                </Badge>
                {ticket.user_type === 'operator' && <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] h-5"><Building2 className="w-3 h-3 mr-1" />Operator</Badge>}
              </div>
              <h3 className="font-semibold text-sm text-slate-800 truncate">{ticket.subject}</h3>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.text} text-xs gap-1 shrink-0 px-2.5 py-1`}>{statusConfig.icon}{ticket.status.replace('_', ' ')}</Badge>
          </div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {ticket.tags?.slice(0, 4).map((tag, i) => <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(tag)}`}>{tag}</Badge>)}
            {ticket.product_involved && <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5 gap-0.5"><Package className="w-2.5 h-2.5" />{ticket.product_involved}</Badge>}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/40">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1 bg-white/60 px-2 py-0.5 rounded-md"><User className="w-3 h-3" />{ticket.customer_name}</span>
              <span className="flex items-center gap-1">{getCategoryIcon(ticket.category)}<span className="capitalize">{ticket.category}</span></span>
              <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" />{getTimeAgo(ticket.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              {ticket.assigned_to_name ? (
                <span className="flex items-center gap-1.5 text-xs bg-white/60 px-2 py-1 rounded-full border border-slate-200/30">
                  <Avatar className="w-4 h-4"><AvatarFallback className="text-[8px] bg-[#082c59] text-white">{ticket.assigned_to_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                  {ticket.assigned_to_name}
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500 hover:text-[#082c59]" onClick={(e) => { e.stopPropagation(); onAssign(ticket); }}>
                  <UserPlus className="w-3 h-3 mr-1" />Assign
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Ticket Card (Grid) ==========
function AdminTicketCardGrid({ ticket, onView }) {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  return (
    <div className="bg-gradient-to-br from-[#082c59]/[0.03] to-slate-100/60 rounded-xl border border-slate-200/50 p-4 hover:shadow-lg hover:border-[#082c59]/20 transition-all cursor-pointer group shadow-sm"
      onClick={onView} data-testid={`ticket-card-grid-${ticket.id}`}>
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] h-5`}><span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`} />{ticket.priority}</Badge>
        <Badge className={`${statusConfig.bg} ${statusConfig.text} text-[10px] gap-1`}>{statusConfig.icon}{ticket.status.replace('_',' ')}</Badge>
      </div>
      <h3 className="font-semibold text-sm text-slate-800 group-hover:text-[#082c59] line-clamp-2 mb-2">{ticket.subject}</h3>
      <div className="flex flex-wrap gap-1 mb-2">
        {ticket.tags?.slice(0,2).map((t,i) => <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(t)}`}>{t}</Badge>)}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/40">
        <span className="font-mono">{ticket.ticket_number}</span>
        <span>{ticket.customer_name}</span>
      </div>
    </div>
  );
}

// ========== Admin Ticket Detail Modal ==========
function AdminTicketDetailModal({ open, onOpenChange, ticket, teamMembers, onStatusChange, onPriorityChange, onAssign, replyText, onReplyChange, isInternalNote, onInternalNoteChange, onSendReply, sendingReply }) {
  if (!ticket) return null;
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const statusColors = { open: 'bg-sky-50 border-sky-200', pending: 'bg-amber-50 border-amber-200', in_progress: 'bg-violet-50 border-violet-200', resolved: 'bg-emerald-50 border-emerald-200', closed: 'bg-slate-50 border-slate-200' };
  const priorityColors = { low: 'bg-slate-50 border-slate-200', medium: 'bg-blue-50 border-blue-200', high: 'bg-orange-50 border-orange-200', urgent: 'bg-red-50 border-red-200' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col border-0 shadow-2xl rounded-2xl bg-gradient-to-b from-[#082c59]/[0.04] to-slate-100/80 [&>button]:hidden">
        <div className="px-6 py-4 border-b border-slate-200/60 bg-gradient-to-r from-[#082c59]/[0.06] to-slate-100/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/50">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} gap-1 text-xs`}><span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />{ticket.priority}</Badge>
                <Badge className={`${statusConfig.bg} ${statusConfig.text} gap-1 text-xs`}>{statusConfig.icon}{ticket.status.replace('_', ' ')}</Badge>
                {ticket.user_type === 'operator' && <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100"><Building2 className="w-3 h-3 mr-1" />Operator</Badge>}
              </div>
              <DialogTitle className="text-lg">{ticket.subject}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">Created {getTimeAgo(ticket.created_at)} by {ticket.customer_name}</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-slate-600">Close</Button>
          </div>
          {(ticket.tags?.length > 0 || ticket.product_involved) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {ticket.product_involved && <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-xs gap-1"><Package className="w-3 h-3" />{ticket.product_involved}</Badge>}
              {ticket.tags?.map((tag,i) => <Badge key={i} className={`text-[10px] border ${getTagColor(tag)}`}><Tag className="w-2.5 h-2.5 mr-1" />{tag}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-5">
              {/* Original message */}
              <div className="mb-5 p-4 rounded-xl bg-white/50 border border-slate-200/40 shadow-sm">
                <div className="flex items-start gap-3 mb-2">
                  <Avatar className="w-8 h-8"><AvatarFallback className="bg-[#082c59] text-white text-xs">{ticket.customer_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between"><span className="font-semibold text-sm">{ticket.customer_name}</span><span className="text-[10px] text-slate-400">{getTimeAgo(ticket.created_at)}</span></div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      {ticket.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{ticket.customer_email}</span>}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>
              {/* Responses */}
              {ticket.responses?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" />Conversation ({ticket.responses.length})</h4>
                  {ticket.responses.map((r, idx) => (
                    <div key={idx} className={`p-3.5 rounded-xl shadow-sm ${r.is_internal ? 'bg-amber-50/70 border border-amber-200/50 ml-2' : r.is_staff ? 'bg-[#082c59]/[0.06] border border-[#082c59]/10 ml-4' : 'bg-white/60 border border-slate-200/40 mr-4'}`}>
                      <div className="flex items-start gap-2.5">
                        <Avatar className="w-6 h-6"><AvatarFallback className={`text-[9px] ${r.is_staff ? 'bg-[#082c59] text-white' : 'bg-slate-200'}`}>{r.author_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs">{r.author_name}</span>
                              {r.is_internal && <Badge className="bg-amber-100 text-amber-700 text-[9px] h-4">Internal</Badge>}
                              {r.is_staff && !r.is_internal && <Badge className="bg-[#082c59]/10 text-[#082c59] text-[9px] h-4">Staff</Badge>}
                            </div>
                            <span className="text-[10px] text-slate-400">{getTimeAgo(r.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {/* Reply */}
            <div className="p-4 border-t border-slate-200/60 bg-white/40">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox checked={isInternalNote} onCheckedChange={onInternalNoteChange} />
                  <span className={isInternalNote ? 'text-amber-600 font-medium' : 'text-slate-500'}>{isInternalNote ? 'Internal Note' : 'Public Reply'}</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Textarea value={replyText} onChange={(e) => onReplyChange(e.target.value)} placeholder={isInternalNote ? "Internal note..." : "Reply..."} className="flex-1 min-h-[60px] resize-none bg-white/70" />
                <Button onClick={onSendReply} disabled={!replyText?.trim() || sendingReply} className="bg-[#082c59] hover:bg-[#0a3a75] self-end">
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          {/* Sidebar */}
          <div className="w-56 border-l border-slate-200/40 bg-slate-50/30 p-4 overflow-auto hidden lg:block">
            <h4 className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider mb-3">Details</h4>
            <div className="space-y-3">
              <div><label className="text-[10px] text-slate-400 block mb-1">Status</label>
                <div className={`p-1.5 rounded-lg border ${statusColors[ticket.status] || ''}`}>
                  <Select value={ticket.status} onValueChange={onStatusChange}><SelectTrigger className="h-7 text-xs bg-transparent border-0 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">{TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Priority</label>
                <div className={`p-1.5 rounded-lg border ${priorityColors[ticket.priority] || ''}`}>
                  <Select value={ticket.priority} onValueChange={onPriorityChange}><SelectTrigger className="h-7 text-xs bg-transparent border-0 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">{TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Assigned To</label>
                {ticket.assigned_to_name ? (
                  <div className="flex items-center gap-2 p-2 bg-[#082c59]/5 rounded-lg border border-[#082c59]/10 text-xs">
                    <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px] bg-[#082c59] text-white">{ticket.assigned_to_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                    <span>{ticket.assigned_to_name}</span>
                  </div>
                ) : <Button variant="outline" className="w-full justify-start h-7 text-xs" onClick={onAssign}><UserPlus className="w-3 h-3 mr-1" />Assign</Button>}
              </div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Requester</label>
                <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 text-xs space-y-0.5">
                  <p className="font-medium">{ticket.customer_name}</p>
                  {ticket.customer_email && <p className="text-slate-500 truncate">{ticket.customer_email}</p>}
                  <Badge className="text-[9px] bg-slate-100 text-slate-600 capitalize">{ticket.user_type || 'customer'}</Badge>
                </div>
              </div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Category</label>
                <div className="flex items-center gap-2 p-2 bg-amber-50/50 rounded-lg border border-amber-100/50 text-xs">{getCategoryIcon(ticket.category)}<span className="capitalize">{ticket.category}</span></div>
              </div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Created</label>
                <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg border border-slate-200/40 text-xs"><Calendar className="w-3 h-3 text-slate-400" />{new Date(ticket.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Statistics Tab ==========
function StatisticsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get('/support-tickets/stats/detailed'); setStats(r.data); }
      catch { toast.error('Failed to load statistics'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#082c59]" /></div>;
  if (!stats) return <p className="text-slate-500 text-center py-12">No statistics available</p>;

  const priorityColors = { low: 'bg-slate-100 text-slate-700', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#082c59]/10 to-[#082c59]/[0.03] rounded-xl p-5 border border-[#082c59]/10">
          <p className="text-3xl font-bold text-[#082c59]">{stats.total}</p>
          <p className="text-sm text-slate-600 mt-1">Total Tickets</p>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/30 rounded-xl p-5 border border-sky-200/50 cursor-pointer hover:shadow-md" onClick={() => setExpandedSection(expandedSection === 'customer' ? null : 'customer')}>
          <p className="text-3xl font-bold text-sky-700">{stats.customer_total}</p>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><User className="w-3.5 h-3.5" />Customer Tickets</p>
          <p className="text-[10px] text-sky-600 mt-1">Click to expand</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 rounded-xl p-5 border border-indigo-200/50 cursor-pointer hover:shadow-md" onClick={() => setExpandedSection(expandedSection === 'operator' ? null : 'operator')}>
          <p className="text-3xl font-bold text-indigo-700">{stats.operator_total}</p>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />Operator Tickets</p>
          <p className="text-[10px] text-indigo-600 mt-1">Click to expand</p>
        </div>
      </div>

      {/* Expanded Customer/Operator breakdown */}
      {expandedSection === 'customer' && stats.customer_by_category?.length > 0 && (
        <div className="bg-gradient-to-b from-sky-50/60 to-white rounded-xl border border-sky-200/40 p-5 shadow-sm">
          <h3 className="font-semibold text-sm text-sky-800 mb-3 flex items-center gap-2"><User className="w-4 h-4" />Customer Tickets by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.customer_by_category.map(c => (
              <div key={c.category} className="bg-white/70 rounded-lg p-3 border border-slate-200/40">
                <p className="font-semibold text-sm capitalize text-slate-800">{c.category}</p>
                <p className="text-2xl font-bold text-sky-700 mt-1">{c.count}</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-amber-600">{c.open} open</span>
                  <span className="text-emerald-600">{c.resolved} resolved</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {expandedSection === 'operator' && stats.operator_by_category?.length > 0 && (
        <div className="bg-gradient-to-b from-indigo-50/60 to-white rounded-xl border border-indigo-200/40 p-5 shadow-sm">
          <h3 className="font-semibold text-sm text-indigo-800 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" />Operator Tickets by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.operator_by_category.map(c => (
              <div key={c.category} className="bg-white/70 rounded-lg p-3 border border-slate-200/40">
                <p className="font-semibold text-sm capitalize text-slate-800">{c.category}</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{c.count}</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-amber-600">{c.open} open</span>
                  <span className="text-emerald-600">{c.resolved} resolved</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Workload */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.04] to-slate-50/60 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/40 bg-[#082c59]/[0.04]">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Users className="w-4 h-4 text-[#082c59]" />Team Workload</h3>
        </div>
        <div className="p-5">
          {stats.team_workload.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No tickets assigned to team members yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.team_workload.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-4 bg-white/50 rounded-xl border border-slate-200/40 shadow-sm">
                  <Avatar className="w-10 h-10"><AvatarFallback className="bg-[#082c59] text-white">{m.name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.total} tickets assigned</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200/50">
                      <p className="text-lg font-bold text-amber-700">{m.open}</p>
                      <p className="text-[9px] text-amber-600">Open</p>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-violet-50 rounded-lg border border-violet-200/50">
                      <p className="text-lg font-bold text-violet-700">{m.in_progress}</p>
                      <p className="text-[9px] text-violet-600">Active</p>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200/50">
                      <p className="text-lg font-bold text-emerald-700">{m.resolved}</p>
                      <p className="text-[9px] text-emerald-600">Done</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/50 rounded-xl border border-slate-200/40 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#082c59]" />By Priority</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.by_priority.map(p => (
            <div key={p.priority} className="bg-white/60 rounded-lg p-3 border border-slate-200/40">
              <Badge className={`${priorityColors[p.priority] || 'bg-slate-100'} text-xs capitalize mb-2`}>{p.priority}</Badge>
              <p className="text-2xl font-bold text-slate-800">{p.count}</p>
              <div className="flex gap-2 mt-1 text-[10px]">
                <span className="text-amber-600">{p.open} open</span>
                <span className="text-violet-600">{p.in_progress} active</span>
                <span className="text-emerald-600">{p.resolved} done</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== Create on Behalf Modal (Compact) ==========
function CreateOnBehalfModal({ open, onOpenChange, onCreated }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState({ categories: [], products: [] });
  const [form, setForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium', on_behalf_of_id: '', on_behalf_of_type: 'customer', product_involved: '', service_tag: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/support-tickets/users-for-behalf').then(r => setUsers(r.data?.users || [])).catch(() => {});
      api.get('/support-tickets/products').then(r => setProducts(r.data)).catch(() => {});
    }
  }, [open]);

  const filteredUsers = users.filter(u => u.role === form.on_behalf_of_type && (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())));

  const handleSubmit = async () => {
    if (!form.subject || !form.description || !form.on_behalf_of_id) { toast.error('Fill subject, description, and select user'); return; }
    setCreating(true);
    try { await api.post('/support-tickets/create-on-behalf', form); toast.success('Ticket created'); onOpenChange(false); onCreated(); setForm({ subject: '', description: '', category: 'general', priority: 'medium', on_behalf_of_id: '', on_behalf_of_type: 'customer', product_involved: '', service_tag: '' }); }
    catch { toast.error('Failed to create'); }
    finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50 border border-slate-200 shadow-2xl rounded-2xl p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200/60 bg-[#082c59]/[0.04]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 bg-[#082c59]/10 rounded-lg flex items-center justify-center"><Plus className="h-3.5 w-3.5 text-[#082c59]" /></div>
            Create Ticket on Behalf
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">Create a support ticket for a customer or operator</DialogDescription>
        </div>
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-3">
            {/* User type toggle */}
            <div className="flex gap-1.5 p-0.5 bg-slate-100/80 rounded-lg border border-slate-200/50">
              <button onClick={() => setForm(p => ({...p, on_behalf_of_type: 'customer', on_behalf_of_id: ''}))} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${form.on_behalf_of_type === 'customer' ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600'}`}>Customer</button>
              <button onClick={() => setForm(p => ({...p, on_behalf_of_type: 'operator', on_behalf_of_id: ''}))} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${form.on_behalf_of_type === 'operator' ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600'}`}>Operator</button>
            </div>
            {/* User search */}
            <Input placeholder="Search user..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs bg-white/70" />
            <div className="max-h-24 overflow-y-auto border border-slate-200/50 rounded-lg divide-y divide-slate-100">
              {filteredUsers.slice(0,5).map(u => (
                <button key={u.id} onClick={() => setForm(p => ({...p, on_behalf_of_id: u.id}))} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${form.on_behalf_of_id === u.id ? 'bg-[#082c59]/5 border-l-2 border-l-[#082c59]' : ''}`}>
                  <span className="font-medium">{u.name}</span> <span className="text-slate-400">{u.email}</span>
                </button>
              ))}
              {filteredUsers.length === 0 && <p className="text-[10px] text-slate-400 text-center py-2">No users found</p>}
            </div>
            <Input placeholder="Subject *" value={form.subject} onChange={(e) => setForm(p => ({...p, subject: e.target.value}))} className="h-8 text-xs bg-white/70" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.category} onValueChange={(v) => setForm(p => ({...p, category: v}))}>
                <SelectTrigger className="h-8 text-xs bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{TICKET_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={(v) => setForm(p => ({...p, priority: v}))}>
                <SelectTrigger className="h-8 text-xs bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.service_tag || 'none'} onValueChange={(v) => setForm(p => ({...p, service_tag: v === 'none' ? '' : v}))}>
                <SelectTrigger className="h-8 text-xs bg-white/70"><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="none" className="text-xs">None</SelectItem>{(products.categories||[]).map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.product_involved || 'none'} onValueChange={(v) => setForm(p => ({...p, product_involved: v === 'none' ? '' : v}))}>
                <SelectTrigger className="h-8 text-xs bg-white/70"><SelectValue placeholder="Product" /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="none" className="text-xs">None</SelectItem>{(products.products||[]).filter(p => !form.service_tag || p.category === form.service_tag).map(p => <SelectItem key={p.id} value={p.name} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Description *" value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} rows={3} className="text-xs bg-white/70" />
          </div>
        </ScrollArea>
        <div className="px-5 py-3 border-t border-slate-200/60 flex justify-end gap-2 bg-white/40">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={creating} className="bg-[#082c59] hover:bg-[#0a3a75] text-xs h-8 gap-1.5">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Component ==========
export default function CustomerServiceManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');
  const [ticketSubTab, setTicketSubTab] = useState('open');
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [ticketToAssign, setTicketToAssign] = useState(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatBotOpen, setChatBotOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const getSubTabStatuses = useCallback(() => {
    switch (ticketSubTab) { case 'open': return ['open','pending']; case 'in_progress': return ['in_progress']; case 'closed': return ['resolved','closed']; default: return []; }
  }, [ticketSubTab]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      getSubTabStatuses().forEach(s => params.append('status', s));
      if (searchTerm) params.append('search', searchTerm);
      params.append('sort_by', sortBy); params.append('sort_order', sortOrder);
      params.append('skip', String((currentPage - 1) * 8)); params.append('limit', '8');
      const r = await api.get(`/support-tickets/?${params.toString()}`);
      setTickets(r.data.tickets || []); setTotal(r.data.total || 0); setTotalPages(r.data.pages || 1);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, [searchTerm, sortBy, sortOrder, currentPage, getSubTabStatuses]);

  const loadStats = useCallback(async () => { try { const r = await api.get('/support-tickets/stats'); setStats(r.data); } catch {} }, []);
  const loadTeamMembers = useCallback(async () => { try { const r = await api.get('/support-tickets/team-members'); setTeamMembers(r.data.team_members || []); } catch {} }, []);

  useEffect(() => { loadTickets(); loadStats(); loadTeamMembers(); }, [loadTickets, loadStats, loadTeamMembers]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { setCurrentPage(1); setSelectedTickets([]); }, [ticketSubTab]);

  const handleSelectTicket = (id, checked) => setSelectedTickets(p => checked ? [...p, id] : p.filter(i => i !== id));
  const handleSelectAll = (checked) => setSelectedTickets(checked ? tickets.map(t => t.id) : []);

  const handleViewTicket = async (ticket) => {
    try { const r = await api.get(`/support-tickets/${ticket.id}`); setSelectedTicket(r.data); setShowDetailModal(true); }
    catch { toast.error('Failed to load ticket'); }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      await api.post(`/support-tickets/${selectedTicket.id}/reply`, { message: replyText, is_internal: isInternalNote });
      const r = await api.get(`/support-tickets/${selectedTicket.id}`); setSelectedTicket(r.data);
      setReplyText(''); setIsInternalNote(false); toast.success(isInternalNote ? 'Note added' : 'Reply sent'); loadTickets();
    } catch { toast.error('Failed to send reply'); }
    finally { setSendingReply(false); }
  };

  const handleStatusChange = async (s) => { if (!selectedTicket) return; try { await api.put(`/support-tickets/${selectedTicket.id}`, {status:s}); setSelectedTicket(p=>({...p,status:s})); loadTickets(); loadStats(); } catch { toast.error('Failed'); } };
  const handlePriorityChange = async (p) => { if (!selectedTicket) return; try { await api.put(`/support-tickets/${selectedTicket.id}`, {priority:p}); setSelectedTicket(prev=>({...prev,priority:p})); loadTickets(); } catch { toast.error('Failed'); } };

  const handleAssignTicket = async () => {
    if (!selectedAssignee || !ticketToAssign) return;
    const m = teamMembers.find(m => m.id === selectedAssignee);
    if (!m) return;
    try { await api.post(`/support-tickets/${ticketToAssign.id}/assign`, { assignee_id: m.id, assignee_name: m.name, notes: assignmentNotes }); toast.success(`Assigned to ${m.name}`); setShowAssignModal(false); setTicketToAssign(null); setSelectedAssignee(''); setAssignmentNotes(''); loadTickets(); loadStats(); }
    catch { toast.error('Failed'); }
  };

  const handleBulkAssign = async () => {
    if (!selectedAssignee || !selectedTickets.length) return;
    const m = teamMembers.find(m => m.id === selectedAssignee);
    if (!m) return;
    try { await api.post('/support-tickets/bulk-action', { ticket_ids: selectedTickets, action: 'assign', assignee_id: m.id, assignee_name: m.name }); toast.success(`${selectedTickets.length} tickets assigned`); setShowBulkAssignModal(false); setSelectedTickets([]); setSelectedAssignee(''); loadTickets(); loadStats(); }
    catch { toast.error('Failed'); }
  };

  const handleBulkStatusUpdate = async (s) => {
    if (!selectedTickets.length) return;
    try { await api.post('/support-tickets/bulk-action', { ticket_ids: selectedTickets, action: 'update_status', value: s }); toast.success(`${selectedTickets.length} updated`); setSelectedTickets([]); loadTickets(); loadStats(); }
    catch { toast.error('Failed'); }
  };

  const loadAvailableMembers = useCallback(async () => { try { const r = await api.get('/support-tickets/available-members'); setAvailableMembers(r.data.available_members || []); } catch {} }, []);
  const handleAddTeamMember = async (m) => { try { await api.post('/support-tickets/team-members', { user_id: m.id, name: m.name, email: m.email, role: m.role, department: m.department, type: m.type }); toast.success(`${m.name} added`); loadTeamMembers(); loadAvailableMembers(); } catch { toast.error('Failed'); } };
  const handleRemoveTeamMember = async (m) => { if (m.is_auto) { toast.error('Cannot remove auto-added'); return; } try { await api.delete(`/support-tickets/team-members/${m.id}`); toast.success('Removed'); loadTeamMembers(); } catch { toast.error('Failed'); } };
  useEffect(() => { if (showAddMemberModal) loadAvailableMembers(); }, [showAddMemberModal, loadAvailableMembers]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Service Center</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage support tickets and team</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-[#082c59]/[0.06] p-1 rounded-xl border border-slate-200/50">
            {[{k:'tickets',l:'Tickets',i:Inbox},{k:'statistics',l:'Statistics',i:BarChart2},{k:'team',l:'Team',i:Users}].map(t => (
              <button key={t.k} onClick={() => setActiveTab(t.k)} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.k ? 'bg-[#082c59] text-white shadow-md' : 'text-slate-600 hover:text-[#082c59]'}`}>
                <t.i className="h-4 w-4" />{t.l}
              </button>
            ))}
          </div>

          {/* Action buttons for Tickets tab */}
          {activeTab === 'tickets' && (
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => setChatBotOpen(true)} className="gap-2 bg-white/70 shadow-sm border-slate-200 text-sm h-9">
                <Bot className="h-4 w-4 text-[#082c59]" />AI Assistant
              </Button>
              <Button onClick={() => setShowCreateModal(true)} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2 shadow-md text-sm h-9" data-testid="create-on-behalf-btn">
                <Plus className="w-4 h-4" />Create Ticket
              </Button>
            </div>
          )}
        </div>

        {/* ========== TICKETS TAB ========== */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex items-center gap-3">
              <div className="bg-[#082c59]/[0.04] rounded-xl p-1 inline-flex gap-1 border border-slate-200/40">
                {[{k:'open',l:'Open',c:`${(stats?.by_status?.open||0)+(stats?.by_status?.pending||0)}`,i:Inbox,active:'from-blue-500 to-blue-600'},
                  {k:'in_progress',l:'In Progress',c:`${stats?.by_status?.in_progress||0}`,i:Activity,active:'from-purple-500 to-purple-600'},
                  {k:'closed',l:'Closed',c:`${(stats?.by_status?.resolved||0)+(stats?.by_status?.closed||0)}`,i:CheckCircle,active:'from-green-500 to-green-600'}
                ].map(s => (
                  <button key={s.k} onClick={() => setTicketSubTab(s.k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${ticketSubTab === s.k ? `bg-gradient-to-r ${s.active} text-white shadow-md` : 'text-slate-600 hover:bg-slate-100'}`}>
                    <s.i className="w-4 h-4" />{s.l}<Badge className={`ml-1 ${ticketSubTab === s.k ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'} text-xs h-5 min-w-[20px]`}>{s.c}</Badge>
                  </button>
                ))}
              </div>
              <div className="flex bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/50 ml-auto">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#082c59]' : 'text-slate-400'}`}><List className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#082c59]' : 'text-slate-400'}`}><LayoutGrid className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-3 items-center">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white/70 border-slate-200 shadow-sm" /></div>
              <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-36 bg-white/70 shadow-sm"><ArrowUpDown className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="created_at">Date Created</SelectItem><SelectItem value="updated_at">Last Updated</SelectItem><SelectItem value="priority">Priority</SelectItem></SelectContent></Select>
              <Button variant="outline" size="icon" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} className="bg-white/70">{sortOrder === 'desc' ? '↓' : '↑'}</Button>
            </div>

            {/* Bulk Actions */}
            {selectedTickets.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200/50 rounded-xl">
                <span className="text-sm font-medium text-blue-800">{selectedTickets.length} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="bg-white h-8 text-xs" onClick={() => setShowBulkAssignModal(true)}><UserPlus className="w-3.5 h-3.5 mr-1" />Assign</Button>
                  <Select onValueChange={handleBulkStatusUpdate}><SelectTrigger className="w-32 h-8 bg-white text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent className="bg-white">{TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedTickets([])}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* Tickets Count */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing <b className="text-[#082c59]">{tickets.length}</b> of <b className="text-[#082c59]">{total}</b></span>
              <div className="flex items-center gap-2"><Checkbox checked={selectedTickets.length === tickets.length && tickets.length > 0} onCheckedChange={handleSelectAll} /><span>Select all</span></div>
            </div>

            {/* Tickets */}
            {loading ? (
              <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-[#082c59]" /></div>
            ) : tickets.length === 0 ? (
              <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/60 rounded-xl border border-dashed border-slate-200 py-16 text-center">
                <Inbox className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-700">No tickets found</h3>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tickets.map(t => <AdminTicketCardGrid key={t.id} ticket={t} onView={() => handleViewTicket(t)} />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {tickets.map(t => <AdminTicketCard key={t.id} ticket={t} isSelected={selectedTickets.includes(t.id)} onSelect={handleSelectTicket} onView={() => handleViewTicket(t)} onAssign={(t) => { setTicketToAssign(t); setShowAssignModal(true); }} />)}
              </div>
            )}

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}

        {/* ========== STATISTICS TAB ========== */}
        {activeTab === 'statistics' && <StatisticsTab />}

        {/* ========== TEAM TAB ========== */}
        {activeTab === 'team' && (
          <TeamTab teamMembers={teamMembers} onAddMember={() => setShowAddMemberModal(true)} onRemoveMember={handleRemoveTeamMember} onRefresh={loadTeamMembers} />
        )}
      </div>

      {/* Modals */}
      <AddMemberModal open={showAddMemberModal} onOpenChange={setShowAddMemberModal} availableMembers={availableMembers} searchTerm={memberSearchTerm} onSearchChange={setMemberSearchTerm} onAddMember={handleAddTeamMember} />
      <AdminTicketDetailModal open={showDetailModal} onOpenChange={setShowDetailModal} ticket={selectedTicket} teamMembers={teamMembers} onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange}
        onAssign={() => { setTicketToAssign(selectedTicket); setShowAssignModal(true); }} replyText={replyText} onReplyChange={setReplyText} isInternalNote={isInternalNote} onInternalNoteChange={setIsInternalNote} onSendReply={handleSendReply} sendingReply={sendingReply} />
      <AssignModal open={showAssignModal} onOpenChange={(o) => { setShowAssignModal(o); if (!o) { setTicketToAssign(null); setSelectedAssignee(''); setAssignmentNotes(''); } }} ticket={ticketToAssign} teamMembers={teamMembers} selectedAssignee={selectedAssignee} onAssigneeChange={setSelectedAssignee} notes={assignmentNotes} onNotesChange={setAssignmentNotes} onAssign={handleAssignTicket} />
      <BulkAssignModal open={showBulkAssignModal} onOpenChange={(o) => { setShowBulkAssignModal(o); if (!o) setSelectedAssignee(''); }} selectedCount={selectedTickets.length} teamMembers={teamMembers} selectedAssignee={selectedAssignee} onAssigneeChange={setSelectedAssignee} onAssign={handleBulkAssign} />
      <CreateOnBehalfModal open={showCreateModal} onOpenChange={setShowCreateModal} onCreated={() => { loadTickets(); loadStats(); }} />
      <AIChatBot isOpen={chatBotOpen} onClose={() => setChatBotOpen(false)} onCreateTicket={() => { setChatBotOpen(false); setShowCreateModal(true); }} />
    </div>
  );
}
