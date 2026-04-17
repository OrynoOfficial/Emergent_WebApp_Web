import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  BarChart3, TrendingUp, Download, Eye, ChevronDown,
  DollarSign, Users, Target, MessageSquare, Activity,
  FileText, Loader2, Calendar, RefreshCw, Table2
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CHART_COLORS = ['#082c59', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const REPORTS_LIST = [
  { id: "booking-report", name: "Booking Report", description: "Bookings volume, cancellation rate, and peak days/hours", category: "operational", icon: FileText },
  { id: "revenue-analysis", name: "Revenue Analysis", description: "Revenue breakdown by service category and time period", category: "financial", icon: DollarSign },
  { id: "financial-summary", name: "Financial Summary", description: "Financial overview and key performance indicators", category: "financial", icon: TrendingUp },
  { id: "customer-insights", name: "Customer Insights", description: "Customer behavior analysis and booking patterns", category: "customer", icon: Users },
  { id: "operational-efficiency", name: "Operational Efficiency", description: "Service performance and operational metrics", category: "operational", icon: Activity },
  { id: "service-performance", name: "Service Performance", description: "Individual service analysis and metrics", category: "operational", icon: BarChart3 },
  { id: "customer-satisfaction", name: "Customer Satisfaction", description: "Feedback, ratings, and complaint resolution", category: "customer", icon: MessageSquare },
  { id: "booking-analytics", name: "Booking Analytics", description: "Booking trends, conversion rates, and journey", category: "operational", icon: Target },
];

const CATEGORIES = {
  operational: { label: "Operational", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  financial: { label: "Financial", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  customer: { label: "Customer", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};

function formatNum(n) {
  if (n == null) return '0';
  if (typeof n === 'string') return n;
  return n.toLocaleString();
}

// ========== Chart Renderer ==========
function ChartBlock({ chart }) {
  if (!chart || !chart.data || chart.data.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No data available</div>;
  }
  const dataKey = Object.keys(chart.data[0]).find(k => k !== 'name' && k !== 'date' && k !== 'month' && k !== 'hour' && k !== 'day');
  const xKey = Object.keys(chart.data[0]).find(k => ['name', 'date', 'month', 'hour', 'day'].includes(k)) || 'name';

  if (chart.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
            {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => formatNum(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => formatNum(v)} />
          {Object.keys(chart.data[0]).filter(k => k !== xKey).map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  const barKeys = Object.keys(chart.data[0]).filter(k => k !== xKey);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => formatNum(v)} />
        {barKeys.map((k, i) => <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />)}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ========== Inline Report View ==========
function ReportView({ data, viewMode }) {
  if (!data) return null;

  if (viewMode === 'data') {
    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <h4 className="font-semibold text-sm text-slate-800 mb-4">Key Metrics</h4>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val]) => (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 text-slate-600 capitalize">{key.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">{formatNum(val)}{key.includes('rate') ? '%' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
        {data.table && (
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <h4 className="font-semibold text-sm text-slate-800 mb-4">Detailed Data</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {data.table.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 text-left font-semibold text-slate-700 text-xs uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2.5 px-3 text-slate-700">{formatNum(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.table.rows.length === 0 && <p className="text-center py-6 text-slate-400">No data</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Visual mode
  return (
    <div className="space-y-6">
      {data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-[#082c59]">{formatNum(val)}{key.includes('rate') ? '%' : ''}</p>
            </div>
          ))}
        </div>
      )}
      {data.charts?.map((chart, i) => (
        <Card key={i} className="border-slate-200">
          <CardContent className="p-5">
            <h4 className="font-semibold text-sm text-slate-800 mb-4">{chart.title}</h4>
            <ChartBlock chart={chart} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ========== Download Helpers ==========
function downloadCSV(data, filename) {
  if (!data?.table) return;
  const rows = [data.table.headers.join(','), ...data.table.rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ========== Main Page ==========
export default function SystemReports() {
  const { user } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState('');
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [viewMode, setViewMode] = useState('visual');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const dlRef = useRef(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const selectedReport = REPORTS_LIST.find(r => r.id === selectedReportId);

  useEffect(() => {
    if (isAdmin) {
      api.get('/reports/operators-list').then(r => setOperators(r.data.operators || [])).catch(() => {});
    }
  }, [isAdmin]);

  // Close download menu on outside click
  useEffect(() => {
    const handleClick = (e) => { if (dlRef.current && !dlRef.current.contains(e.target)) setShowDownloadMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch report when selection or filters change
  const fetchReport = useCallback(async () => {
    if (!selectedReportId) { setReportData(null); return; }
    setLoading(true);
    setReportData(null);
    try {
      const params = new URLSearchParams({ report_id: selectedReportId });
      const opId = selectedOperator !== 'all' ? selectedOperator : null;
      if (opId) params.append('operator_id', opId);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await api.get(`/reports/generate?${params}`);
      setReportData(res.data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, selectedOperator, dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filename = `${selectedReportId || 'report'}_${reportData?.scope?.replace(/\s/g, '_') || 'all'}_${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6 p-6" data-testid="system-reports-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59] flex items-center gap-3">
            <BarChart3 className="h-7 w-7" />
            Reports
          </h1>
          <p className="text-slate-500 mt-1">Business intelligence and operational reports</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Scope:</span>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="w-52 bg-white h-9 text-sm" data-testid="operator-scope-selector">
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Operators</SelectItem>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Report Selector */}
            <div className="flex-1 min-w-0">
              <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                <SelectTrigger className="bg-white h-10 text-sm w-full" data-testid="report-selector">
                  <SelectValue placeholder="Select a report...">
                    {selectedReport && (
                      <div className="flex items-center gap-2">
                        <selectedReport.icon className="h-4 w-4 text-[#082c59]" />
                        <span>{selectedReport.name}</span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${CATEGORIES[selectedReport.category]?.color}`}>
                          {CATEGORIES[selectedReport.category]?.label}
                        </Badge>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white max-h-80">
                  {Object.entries(CATEGORIES).map(([catKey, catVal]) => {
                    const catReports = REPORTS_LIST.filter(r => r.category === catKey);
                    return (
                      <div key={catKey}>
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${catVal.dot}`} />
                          {catVal.label}
                        </div>
                        {catReports.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            <div className="flex items-center gap-2.5">
                              <r.icon className="h-4 w-4 text-slate-500" />
                              <div>
                                <span className="font-medium">{r.name}</span>
                                <span className="text-xs text-slate-400 ml-2">{r.description}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white text-sm h-10 w-36" data-testid="reports-date-from" />
              </div>
              <span className="text-slate-300">-</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white text-sm h-10 w-36" data-testid="reports-date-to" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap" data-testid="clear-date-filter">Clear</button>
              )}
            </div>

            {/* View toggle + actions */}
            {selectedReportId && (
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('visual')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'visual' ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} data-testid="view-toggle-visual">
                    <TrendingUp className="w-3.5 h-3.5" />Visual
                  </button>
                  <button onClick={() => setViewMode('data')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'data' ? 'bg-[#082c59] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} data-testid="view-toggle-data">
                    <Table2 className="w-3.5 h-3.5" />Data
                  </button>
                </div>

                <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="h-8">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>

                <div className="relative" ref={dlRef}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => setShowDownloadMenu(!showDownloadMenu)} disabled={!reportData}>
                    <Download className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" />
                  </Button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
                      <button onClick={() => { downloadJSON(reportData, `${filename}_visual`); setShowDownloadMenu(false); toast.success('Downloaded'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />JSON
                      </button>
                      <button onClick={() => { downloadCSV(reportData, `${filename}_data`); setShowDownloadMenu(false); toast.success('Downloaded'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-green-600" />CSV
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content — inline, no modal */}
      {!selectedReportId ? (
        <div className="text-center py-20">
          <BarChart3 className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400">Select a report to get started</h3>
          <p className="text-sm text-slate-400 mt-1">Choose from the dropdown above to view analytics</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#082c59]" />
          <span className="ml-3 text-slate-500">Generating {selectedReport?.name}...</span>
        </div>
      ) : reportData ? (
        <div>
          {/* Report header info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {selectedReport && <selectedReport.icon className="h-5 w-5 text-[#082c59]" />}
              <div>
                <h2 className="text-lg font-bold text-slate-800">{reportData.title || selectedReport?.name}</h2>
                {reportData.scope && (
                  <p className="text-xs text-slate-500">
                    Scope: {reportData.scope}
                    {reportData.generated_at && <> &middot; {new Date(reportData.generated_at).toLocaleString()}</>}
                  </p>
                )}
              </div>
            </div>
          </div>
          <ReportView data={reportData} viewMode={viewMode} />
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">No data returned</div>
      )}
    </div>
  );
}
