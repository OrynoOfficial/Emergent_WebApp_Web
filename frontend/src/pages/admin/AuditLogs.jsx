import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  History, Search, Filter, User, Settings, ShieldCheck, AlertTriangle, Info, 
  ChevronLeft, ChevronRight, FileText, BarChart3, Database, TrendingUp,
  Download, Eye, Truck, DollarSign, Users, Target, Shield,
  MessageSquare, Activity, RefreshCw, Calendar, Clock, ArrowRight,
  CheckCircle, XCircle, Package, CreditCard, AlertCircle
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import { activityLogger } from '@/utils/activityLogger';

// Complete reports list matching original OtherReports.jsx
const REPORTS_LIST = [
  // Operational Reports
  { id: "daily-weekly-monthly-trip", name: "Daily / Weekly / Monthly Trip Report", description: "Trips completed, total distance, and average trip duration", category: "operational", audience: "operations" },
  { id: "punctuality-report", name: "Punctuality Report", description: "On-time performance, average delays, and main delay causes", category: "operational", audience: "operations" },
  { id: "booking-report", name: "Booking Report", description: "Bookings volume, cancellation rate, and peak days/hours", category: "operational", audience: "operations" },
  { id: "vehicle-occupancy-report", name: "Vehicle Occupancy Report", description: "Average load factor and peak occupancy periods", category: "operational", audience: "operations" },
  { id: "incident-breakdown-accident", name: "Incident / Breakdown / Accident Report", description: "Incident types, locations, and downtime duration", category: "operational", audience: "operations" },
  { id: "operational-efficiency", name: "Operational Efficiency Report", description: "Service performance and operational metrics analysis", category: "operational", audience: "operations" },
  { id: "booking-analytics", name: "Booking Analytics Report", description: "Booking trends, conversion rates, and customer journey analysis", category: "operational", audience: "operations" },
  
  // Financial Reports
  { id: "revenue-analysis", name: "Revenue Analysis Report", description: "Detailed revenue breakdown by service category and time period", category: "financial", audience: "operations" },
  { id: "revenue-by-route-vehicle-driver", name: "Revenue by Route / Vehicle / Driver", description: "Revenue contribution across key dimensions", category: "financial", audience: "operations" },
  { id: "operating-expenses", name: "Operating Expenses Report", description: "Fuel, maintenance, and route-related expenses", category: "financial", audience: "operations" },
  { id: "cost-per-km", name: "Cost per Kilometer Analysis", description: "Unit cost analysis by route and period", category: "financial", audience: "operations" },
  { id: "budget-vs-actual", name: "Budget vs Actual Performance", description: "Compare budgeted vs actual revenues and expenses", category: "financial", audience: "operations" },
  { id: "financial-summary", name: "Financial Summary Report", description: "Comprehensive financial overview and key performance indicators", category: "financial", audience: "operations" },
  
  // HR / Driver Reports
  { id: "driver-schedule-hours", name: "Driver Schedule and Working Hours", description: "Driver rosters, workloads, and overtime", category: "hr_driver", audience: "operations" },
  { id: "absenteeism-tardiness", name: "Absenteeism and Tardiness Report", description: "Attendance deviations and trends", category: "hr_driver", audience: "operations" },
  { id: "driver-performance-evaluation", name: "Driver Performance Evaluation", description: "Punctuality, safety incidents, and feedback", category: "hr_driver", audience: "operations" },
  
  // Customer Reports
  { id: "customer-insights", name: "Customer Insights Report", description: "Customer behavior analysis and booking patterns", category: "customer", audience: "operations" },
  { id: "customer-satisfaction", name: "Customer Satisfaction Report", description: "Positive feedback rate, complaints, and resolution time", category: "customer", audience: "operations" },
  { id: "customer-retention-loyalty", name: "Customer Retention / Loyalty Report", description: "Repeat customers and retention rates", category: "customer", audience: "operations" },
  
  // Strategic Reports (Administrators)
  { id: "market-trends", name: "Market Trends Analysis", description: "Market analysis and competitive positioning insights", category: "strategic", audience: "administrators" },
  { id: "operator-comparison", name: "Operator Comparison Report", description: "Performance comparison between different operators", category: "strategic", audience: "administrators" },
  { id: "global-activity", name: "Global Activity Report", description: "Total trips, revenue, and performance across all agencies", category: "strategic", audience: "administrators" },
  { id: "agency-performance", name: "Agency Performance Report", description: "Ranking by revenue, efficiency, and punctuality", category: "strategic", audience: "administrators" },
  { id: "profitability-analysis", name: "Profitability Analysis", description: "Gross margin and net profit per route or agency", category: "strategic", audience: "administrators" },
  { id: "forecast-trend", name: "Forecast and Trend Report", description: "Demand evolution, seasonality, and traffic predictions", category: "strategic", audience: "administrators" },
  
  // Compliance & Safety
  { id: "vehicle-safety-audit", name: "Vehicle Safety Audit Report", description: "Inspections performed, issues found, corrective actions", category: "compliance", audience: "administrators" },
  { id: "licenses-insurance-technical", name: "Licenses, Insurance, and Technical Check Follow-up", description: "Validity tracking and follow-up actions", category: "compliance", audience: "administrators" },
  { id: "environmental-impact", name: "Environmental Impact Report", description: "CO₂ emissions, energy consumption, and green initiatives", category: "compliance", audience: "administrators" },
  
  // Internal Communication
  { id: "announcement-alert-stats", name: "Announcement and Alert Statistics", description: "Volume, types, recipients, and read rates", category: "internal_comm", audience: "administrators" },
  { id: "internal-engagement", name: "Internal Engagement Report", description: "Response rates and participation in campaigns", category: "internal_comm", audience: "administrators" },
  
  // Advanced Analytics
  { id: "kpi-dashboard", name: "KPI Dashboard", description: "Occupancy rate, cost per km, satisfaction, delays", category: "advanced_analytics", audience: "administrators" },
  { id: "predictive-analysis", name: "Predictive Analysis Report", description: "Demand forecasting and incident prediction", category: "advanced_analytics", audience: "administrators" },
  { id: "service-performance", name: "Service Performance Report", description: "Individual service analysis and performance metrics", category: "operational", audience: "operations" },
];

