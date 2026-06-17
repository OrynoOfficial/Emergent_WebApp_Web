import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
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
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import TicketReplyBox from '@/components/TicketReplyBox';

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
  'waiting-for-admin': 'bg-orange-100 text-orange-700 border-orange-200',
  'waiting-for-user': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'closed': 'bg-slate-200 text-slate-700 border-slate-300',
  're-opened': 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
const getTagColor = (tag) => TAG_COLORS[tag?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';

// ========== Ticket Card (List) ==========
function AdminTicketCard({ ticket, isSelected, onSelect, onView, onAssign }) {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  return (
    <div data-testid={`ticket-card-${ticket.id}`}
      className={`p-3 rounded-lg transition-all cursor-pointer hover:shadow-md bg-white border border-slate-200 shadow-sm ${isSelected ? 'ring-2 ring-[#082c59]' : 'hover:border-[#082c59]/30'}`}
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
  const priorityBorderColor = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#cbd5e1',
  }[ticket.priority] || '#cbd5e1';
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md hover:border-[#082c59]/30 transition-all cursor-pointer group shadow-sm overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: priorityBorderColor }}
      onClick={onView} data-testid={`ticket-card-grid-${ticket.id}`}>
      {/* Header: Priority + Status */}
      <div className="flex items-center justify-between mb-2.5">
        <Badge className={`${priorityConfig.bg} ${priorityConfig.text} text-[10px] h-5`}><span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} mr-1`} />{ticket.priority}</Badge>
        <Badge className={`${statusConfig.bg} ${statusConfig.text} text-[10px] gap-1`}>{statusConfig.icon}{ticket.status.replace('_',' ')}</Badge>
      </div>
      {/* Ticket number + Operator badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded">{ticket.ticket_number}</span>
        {ticket.user_type === 'operator' && <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] h-4"><Building2 className="w-2.5 h-2.5 mr-0.5" />Operator</Badge>}
      </div>
      {/* Subject */}
      <h3 className="font-semibold text-sm text-slate-800 group-hover:text-[#082c59] line-clamp-2 mb-1.5 leading-snug">{ticket.subject}</h3>
      {/* Description snippet */}
      <p className="text-[11px] text-slate-500 line-clamp-2 mb-2.5 leading-relaxed">{ticket.description || 'No description'}</p>
      {/* Tags + Product */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {ticket.product_involved && <Badge className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 h-5 gap-0.5"><Package className="w-2.5 h-2.5" />{ticket.product_involved}</Badge>}
        {ticket.tags?.slice(0, 3).map((t, i) => <Badge key={i} className={`text-[9px] border h-5 ${getTagColor(t)}`}>{t}</Badge>)}
        {ticket.tags?.length > 3 && <span className="text-[9px] text-slate-400 self-center">+{ticket.tags.length - 3}</span>}
      </div>
      {/* Category + Time row */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2.5">
        <span className="flex items-center gap-1">{getCategoryIcon(ticket.category)}<span className="capitalize">{ticket.category}</span></span>
        <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" />{getTimeAgo(ticket.created_at)}</span>
      </div>
      {/* Footer: Customer + Assigned */}
      <div className="pt-2.5 border-t border-slate-200/50 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-[11px] font-medium text-slate-700 truncate">{ticket.customer_name}</span>
          {ticket.customer_email && <span className="text-[10px] text-slate-400 truncate hidden xl:inline">({ticket.customer_email})</span>}
        </div>
        {ticket.assigned_to_name ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="w-4 h-4"><AvatarFallback className="text-[7px] bg-[#082c59] text-white">{ticket.assigned_to_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
            <span className="text-[10px] text-slate-500">{ticket.assigned_to_name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <UserPlus className="w-3 h-3" />
            <span>Unassigned</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Admin Ticket Detail Modal ==========
function AdminTicketDetailModal({ open, onOpenChange, ticket, onStatusChange, onPriorityChange, onAssign, onRefreshTicket }) {
  if (!ticket) return null;
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] max-h-[92vh] p-0 overflow-hidden flex flex-col border-0 shadow-2xl rounded-2xl bg-white [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── Header — deep navy banner with strong contrast against body ── */}
        <div className="px-6 py-5 bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#082c59] text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_white_0%,_transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-white/90 bg-white/15 backdrop-blur-sm px-2 py-1 rounded-md border border-white/20">{ticket.ticket_number}</span>
                <Badge className={`${priorityConfig.bg} ${priorityConfig.text} gap-1 text-xs border-0`}><span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />{ticket.priority}</Badge>
                <Badge className={`${statusConfig.bg} ${statusConfig.text} gap-1 text-xs border-0`}>{statusConfig.icon}{ticket.status.replace('_', ' ')}</Badge>
                {ticket.user_type === 'operator' && <Badge className="bg-indigo-500/20 text-indigo-100 border border-indigo-300/30"><Building2 className="w-3 h-3 mr-1" />Operator</Badge>}
              </div>
              <DialogTitle className="text-xl text-white">{ticket.subject}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-white/70">Created {getTimeAgo(ticket.created_at)} by {ticket.customer_name}</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-white/80 hover:bg-white/15 hover:text-white">Close</Button>
          </div>
          {(ticket.tags?.length > 0 || ticket.product_involved) && (
            <div className="relative flex items-center gap-1.5 mt-3 flex-wrap">
              {ticket.product_involved && <Badge className="bg-blue-500/25 text-blue-50 border border-blue-300/30 text-xs gap-1"><Package className="w-3 h-3" />{ticket.product_involved}</Badge>}
              {ticket.tags?.map((tag,i) => <Badge key={i} className="text-[10px] bg-white/15 text-white border border-white/20"><Tag className="w-2.5 h-2.5 mr-1" />{tag}</Badge>)}
            </div>
          )}
        </div>
        {/* ── Body — main conversation + 2-col detail sidebar on lg ──── */}
        <div className="flex flex-1 overflow-hidden bg-slate-50">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {/* Original message */}
              <div className="mb-5 p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border-2 border-slate-200 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-10 h-10 ring-2 ring-[#082c59]/10"><AvatarFallback className="bg-[#082c59] text-white text-sm font-semibold">{ticket.customer_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between"><span className="font-semibold text-sm text-slate-900">{ticket.customer_name}</span><span className="text-[11px] text-slate-500">{getTimeAgo(ticket.created_at)}</span></div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      {ticket.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{ticket.customer_email}</span>}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>
              {/* Responses */}
              {ticket.messages?.length > 1 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" />Conversation ({ticket.messages.length - 1})</h4>
                  {ticket.messages.slice(1).map((r, idx) => (
                    r.is_system ? (
                      <div key={idx} className="flex items-center gap-2 py-0.5 pl-8">
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${getTagColor(r.tag?.toLowerCase().replace(/ /g, '-') || '')}`}>{r.tag || r.message}</span>
                      </div>
                    ) : (
                    <div key={idx} className={`p-4 rounded-xl shadow-sm border-2 ${r.is_internal ? 'bg-amber-50 border-amber-300 ml-2' : r.sender_type === 'agent' ? 'bg-[#082c59]/[0.06] border-[#082c59]/20 ml-6' : 'bg-white border-slate-200 mr-6'}`}>
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8"><AvatarFallback className={`text-[10px] font-semibold ${r.sender_type === 'agent' ? 'bg-[#082c59] text-white' : 'bg-slate-300 text-slate-700'}`}>{r.sender_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900">{r.sender_name}</span>
                              {r.is_internal && <Badge className="bg-amber-200 text-amber-800 text-[9px] h-4 border-0">Internal</Badge>}
                              {r.sender_type === 'agent' && !r.is_internal && <Badge className="bg-[#082c59] text-white text-[9px] h-4 border-0">Staff</Badge>}
                            </div>
                            <span className="text-[10px] text-slate-400">{getTimeAgo(r.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                          {r.attachments?.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2">
                              {r.attachments.map((att, ai) => (
                                <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                  <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    )
                  ))}
                </div>
              )}
            </div>
            {/* Reply */}
            <TicketReplyBox ticketId={ticket.id} showInternalToggle onReplySent={onRefreshTicket} />
          </div>
          {/* Sidebar — 2-col details on lg+ to use the new 5xl width */}
          <div className="w-[22rem] border-l border-slate-200 bg-slate-100 p-5 overflow-auto hidden lg:block">
            <h4 className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider mb-3">Ticket details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-sky-200 shadow-sm p-3 col-span-2">
                <label className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider block mb-1">Status</label>
                <Select value={ticket.status} onValueChange={onStatusChange}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">{TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-3">
                <label className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider block mb-1">Priority</label>
                <Select value={ticket.priority} onValueChange={onPriorityChange}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">{TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-3">
                <label className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block mb-1">Category</label>
                <div className="flex items-center gap-2 text-xs text-slate-700">{getCategoryIcon(ticket.category)}<span className="capitalize truncate">{ticket.category}</span></div>
              </div>
              <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-3 col-span-2">
                <label className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider block mb-1">Assigned To</label>
                {ticket.assigned_to_name ? (
                  <div className="flex items-center gap-2 text-xs text-slate-800">
                    <Avatar className="w-6 h-6"><AvatarFallback className="text-[9px] bg-violet-600 text-white">{ticket.assigned_to_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                    <span className="font-medium truncate">{ticket.assigned_to_name}</span>
                  </div>
                ) : <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" onClick={onAssign}><UserPlus className="w-3 h-3 mr-1" />Assign agent</Button>}
              </div>
              <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-3 col-span-2">
                <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider block mb-2">Requester</label>
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-slate-900">{ticket.customer_name}</p>
                  {ticket.customer_email && <p className="text-slate-500 truncate flex items-center gap-1"><Mail className="w-3 h-3" />{ticket.customer_email}</p>}
                  <Badge className="text-[9px] bg-indigo-100 text-indigo-700 border-0 capitalize">{ticket.user_type || 'customer'}</Badge>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-3 col-span-2">
                <label className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1">Created</label>
                <div className="flex items-center gap-2 text-xs text-slate-700"><Calendar className="w-3 h-3 text-emerald-600" />{new Date(ticket.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Statistics Tab (Enhanced) ==========
function StatisticsTab() {
  const [stats, setStats] = useState(null);
  const [basicStats, setBasicStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState({ dateRange: 'all', category: 'all', priority: 'all' });
  const [teamPage, setTeamPage] = useState(1);
  const TEAM_PER_PAGE = 4;

  useEffect(() => {
    (async () => {
      try {
        const [det, basic] = await Promise.all([
          api.get('/support-tickets/stats/detailed'),
          api.get('/support-tickets/stats')
        ]);
        setStats(det.data);
        setBasicStats(basic.data);
      } catch { toast.error('Failed to load statistics'); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#082c59]" /></div>;
  if (!stats) return <p className="text-slate-500 text-center py-12">No statistics available</p>;

  const priorityColors = { low: 'bg-slate-100 text-slate-700 border-slate-200', medium: 'bg-blue-100 text-blue-700 border-blue-200', high: 'bg-orange-100 text-orange-700 border-orange-200', urgent: 'bg-red-100 text-red-700 border-red-200' };
  const statusColors = { open: 'text-sky-700', pending: 'text-amber-700', in_progress: 'text-violet-700', resolved: 'text-emerald-700', closed: 'text-slate-500' };

  const paginatedTeam = stats.team_workload?.slice((teamPage - 1) * TEAM_PER_PAGE, teamPage * TEAM_PER_PAGE) || [];
  const teamTotalPages = Math.ceil((stats.team_workload?.length || 0) / TEAM_PER_PAGE);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filter.category} onValueChange={v => setFilter(p => ({...p, category: v}))}>
          <SelectTrigger className="w-36 h-8 text-xs bg-white/70 shadow-sm"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent className="bg-white"><SelectItem value="all" className="text-xs">All Categories</SelectItem>
            {TICKET_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter.priority} onValueChange={v => setFilter(p => ({...p, priority: v}))}>
          <SelectTrigger className="w-32 h-8 text-xs bg-white/70 shadow-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent className="bg-white"><SelectItem value="all" className="text-xs">All Priorities</SelectItem>
            {TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFilter({ dateRange: 'all', category: 'all', priority: 'all' })}>Clear Filters</Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-[#082c59]/10 to-[#082c59]/[0.03] rounded-xl p-4 border border-[#082c59]/10">
          <p className="text-2xl font-bold text-[#082c59]">{stats.total}</p><p className="text-xs text-slate-600 mt-0.5">Total Tickets</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 rounded-xl p-4 border border-amber-200/50">
          <p className="text-2xl font-bold text-amber-700">{basicStats?.unassigned || 0}</p><p className="text-xs text-slate-600 mt-0.5">Unassigned</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 rounded-xl p-4 border border-emerald-200/50">
          <p className="text-2xl font-bold text-emerald-700">{basicStats?.today || 0}</p><p className="text-xs text-slate-600 mt-0.5">Resolved Today</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100/30 rounded-xl p-4 border border-red-200/50">
          <p className="text-2xl font-bold text-red-700">{basicStats?.urgent || 0}</p><p className="text-xs text-slate-600 mt-0.5">Urgent</p>
        </div>
      </div>

      {/* ===== STATUS BREAKDOWN (Expandable L1 > L2 > L3) ===== */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.04] to-slate-50/60 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <button onClick={() => toggle('status')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-[#082c59]" />Status Breakdown</h3>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.status ? 'rotate-90' : ''}`} />
        </button>
        {expanded.status && (
          <div className="px-4 pb-4 space-y-2">
            {Object.entries(basicStats?.by_status || {}).map(([status, count]) => (
              <div key={status}>
                <button onClick={() => toggle(`status_${status}`)} className="w-full flex items-center justify-between p-3 bg-white/50 rounded-lg border border-slate-200/40 hover:bg-white/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge className={`capitalize text-xs ${statusColors[status] || ''} bg-slate-50`}>{status.replace('_',' ')}</Badge>
                    <span className="text-lg font-bold text-slate-800">{count}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded[`status_${status}`] ? 'rotate-90' : ''}`} />
                </button>
                {/* L3: Category within status */}
                {expanded[`status_${status}`] && (
                  <div className="ml-6 mt-1.5 space-y-1">
                    {TICKET_CATEGORIES.map(cat => {
                      const catCount = (stats.customer_by_category || []).find(c => c.category === cat)?.count || 0;
                      if (catCount === 0) return null;
                      return (
                        <div key={cat} className="flex items-center justify-between p-2 bg-slate-50/80 rounded-md text-xs">
                          <span className="capitalize text-slate-600">{cat}</span>
                          <span className="font-medium text-slate-800">{catCount}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CUSTOMER / OPERATOR TICKETS (Expandable L1 > L2 > L3) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Tickets */}
        <div className="bg-gradient-to-b from-sky-50/60 to-white rounded-xl border border-sky-200/40 shadow-sm overflow-hidden">
          <button onClick={() => toggle('customer')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg"><User className="w-4 h-4 text-sky-700" /></div>
              <div className="text-left"><p className="font-semibold text-sm text-slate-800">Customer Tickets</p><p className="text-xl font-bold text-sky-700">{stats.customer_total}</p></div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.customer ? 'rotate-90' : ''}`} />
          </button>
          {expanded.customer && (
            <div className="px-4 pb-4 space-y-1.5">
              {(stats.customer_by_category || []).map(c => (
                <div key={c.category}>
                  <button onClick={() => toggle(`cust_${c.category}`)} className="w-full flex items-center justify-between p-2.5 bg-white/60 rounded-lg border border-slate-200/30 hover:bg-white/90 text-xs">
                    <span className="capitalize font-medium text-slate-700">{c.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{c.count}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded[`cust_${c.category}`] ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {expanded[`cust_${c.category}`] && (
                    <div className="ml-4 mt-1 space-y-1">
                      <div className="flex justify-between p-1.5 bg-amber-50/50 rounded text-[10px]"><span className="text-amber-700">Open</span><span className="font-bold">{c.open}</span></div>
                      <div className="flex justify-between p-1.5 bg-emerald-50/50 rounded text-[10px]"><span className="text-emerald-700">Resolved</span><span className="font-bold">{c.resolved}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Operator Tickets */}
        <div className="bg-gradient-to-b from-indigo-50/60 to-white rounded-xl border border-indigo-200/40 shadow-sm overflow-hidden">
          <button onClick={() => toggle('operator')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg"><Building2 className="w-4 h-4 text-indigo-700" /></div>
              <div className="text-left"><p className="font-semibold text-sm text-slate-800">Operator Tickets</p><p className="text-xl font-bold text-indigo-700">{stats.operator_total}</p></div>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.operator ? 'rotate-90' : ''}`} />
          </button>
          {expanded.operator && (
            <div className="px-4 pb-4 space-y-1.5">
              {(stats.operator_by_category || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No operator tickets</p>
              ) : (stats.operator_by_category || []).map(c => (
                <div key={c.category}>
                  <button onClick={() => toggle(`op_${c.category}`)} className="w-full flex items-center justify-between p-2.5 bg-white/60 rounded-lg border border-slate-200/30 hover:bg-white/90 text-xs">
                    <span className="capitalize font-medium text-slate-700">{c.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{c.count}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded[`op_${c.category}`] ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {expanded[`op_${c.category}`] && (
                    <div className="ml-4 mt-1 space-y-1">
                      <div className="flex justify-between p-1.5 bg-amber-50/50 rounded text-[10px]"><span className="text-amber-700">Open</span><span className="font-bold">{c.open}</span></div>
                      <div className="flex justify-between p-1.5 bg-emerald-50/50 rounded text-[10px]"><span className="text-emerald-700">Resolved</span><span className="font-bold">{c.resolved}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== TEAM WORKLOAD (with pagination) ===== */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.04] to-slate-50/60 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/40 bg-[#082c59]/[0.04] flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2"><Users className="w-4 h-4 text-[#082c59]" />Team Workload ({stats.team_workload?.length || 0} members)</h3>
          {teamTotalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={teamPage === 1} onClick={() => setTeamPage(p => p - 1)} className="h-7 w-7 p-0"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <span className="text-xs text-slate-500 px-2">{teamPage}/{teamTotalPages}</span>
              <Button variant="outline" size="sm" disabled={teamPage === teamTotalPages} onClick={() => setTeamPage(p => p + 1)} className="h-7 w-7 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
        <div className="p-4">
          {paginatedTeam.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No tickets assigned to team members yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedTeam.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-4 bg-white/50 rounded-xl border border-slate-200/40 shadow-sm">
                  <Avatar className="w-10 h-10"><AvatarFallback className="bg-[#082c59] text-white">{m.name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.total} assigned</p>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="text-center px-2 py-1 bg-amber-50 rounded-lg border border-amber-200/50"><p className="text-sm font-bold text-amber-700">{m.open}</p><p className="text-[8px] text-amber-600">Open</p></div>
                    <div className="text-center px-2 py-1 bg-violet-50 rounded-lg border border-violet-200/50"><p className="text-sm font-bold text-violet-700">{m.in_progress}</p><p className="text-[8px] text-violet-600">Active</p></div>
                    <div className="text-center px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200/50"><p className="text-sm font-bold text-emerald-700">{m.resolved}</p><p className="text-[8px] text-emerald-600">Done</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== PRIORITY BREAKDOWN (Expandable) ===== */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/50 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <button onClick={() => toggle('priority')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#082c59]" />Priority Breakdown</h3>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.priority ? 'rotate-90' : ''}`} />
        </button>
        {expanded.priority && (
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.by_priority.map(p => (
              <div key={p.priority} className="bg-white/60 rounded-lg p-3 border border-slate-200/40">
                <Badge className={`${priorityColors[p.priority] || 'bg-slate-100'} border text-xs capitalize mb-2`}>{p.priority}</Badge>
                <p className="text-xl font-bold text-slate-800">{p.count}</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-amber-600">{p.open} open</span>
                  <span className="text-violet-600">{p.in_progress} active</span>
                  <span className="text-emerald-600">{p.resolved} done</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== SOURCE BREAKDOWN (Expandable) ===== */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/50 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <button onClick={() => toggle('source')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-[#082c59]" />Ticket Source & Trends</h3>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.source ? 'rotate-90' : ''}`} />
        </button>
        {expanded.source && (
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white/60 rounded-lg p-3 border border-slate-200/40">
              <p className="text-xs text-slate-500">Last 7 Days</p>
              <p className="text-xl font-bold text-[#082c59]">{basicStats?.recent_7_days || 0}</p>
              <p className="text-[10px] text-slate-400">new tickets</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3 border border-slate-200/40">
              <p className="text-xs text-slate-500">Today</p>
              <p className="text-xl font-bold text-emerald-700">{basicStats?.today || 0}</p>
              <p className="text-[10px] text-slate-400">tickets today</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3 border border-slate-200/40">
              <p className="text-xs text-slate-500">High Priority Active</p>
              <p className="text-xl font-bold text-red-700">{(basicStats?.urgent || 0) + (basicStats?.high_priority || 0)}</p>
              <p className="text-[10px] text-slate-400">need attention</p>
            </div>
          </div>
        )}
      </div>

      {/* ===== CATEGORY BREAKDOWN (Expandable with L3) ===== */}
      <div className="bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/50 rounded-xl border border-slate-200/40 shadow-sm overflow-hidden">
        <button onClick={() => toggle('categories')} className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2"><Tag className="w-4 h-4 text-[#082c59]" />Category Deep Dive</h3>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded.categories ? 'rotate-90' : ''}`} />
        </button>
        {expanded.categories && (
          <div className="px-4 pb-4 space-y-2">
            {Object.entries(basicStats?.by_category || {}).filter(([,v]) => v > 0).map(([cat, count]) => (
              <div key={cat}>
                <button onClick={() => toggle(`cat_${cat}`)} className="w-full flex items-center justify-between p-3 bg-white/50 rounded-lg border border-slate-200/40 hover:bg-white/80 transition-colors">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(cat)}
                    <span className="capitalize font-medium text-sm text-slate-700">{cat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-800">{count}</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded[`cat_${cat}`] ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {expanded[`cat_${cat}`] && (
                  <div className="ml-5 mt-1.5 space-y-1.5">
                    {/* L2: By user type */}
                    {['customer', 'operator'].map(utype => {
                      const data = utype === 'customer' ? stats.customer_by_category : stats.operator_by_category;
                      const catData = (data || []).find(c => c.category === cat);
                      if (!catData || catData.count === 0) return null;
                      return (
                        <div key={utype}>
                          <button onClick={() => toggle(`cat_${cat}_${utype}`)} className="w-full flex items-center justify-between p-2 bg-slate-50/80 rounded-md text-xs hover:bg-slate-100/80">
                            <span className="capitalize text-slate-600 flex items-center gap-1.5">{utype === 'customer' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}{utype}</span>
                            <div className="flex items-center gap-2"><span className="font-bold">{catData.count}</span><ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded[`cat_${cat}_${utype}`] ? 'rotate-90' : ''}`} /></div>
                          </button>
                          {/* L3: Open/Resolved detail */}
                          {expanded[`cat_${cat}_${utype}`] && (
                            <div className="ml-4 mt-1 space-y-0.5">
                              <div className="flex justify-between p-1.5 bg-amber-50/50 rounded text-[10px]"><span className="text-amber-700">Open</span><span className="font-bold">{catData.open}</span></div>
                              <div className="flex justify-between p-1.5 bg-emerald-50/50 rounded text-[10px]"><span className="text-emerald-700">Resolved</span><span className="font-bold">{catData.resolved}</span></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Create on Behalf Modal (Fixed) ==========
function CreateOnBehalfModal({ open, onOpenChange, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [operatorUsers, setOperatorUsers] = useState([]);
  const [custSearch, setCustSearch] = useState('');
  const [opSearch, setOpSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [selectedOpUser, setSelectedOpUser] = useState(null);
  const [products, setProducts] = useState({ categories: [], products: [] });
  const [form, setForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium', on_behalf_of_type: 'customer', product_involved: '', service_tag: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/support-tickets/products').then(r => setProducts(r.data)).catch(() => {});
      // Reset state
      setCustSearch(''); setOpSearch('');
      setCustomers([]); setOperators([]); setOperatorUsers([]);
      setSelectedCustomer(null); setSelectedOperator(null); setSelectedOpUser(null);
      setForm({ subject: '', description: '', category: 'general', priority: 'medium', on_behalf_of_type: 'customer', product_involved: '', service_tag: '' });
    }
  }, [open]);

  // Customer search (3+ chars)
  useEffect(() => {
    if (custSearch.length >= 3) {
      api.get(`/support-tickets/users-for-behalf?search=${custSearch}&user_type=customer`).then(r => setCustomers(r.data?.users || [])).catch(() => {});
    } else { setCustomers([]); }
  }, [custSearch]);

  // Operator search (3+ chars)
  useEffect(() => {
    if (opSearch.length >= 3) {
      api.get(`/support-tickets/operators-search?search=${opSearch}`).then(r => setOperators(r.data?.operators || [])).catch(() => {});
    } else { setOperators([]); }
  }, [opSearch]);

  // Load operator users when operator selected
  useEffect(() => {
    if (selectedOperator) {
      api.get(`/support-tickets/operator-users/${selectedOperator.id}`).then(r => {
        setOperatorUsers(r.data?.users || []);
        setSelectedOpUser(null);
      }).catch(() => setOperatorUsers([]));
    } else { setOperatorUsers([]); setSelectedOpUser(null); }
  }, [selectedOperator]);

  const handleSelectCustomer = (u) => { setSelectedCustomer(u); setCustSearch(u.name); };
  const handleSelectOperator = (op) => { setSelectedOperator(op); setOpSearch(op.name); };

  const getOnBehalfId = () => {
    if (form.on_behalf_of_type === 'customer') return selectedCustomer?.id || '';
    // For operator: use selected user if exists, otherwise use operator's owner
    return selectedOpUser?.id || selectedOperator?.id || '';
  };

  const handleSubmit = async () => {
    const onBehalfId = getOnBehalfId();
    if (!form.subject || !form.description || !onBehalfId) {
      toast.error(form.on_behalf_of_type === 'customer' ? 'Fill subject, description, and select a customer' : 'Fill subject, description, and select an operator');
      return;
    }
    setCreating(true);
    try {
      await api.post('/support-tickets/create-on-behalf', {
        ...form,
        on_behalf_of_id: onBehalfId,
        on_behalf_of_type: form.on_behalf_of_type,
        operator_id: selectedOperator?.id || null,
        operator_name: selectedOperator?.name || null,
      });
      toast.success('Ticket created');
      onOpenChange(false);
      onCreated();
    } catch { toast.error('Failed to create'); }
    finally { setCreating(false); }
  };

  const isCustomerTab = form.on_behalf_of_type === 'customer';

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
            {/* Tab toggle */}
            <div className="flex gap-1.5 p-0.5 bg-slate-100/80 rounded-lg border border-slate-200/50">
              <button onClick={() => { setForm(p => ({...p, on_behalf_of_type: 'customer'})); setSelectedOperator(null); setSelectedOpUser(null); setOpSearch(''); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${isCustomerTab ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600'}`}>Customer</button>
              <button onClick={() => { setForm(p => ({...p, on_behalf_of_type: 'operator'})); setSelectedCustomer(null); setCustSearch(''); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!isCustomerTab ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600'}`}>Operator</button>
            </div>

            {/* Customer search */}
            {isCustomerTab && (
              <>
                <div className="relative">
                  <Input placeholder="Search customer (min 3 chars)..." value={custSearch} onChange={(e) => { setCustSearch(e.target.value); if (selectedCustomer && e.target.value !== selectedCustomer.name) setSelectedCustomer(null); }} className="h-8 text-xs bg-white/70" />
                  {selectedCustomer && <Badge className="absolute right-2 top-1.5 bg-emerald-100 text-emerald-700 text-[9px] h-5"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />{selectedCustomer.name}</Badge>}
                </div>
                {custSearch.length >= 3 && !selectedCustomer && customers.length > 0 && (
                  <div className="max-h-24 overflow-y-auto border border-slate-200/50 rounded-lg divide-y divide-slate-100">
                    {customers.slice(0,5).map(u => (
                      <button key={u.id} onClick={() => handleSelectCustomer(u)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#082c59]/5 transition-colors">
                        <span className="font-medium text-slate-800">{u.name}</span> <span className="text-slate-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {custSearch.length >= 3 && customers.length === 0 && !selectedCustomer && (
                  <p className="text-[10px] text-slate-400 text-center py-1">No customers found</p>
                )}
                {custSearch.length > 0 && custSearch.length < 3 && (
                  <p className="text-[10px] text-slate-400 text-center py-1">Type at least 3 characters</p>
                )}
              </>
            )}

            {/* Operator search */}
            {!isCustomerTab && (
              <>
                <div className="relative">
                  <Input placeholder="Search operator (min 3 chars)..." value={opSearch} onChange={(e) => { setOpSearch(e.target.value); if (selectedOperator && e.target.value !== selectedOperator.name) { setSelectedOperator(null); setSelectedOpUser(null); } }} className="h-8 text-xs bg-white/70" />
                  {selectedOperator && <Badge className="absolute right-2 top-1.5 bg-indigo-100 text-indigo-700 text-[9px] h-5"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />{selectedOperator.name}</Badge>}
                </div>
                {opSearch.length >= 3 && !selectedOperator && operators.length > 0 && (
                  <div className="max-h-24 overflow-y-auto border border-slate-200/50 rounded-lg divide-y divide-slate-100">
                    {operators.slice(0,5).map(op => (
                      <button key={op.id} onClick={() => handleSelectOperator(op)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors">
                        <span className="font-medium text-slate-800">{op.name}</span> <span className="text-slate-400">{op.email}</span>
                        <Badge className="ml-2 text-[8px] bg-slate-100 text-slate-500">{op.operator_type}</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {opSearch.length >= 3 && operators.length === 0 && !selectedOperator && (
                  <p className="text-[10px] text-slate-400 text-center py-1">No operators found</p>
                )}
                {opSearch.length > 0 && opSearch.length < 3 && (
                  <p className="text-[10px] text-slate-400 text-center py-1">Type at least 3 characters</p>
                )}

                {/* Operator's users sub-section */}
                {selectedOperator && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Operator's User (optional)</label>
                    <Select value={selectedOpUser?.id || 'none'} onValueChange={(v) => {
                      if (v === 'none') { setSelectedOpUser(null); }
                      else { const u = operatorUsers.find(u => u.id === v); setSelectedOpUser(u || null); }
                    }}>
                      <SelectTrigger className="h-8 text-xs bg-white/70"><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="none" className="text-xs">None (use operator directly)</SelectItem>
                        {operatorUsers.map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">{u.name} — {u.position || 'Staff'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {operatorUsers.length === 0 && <p className="text-[9px] text-slate-400 mt-0.5">No users found for this operator</p>}
                  </div>
                )}
              </>
            )}

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
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatBotOpen, setChatBotOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [operatorFilter, setOperatorFilter] = useState('');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const getSubTabStatuses = useCallback(() => {
    switch (ticketSubTab) {
      case 'open': return ['open'];
      case 'pending': return ['pending'];
      case 'in_progress': return ['in_progress'];
      case 'resolved': return ['resolved'];
      case 'closed': return ['closed'];
      default: return [];
    }
  }, [ticketSubTab]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      getSubTabStatuses().forEach(s => params.append('status', s));
      if (searchTerm) params.append('search', searchTerm);
      if (operatorFilter) params.append('operator_id', operatorFilter);
      params.append('sort_by', sortBy); params.append('sort_order', sortOrder);
      params.append('skip', String((currentPage - 1) * 8)); params.append('limit', '8');
      const r = await api.get(`/support-tickets/?${params.toString()}`);
      setTickets(r.data.tickets || []); setTotal(r.data.total || 0); setTotalPages(r.data.pages || 1);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, [searchTerm, sortBy, sortOrder, currentPage, getSubTabStatuses, operatorFilter]);

  const loadStats = useCallback(async () => { try { const r = await api.get('/support-tickets/stats'); setStats(r.data); } catch { /* ignore */ } }, []);
  const loadTeamMembers = useCallback(async () => { try { const r = await api.get('/support-tickets/team-members'); setTeamMembers(r.data.team_members || []); } catch { /* ignore */ } }, []);

  useEffect(() => { loadTickets(); loadStats(); loadTeamMembers(); }, [loadTickets, loadStats, loadTeamMembers]);
  // Reset pagination when filters change (React-recommended: adjust state during render)
  const [prevSearchTerm, setPrevSearchTerm] = useState(searchTerm);
  if (searchTerm !== prevSearchTerm) { setPrevSearchTerm(searchTerm); setCurrentPage(1); }
  const [prevTicketSubTab, setPrevTicketSubTab] = useState(ticketSubTab);
  if (ticketSubTab !== prevTicketSubTab) { setPrevTicketSubTab(ticketSubTab); setCurrentPage(1); setSelectedTickets([]); }

  const handleSelectTicket = (id, checked) => setSelectedTickets(p => checked ? [...p, id] : p.filter(i => i !== id));
  const handleSelectAll = (checked) => setSelectedTickets(checked ? tickets.map(t => t.id) : []);

  const handleViewTicket = async (ticket) => {
    try { const r = await api.get(`/support-tickets/${ticket.id}`); setSelectedTicket(r.data); setShowDetailModal(true); }
    catch { toast.error('Failed to load ticket'); }
  };

  const handleStatusChange = async (s) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/support-tickets/${selectedTicket.id}`, { status: s });
      // Re-fetch the full ticket to get new system messages and tags
      const r = await api.get(`/support-tickets/${selectedTicket.id}`);
      setSelectedTicket(r.data);
      // Defer list refresh to avoid modal closure
      setTimeout(() => { loadTickets(); loadStats(); }, 100);
    } catch { toast.error('Failed to update status'); }
  };
  const handlePriorityChange = async (p) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/support-tickets/${selectedTicket.id}`, { priority: p });
      setSelectedTicket(prev => ({ ...prev, priority: p }));
      setTimeout(() => { loadTickets(); }, 100);
    } catch { toast.error('Failed to update priority'); }
  };

  const handleAssignTicket = async () => {
    if (!selectedAssignee || !ticketToAssign) return;
    const m = teamMembers.find(m => m.id === selectedAssignee);
    if (!m) return;
    await api.post(`/support-tickets/${ticketToAssign.id}/assign`, { assignee_id: m.id, assignee_name: m.name, notes: assignmentNotes });
    // Don't close modal — AssignModal shows success state and auto-closes after 4s
    loadTickets(); loadStats();
  };

  const handleBulkAssign = async () => {
    if (!selectedAssignee || !selectedTickets.length) return;
    const m = teamMembers.find(m => m.id === selectedAssignee);
    if (!m) return;
    await api.post('/support-tickets/bulk-action', { ticket_ids: selectedTickets, action: 'assign', assignee_id: m.id, assignee_name: m.name });
    setSelectedTickets([]);
    loadTickets(); loadStats();
  };

  const handleBulkStatusUpdate = async (s) => {
    if (!selectedTickets.length) return;
    try { await api.post('/support-tickets/bulk-action', { ticket_ids: selectedTickets, action: 'update_status', value: s }); toast.success(`${selectedTickets.length} updated`); setSelectedTickets([]); loadTickets(); loadStats(); }
    catch { toast.error('Failed'); }
  };

  const loadAvailableMembers = useCallback(async () => { try { const r = await api.get('/support-tickets/available-members'); setAvailableMembers(r.data.available_members || []); } catch { /* ignore */ } }, []);
  const handleAddTeamMember = async (m) => { try { await api.post('/support-tickets/team-members', { user_id: m.id, name: m.name, email: m.email, role: m.role, department: m.department, type: m.type }); toast.success(`${m.name} added`); loadTeamMembers(); loadAvailableMembers(); } catch { toast.error('Failed'); } };
  const handleRemoveTeamMember = async (m) => { if (m.is_auto) { toast.error('Cannot remove auto-added'); return; } try { await api.delete(`/support-tickets/team-members/${m.id}`); toast.success('Removed'); loadTeamMembers(); } catch { toast.error('Failed'); } };
  useEffect(() => { if (showAddMemberModal) loadAvailableMembers(); }, [showAddMemberModal, loadAvailableMembers]);

  return (
    <ManagementShell
      title="Customer Service Center"
      icon={Inbox}
      subtitle="Manage support tickets and team"
      scopeFilter={
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />}
          {activeTab === 'tickets' && (
            <>
              <Button variant="outline" onClick={() => setChatBotOpen(true)} className="gap-1.5 bg-white shadow-sm border-slate-200 text-sm h-8" size="sm">
                <Bot className="h-3.5 w-3.5 text-[#082c59]" />AI Assistant
              </Button>
              <Button onClick={() => setShowCreateModal(true)} className="bg-[#082c59] hover:bg-[#0a3a75] gap-1.5 shadow-md text-sm h-8" size="sm" data-testid="create-on-behalf-btn">
                <Plus className="w-3.5 h-3.5" />Create Ticket
              </Button>
            </>
          )}
        </div>
      }
      tabs={[
        { value: 'tickets', label: 'Tickets', icon: Inbox },
        { value: 'statistics', label: 'Statistics', icon: BarChart2 },
        { value: 'team', label: 'Team', icon: Users },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      testIdPrefix="customer-service-mgmt"
    >
      <div className="mt-4 space-y-5">
        {/* ========== TICKETS TAB ========== */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <SubpageCard title="Ticket Status" icon={Inbox} testId="cs-substatus-card">
              <Tabs value={ticketSubTab} onValueChange={setTicketSubTab} className="flex-1">
                <TabsList className="grid w-full grid-cols-5 bg-slate-100">
                  {[
                    {k:'open',l:'Open',c:`${stats?.by_status?.open||0}`,i:Inbox},
                    {k:'pending',l:'Pending',c:`${stats?.by_status?.pending||0}`,i:Clock},
                    {k:'in_progress',l:'In Progress',c:`${stats?.by_status?.in_progress||0}`,i:Activity},
                    {k:'resolved',l:'Resolved',c:`${stats?.by_status?.resolved||0}`,i:CheckCircle},
                    {k:'closed',l:'Closed',c:`${stats?.by_status?.closed||0}`,i:CheckCircle}
                  ].map(s => (
                    <TabsTrigger key={s.k} value={s.k} className="flex items-center gap-2 text-sm data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
                      <s.i className="w-4 h-4" />{s.l}<Badge className={`ml-1 text-xs h-5 min-w-[20px] ${ticketSubTab === s.k ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{s.c}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </SubpageCard>

            {/* Search */}
            <SubpageCard title="Filters" icon={Search} testId="cs-filters-card">
              <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-8 bg-white text-sm" /></div>
              <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-36 h-8 bg-white text-sm"><ArrowUpDown className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="created_at">Date Created</SelectItem><SelectItem value="updated_at">Last Updated</SelectItem><SelectItem value="priority">Priority</SelectItem></SelectContent></Select>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>{sortOrder === 'desc' ? '↓' : '↑'}</Button>
            </SubpageCard>

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
            ) : viewMode === 'details' ? (
              <div className="space-y-4">
                {tickets.map(t => <AdminTicketCard key={t.id} ticket={t} isSelected={selectedTickets.includes(t.id)} onSelect={handleSelectTicket} onView={() => handleViewTicket(t)} onAssign={(t) => { setTicketToAssign(t); setShowAssignModal(true); }} />)}
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
      <AdminTicketDetailModal open={showDetailModal} onOpenChange={setShowDetailModal} ticket={selectedTicket} onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange}
        onAssign={() => { setTicketToAssign(selectedTicket); setShowAssignModal(true); }} onRefreshTicket={async () => {
          try { const r = await api.get(`/support-tickets/${selectedTicket.id}`); setSelectedTicket(r.data); loadTickets(); } catch { /* ignore */ }
        }} />
      <AssignModal open={showAssignModal} onOpenChange={(o) => { setShowAssignModal(o); if (!o) { setTicketToAssign(null); setSelectedAssignee(''); setAssignmentNotes(''); } }} ticket={ticketToAssign} teamMembers={teamMembers} selectedAssignee={selectedAssignee} onAssigneeChange={setSelectedAssignee} notes={assignmentNotes} onNotesChange={setAssignmentNotes} onAssign={handleAssignTicket} />
      <BulkAssignModal open={showBulkAssignModal} onOpenChange={(o) => { setShowBulkAssignModal(o); if (!o) setSelectedAssignee(''); }} selectedCount={selectedTickets.length} teamMembers={teamMembers} selectedAssignee={selectedAssignee} onAssigneeChange={setSelectedAssignee} onAssign={handleBulkAssign} />
      <CreateOnBehalfModal open={showCreateModal} onOpenChange={setShowCreateModal} onCreated={() => { loadTickets(); loadStats(); }} />
      <AIChatBot isOpen={chatBotOpen} onClose={() => setChatBotOpen(false)} onCreateTicket={() => { setChatBotOpen(false); setShowCreateModal(true); }} />
    </ManagementShell>
  );
}
