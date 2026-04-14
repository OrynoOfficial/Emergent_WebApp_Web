import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  History, Search, User, Settings, ShieldCheck, AlertTriangle,
  ChevronLeft, ChevronRight,
  Truck, RefreshCw, Calendar, Clock,
  CheckCircle, Package, CreditCard, AlertCircle, List, LayoutGrid, Rows3
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Activity Log Detail Dialog
const ActivityDetailDialog = ({ log, isOpen, onClose }) => {
  if (!log) return null;

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col bg-white">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Action</label>
              <p className="font-semibold text-slate-900 text-sm break-words">{log.action}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Severity</label>
              <div className="mt-1">
                <Badge className={
                  log.severity === 'error' ? 'bg-red-100 text-red-700' :
                  log.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }>
                  {log.severity?.toUpperCase() || 'INFO'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Entity Type</label>
              <p className="capitalize text-sm">{log.entity_type || 'N/A'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Entity Name</label>
              <p className="text-sm break-words">{log.entity_name || log.entity_id || 'N/A'}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Details</label>
            <p className="text-slate-700 text-sm break-words">{log.details || 'No additional details'}</p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-sm">Actor Information</h4>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg">
              <div>
                <label className="text-xs font-medium text-slate-500">Name</label>
                <p className="text-sm break-words">{log.actor_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <p className="text-sm break-words">{log.actor_email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Role</label>
                <Badge variant="outline" className="capitalize text-xs">{log.actor_role || 'N/A'}</Badge>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">IP Address</label>
                <p className="text-sm">{log.ip_address || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Timestamp</label>
            <p className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              {formatTimestamp(log.timestamp)}
            </p>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm">Additional Metadata</h4>
              <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
          <Button variant="outline" onClick={onClose} size="sm">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function AuditLogs() {
  const { user } = useAuth();
  
  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logSeverityFilter, setLogSeverityFilter] = useState('all');
  const [logExcludeRole, setLogExcludeRole] = useState('none');
  const [logViewMode, setLogViewMode] = useState('details');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const logsPerPage = 40;

  // Load activity logs from backend
  const loadActivityLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: logsPerPage
      });
      
      if (logActionFilter !== 'all') params.append('action_type', logActionFilter);
      if (logSeverityFilter !== 'all') params.append('severity', logSeverityFilter);
      if (logSearchTerm) params.append('search', logSearchTerm);
      if (logExcludeRole !== 'none') params.append('exclude_role', logExcludeRole);
      
      const response = await api.get(`/activity/logs?${params.toString()}`);
      setActivityLogs(response.data.logs || []);
      setTotalPages(response.data.total_pages || 1);
      setTotalLogs(response.data.total || 0);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      // Fall back to empty state - activity logs might not exist yet
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [currentPage, logActionFilter, logSeverityFilter, logSearchTerm, logExcludeRole]);

  // Load stats (admin only)
  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get('/activity/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadActivityLogs();
  }, [loadActivityLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const getActionIcon = (action) => {
    if (!action) return <History className="h-4 w-4" />;
    if (action.startsWith('user')) return <User className="h-4 w-4" />;
    if (action.startsWith('order')) return <Package className="h-4 w-4" />;
    if (action.startsWith('service')) return <Truck className="h-4 w-4" />;
    if (action.startsWith('payment')) return <CreditCard className="h-4 w-4" />;
    if (action.startsWith('settings')) return <Settings className="h-4 w-4" />;
    if (action.startsWith('security')) return <ShieldCheck className="h-4 w-4" />;
    if (action.startsWith('validation')) return <CheckCircle className="h-4 w-4" />;
    return <History className="h-4 w-4" />;
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'error':
        return <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">Error</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">Warn</Badge>;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Permission notice for non-admins
  const PermissionNotice = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-800">Limited View</h4>
          <p className="text-sm text-amber-700">
            {isOperator 
              ? "You can see activity logs for your own actions and services under your management."
              : "You can only see activity logs for your own actions. Contact an administrator for full access."}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6" data-testid="audit-logs-page">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59] flex items-center gap-3">
            <History className="h-7 w-7" />
            System Activity Log
          </h1>
          <p className="text-slate-600 mt-1">
            {isAdmin 
              ? "View all system activity and user actions"
              : "View your activity history"}
          </p>
        </div>
        <Button onClick={() => { loadActivityLogs(); loadStats(); }} variant="outline" className="gap-2" data-testid="refresh-logs-btn">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {!isAdmin && <PermissionNotice />}

      {/* Stats Cards (Admin Only) */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Total Logs</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.total_logs?.toLocaleString() || 0}</p>
                </div>
                <History className="h-8 w-8 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Last 24 Hours</p>
                  <p className="text-2xl font-bold text-green-900">{stats.recent_24h || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-green-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Warnings</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.severity_breakdown?.warning || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Errors</p>
                  <p className="text-2xl font-bold text-red-900">{stats.severity_breakdown?.error || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by action, user, details..."
                  value={logSearchTerm}
                  onChange={(e) => { setLogSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10 bg-white h-9 text-sm"
                  data-testid="log-search-input"
                />
              </div>
              <Select value={logActionFilter} onValueChange={(v) => { setLogActionFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-40 bg-white h-9 text-sm" data-testid="log-action-filter">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user">User Actions</SelectItem>
                  <SelectItem value="order">Orders</SelectItem>
                  <SelectItem value="service">Services</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="validation">Validation</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logSeverityFilter} onValueChange={(v) => { setLogSeverityFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-36 bg-white h-9 text-sm" data-testid="log-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Role exclusion filters + View mode toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {[
                  { k: 'none', l: 'All Users' },
                  { k: 'super_admin', l: 'Without Superadmin' },
                  { k: 'admin', l: 'Without Admin' },
                ].map(f => (
                  <Button key={f.k} variant={logExcludeRole === f.k ? 'default' : 'outline'} size="sm"
                    className={`h-7 text-xs px-2.5 ${logExcludeRole === f.k ? 'bg-[#082c59]' : ''}`}
                    onClick={() => { setLogExcludeRole(f.k); setCurrentPage(1); }}
                    data-testid={`exclude-role-${f.k}`}
                  >{f.l}</Button>
                ))}
              </div>
              <div className="flex border rounded-lg overflow-hidden">
                {[
                  { k: 'details', icon: Rows3, label: 'Details' },
                  { k: 'list', icon: List, label: 'List' },
                  { k: 'grid', icon: LayoutGrid, label: 'Grid' },
                ].map(v => (
                  <button key={v.k} onClick={() => setLogViewMode(v.k)} title={v.label}
                    className={`px-2 py-1.5 ${logViewMode === v.k ? 'bg-[#082c59] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                    data-testid={`view-mode-${v.k}`}
                  ><v.icon className="h-4 w-4" /></button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Activity Log</span>
            <Badge variant="outline" className="text-xs">{totalLogs} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {logsLoading ? (
            <div className="text-center py-10">
              <RefreshCw className="h-7 w-7 text-slate-300 mx-auto animate-spin mb-3" />
              <p className="text-slate-500 text-sm">Loading activity logs...</p>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-10">
              <History className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {logSearchTerm || logActionFilter !== 'all' || logSeverityFilter !== 'all' || logExcludeRole !== 'none'
                  ? "No logs match your current filters."
                  : "No activity logs yet."}
              </p>
            </div>
          ) : logViewMode === 'details' ? (
            /* ===== DETAILS VIEW ===== */
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200" onClick={() => handleViewLog(log)} data-testid={`log-entry-${log.id}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      log.severity === 'error' ? 'bg-red-100 text-red-600' :
                      log.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>{getActionIcon(log.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-slate-900">{log.action}</span>
                        {log.severity === 'error' && <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">Error</Badge>}
                        {log.severity === 'warning' && <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">Warn</Badge>}
                      </div>
                      <p className="text-xs text-slate-600 mb-1.5 line-clamp-2">{log.details || 'No details'}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.actor_name || log.actor_email}</span>
                        <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5">{log.actor_role}</Badge>
                        {log.entity_type && <span className="capitalize">{log.entity_type}</span>}
                        <span className="flex items-center gap-1 ml-auto"><Clock className="h-3 w-3" />{formatTimestamp(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : logViewMode === 'list' ? (
            /* ===== LIST VIEW ===== */
            <div className="space-y-px">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs" onClick={() => handleViewLog(log)}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.severity === 'error' ? 'bg-red-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                  }`} />
                  <span className="font-medium text-slate-800 truncate w-40">{log.action}</span>
                  <span className="text-slate-500 truncate flex-1">{log.details || '\u2014'}</span>
                  <Badge variant="outline" className="text-[9px] capitalize py-0 px-1 shrink-0">{log.actor_role}</Badge>
                  <span className="text-slate-400 truncate w-24 text-right shrink-0">{log.actor_name || log.actor_email}</span>
                  <span className="text-slate-400 w-28 text-right shrink-0">{formatTimestamp(log.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            /* ===== GRID VIEW ===== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {activityLogs.map((log) => (
                <div key={log.id} className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                  log.severity === 'error' ? 'border-red-200 bg-red-50/50' :
                  log.severity === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                  'border-slate-200 bg-white'
                }`} onClick={() => handleViewLog(log)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                      log.severity === 'error' ? 'bg-red-100 text-red-600' :
                      log.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>{getActionIcon(log.action)}</div>
                    <span className="font-medium text-xs text-slate-900 truncate">{log.action}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">{log.details || 'No details'}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate">{log.actor_name || log.actor_email}</span>
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <p className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({totalLogs} total)
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                  <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-1.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm"
                      className={`h-7 w-7 p-0 text-xs ${currentPage === pageNum ? 'bg-[#082c59]' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >{pageNum}</Button>
                  );
                })}
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Detail Dialog */}
      <ActivityDetailDialog 
        log={selectedLog} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />
    </div>
  );
}