const CATEGORIES = {
  operational: { label: "Operational", icon: Truck, color: "bg-blue-100 text-blue-700" },
  financial: { label: "Financial", icon: DollarSign, color: "bg-green-100 text-green-700" },
  hr_driver: { label: "HR / Driver", icon: Users, color: "bg-purple-100 text-purple-700" },
  customer: { label: "Customer", icon: User, color: "bg-orange-100 text-orange-700" },
  strategic: { label: "Strategic", icon: Target, color: "bg-indigo-100 text-indigo-700" },
  compliance: { label: "Compliance & Safety", icon: Shield, color: "bg-red-100 text-red-700" },
  internal_comm: { label: "Internal Communication", icon: MessageSquare, color: "bg-cyan-100 text-cyan-700" },
  advanced_analytics: { label: "Advanced Analytics", icon: Activity, color: "bg-pink-100 text-pink-700" }
};

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
  const [activeTab, setActiveTab] = useState('activity');
  
  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logSeverityFilter, setLogSeverityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState(null);
  
  // Reports state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');

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
  }, [currentPage, logActionFilter, logSeverityFilter, logSearchTerm]);

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

  // Filter reports
  const filteredReports = useMemo(() => {
    return REPORTS_LIST.filter(report => {
      const matchesSearch = !searchTerm || 
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;
      const matchesAudience = audienceFilter === 'all' || report.audience === audienceFilter;
      
      // Non-admin users can only see operations reports
      if (!isAdmin && report.audience === 'administrators') return false;
      
      return matchesSearch && matchesCategory && matchesAudience;
    });
  }, [searchTerm, categoryFilter, audienceFilter, isAdmin]);

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const handleViewReport = (reportId, type) => {
    const report = REPORTS_LIST.find(r => r.id === reportId);
    activityLogger.reportView(reportId, report?.name || reportId);
    toast.info(`Opening ${type} view for report: ${reportId}`);
    // In production, this would navigate to the report view
  };

  const handleExportReport = (reportId, format) => {
    const report = REPORTS_LIST.find(r => r.id === reportId);
    activityLogger.reportDownload(reportId, report?.name || reportId, format);
    toast.success(`Exporting report as ${format.toUpperCase()}`);
    // In production, this would trigger a download
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

  const getCategoryInfo = (category) => CATEGORIES[category] || { label: category, color: "bg-gray-100 text-gray-700", icon: FileText };

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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59] flex items-center gap-3">
            <History className="h-7 w-7" />
            Activity Logs & Reports
          </h1>
          <p className="text-slate-600 mt-1">
            {isAdmin 
              ? "View all system activity, user actions, and business intelligence reports"
              : "View your activity history and available reports"}
          </p>
        </div>
        <Button onClick={() => { loadActivityLogs(); loadStats(); }} variant="outline" className="gap-2">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Activity Log
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by action, user, details..."
                    value={logSearchTerm}
                    onChange={(e) => { setLogSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-10 bg-white"
                  />
                </div>
                <Select value={logActionFilter} onValueChange={(v) => { setLogActionFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-44 bg-white">
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
                  <SelectTrigger className="w-40 bg-white">
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
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>System Activity Log</span>
                <Badge variant="outline">{totalLogs} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 text-slate-300 mx-auto animate-spin mb-4" />
                  <p className="text-slate-500">Loading activity logs...</p>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 mb-1">No Activity Logs</h3>
                  <p className="text-slate-500">
                    {logSearchTerm || logActionFilter !== 'all' || logSeverityFilter !== 'all'
                      ? "No logs match your current filters. Try adjusting your search criteria."
                      : "Activity logging has been set up. Logs will appear here as actions are performed."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activityLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => handleViewLog(log)}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        log.severity === 'error' ? 'bg-red-100 text-red-600' :
                        log.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs text-slate-900 truncate">{log.action}</span>
                          {log.severity !== 'info' && getSeverityBadge(log.severity)}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{log.details || 'No details'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400">
                        <span className="hidden sm:flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded capitalize">{log.actor_role}</span>
                        <span className="truncate max-w-[80px]">{log.actor_name || log.actor_email}</span>
                        <span className="whitespace-nowrap">{formatTimestamp(log.timestamp)}</span>
                      </div>
                      <Eye className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages} ({totalLogs} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600">Page {currentPage}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Audience" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Audiences</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    {isAdmin && <SelectItem value="administrators">Administrators</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No reports match your filters</p>
                </CardContent>
              </Card>
            ) : (
              filteredReports.map((report) => {
                const categoryInfo = getCategoryInfo(report.category);
                const CategoryIcon = categoryInfo.icon || FileText;
                
                return (
                  <Card key={report.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${categoryInfo.color}`}>
                            <CategoryIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-800">{report.name}</h3>
                            <p className="text-slate-600 text-sm mt-1">{report.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge variant="outline" className={categoryInfo.color}>
                                {categoryInfo.label}
                              </Badge>
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 capitalize">
                                {report.audience}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            onClick={() => handleViewReport(report.id, 'visual')}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Visual
                          </Button>
                          <Button
                            onClick={() => handleViewReport(report.id, 'data')}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            size="sm"
                          >
                            <Database className="w-4 h-4 mr-2" />
                            Data
                          </Button>
                          <Button
                            onClick={() => handleExportReport(report.id, 'pdf')}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Activity Detail Dialog */}
      <ActivityDetailDialog 
        log={selectedLog} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />
    </div>
  );
}
