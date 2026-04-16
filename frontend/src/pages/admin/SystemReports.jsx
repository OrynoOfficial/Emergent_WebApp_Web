import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  Search, BarChart3, TrendingUp, Download, Eye, ChevronDown,
  Truck, DollarSign, Users, Target, Shield, MessageSquare, Activity, User,
  FileText, Loader2, X, Calendar
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
  { id: "revenue-analysis", name: "Revenue Analysis", description: "Detailed revenue breakdown by service category and time period", category: "financial", icon: DollarSign },
  { id: "financial-summary", name: "Financial Summary", description: "Comprehensive financial overview and key performance indicators", category: "financial", icon: TrendingUp },
  { id: "customer-insights", name: "Customer Insights", description: "Customer behavior analysis and booking patterns", category: "customer", icon: Users },
  { id: "operational-efficiency", name: "Operational Efficiency", description: "Service performance and operational metrics analysis", category: "operational", icon: Activity },
  { id: "service-performance", name: "Service Performance", description: "Individual service analysis and performance metrics", category: "operational", icon: BarChart3 },
  { id: "customer-satisfaction", name: "Customer Satisfaction", description: "Feedback, ratings, and complaint resolution analysis", category: "customer", icon: MessageSquare },
  { id: "booking-analytics", name: "Booking Analytics", description: "Booking trends, conversion rates, and customer journey", category: "operational", icon: Target },
];

const CATEGORIES = {
  operational: { label: "Operational", color: "bg-blue-100 text-blue-700" },
  financial: { label: "Financial", color: "bg-green-100 text-green-700" },
  customer: { label: "Customer", color: "bg-orange-100 text-orange-700" },
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
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
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
      <ResponsiveContainer width="100%" height={260}>
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
  // Default: bar
  const barKeys = Object.keys(chart.data[0]).filter(k => k !== xKey);
  return (
    <ResponsiveContainer width="100%" height={260}>
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

// ========== Visual View ==========
function VisualView({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      {data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val]) => (
            <div key={key} className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold text-[#082c59]">{formatNum(val)}{key.includes('rate') ? '%' : ''}</p>
            </div>
          ))}
        </div>
      )}
      {/* Charts */}
      {data.charts?.map((chart, i) => (
        <Card key={i} className="border-slate-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm text-slate-800 mb-3">{chart.title}</h4>
            <ChartBlock chart={chart} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ========== Data View ==========
function DataView({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      {/* KPI Summary as table */}
      {data.summary && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm text-slate-800 mb-3">Key Metrics</h4>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val]) => (
                  <tr key={key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-600 capitalize">{key.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{formatNum(val)}{key.includes('rate') ? '%' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {/* Main Table */}
      {data.table && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm text-slate-800 mb-3">Detailed Data</h4>
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
      {/* Extra details */}
      {data.details && Object.keys(data.details).length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm text-slate-800 mb-3">Additional Breakdown</h4>
            {Object.entries(data.details).map(([key, val]) => (
              <div key={key} className="mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
                {Array.isArray(val) ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {val.map((item, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-2 text-xs">
                        {Object.entries(item).map(([k, v]) => (
                          <div key={k} className="flex justify-between"><span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium">{formatNum(v)}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : typeof val === 'object' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(val).map(([k, v]) => (
                      <div key={k} className="bg-slate-50 rounded-lg p-2 text-xs flex justify-between">
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{formatNum(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm">{String(val)}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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

// ========== Report Modal ==========
function ReportModal({ open, onClose, report, operatorId, dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('visual');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const dlRef = useRef(null);

  useEffect(() => {
    if (open && report) {
      setLoading(true);
      setData(null);
      setViewMode('visual');
      const params = new URLSearchParams({ report_id: report.id });
      if (operatorId) params.append('operator_id', operatorId);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      api.get(`/reports/generate?${params}`).then(r => setData(r.data)).catch(() => toast.error('Failed to generate report')).finally(() => setLoading(false));
    }
  }, [open, report, operatorId, dateFrom, dateTo]);

  useEffect(() => {
    const handleClick = (e) => { if (dlRef.current && !dlRef.current.contains(e.target)) setShowDownloadMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filename = `${report?.id || 'report'}_${data?.scope?.replace(/\s/g, '_') || 'all'}_${new Date().toISOString().slice(0, 10)}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{report?.name || 'Report'}</DialogTitle>
              {data?.scope && <p className="text-xs text-slate-500 mt-0.5">Scope: {data.scope} &middot; Generated: {new Date(data.generated_at).toLocaleString()}</p>}
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode('visual')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'visual' ? 'bg-[#082c59] text-white' : 'text-slate-600'}`}>
                  <TrendingUp className="w-3.5 h-3.5" />Visual
                </button>
                <button onClick={() => setViewMode('data')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'data' ? 'bg-[#082c59] text-white' : 'text-slate-600'}`}>
                  <Eye className="w-3.5 h-3.5" />Data
                </button>
              </div>
              {/* Download dropdown */}
              <div className="relative" ref={dlRef}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowDownloadMenu(!showDownloadMenu)} disabled={!data}>
                  <Download className="w-3.5 h-3.5" />Download<ChevronDown className="w-3 h-3" />
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[180px] py-1">
                    <button onClick={() => { downloadJSON(data, `${filename}_visual`); setShowDownloadMenu(false); toast.success('Visual report downloaded'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />Download Visual (JSON)
                    </button>
                    <button onClick={() => { downloadCSV(data, `${filename}_data`); setShowDownloadMenu(false); toast.success('Data report downloaded'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-green-600" />Download Data (CSV)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#082c59]" /><span className="ml-3 text-slate-500">Generating report...</span></div>
          ) : !data ? (
            <div className="text-center py-20 text-slate-400">No data</div>
          ) : viewMode === 'visual' ? (
            <VisualView data={data} />
          ) : (
            <DataView data={data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Page ==========
export default function SystemReports() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [modalMode, setModalMode] = useState('visual');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';

  useEffect(() => {
    if (isAdmin) {
      api.get('/reports/operators-list').then(r => setOperators(r.data.operators || [])).catch(() => {});
    }
  }, [isAdmin]);

  const filteredReports = REPORTS_LIST.filter(r => {
    const matchSearch = !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openReport = (report, mode) => {
    setActiveReport(report);
    setModalMode(mode);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 p-6" data-testid="system-reports-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59] flex items-center gap-3">
            <BarChart3 className="h-7 w-7" />
            Reports
          </h1>
          <p className="text-slate-600 mt-1">Business intelligence and operational reports</p>
        </div>
        {/* Operator scope selector */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Scope:</span>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="w-56 bg-white h-9 text-sm" data-testid="operator-scope-selector">
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search reports..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white" data-testid="reports-search-input" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-white" data-testid="reports-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white text-sm" placeholder="From" data-testid="reports-date-from" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white text-sm" placeholder="To" data-testid="reports-date-to" />
              </div>
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
              <Badge variant="outline" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {dateFrom || 'Start'} → {dateTo || 'Now'}
              </Badge>
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-red-500 hover:text-red-700 underline text-xs" data-testid="clear-date-filter">Clear dates</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Grid */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">No reports match your filters</p></CardContent></Card>
        ) : (
          filteredReports.map((report) => {
            const cat = CATEGORIES[report.category] || { label: report.category, color: "bg-gray-100 text-gray-700" };
            const Icon = report.icon;
            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow" data-testid={`report-card-${report.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-800">{report.name}</h3>
                        <p className="text-slate-600 text-sm mt-1">{report.description}</p>
                        <Badge variant="outline" className={`mt-2 ${cat.color}`}>{cat.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button onClick={() => openReport(report, 'visual')} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm" data-testid={`report-visual-${report.id}`}>
                        <TrendingUp className="w-4 h-4 mr-2" />Visual
                      </Button>
                      <Button onClick={() => openReport(report, 'data')} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50" size="sm" data-testid={`report-data-${report.id}`}>
                        <Eye className="w-4 h-4 mr-2" />Data
                      </Button>
                      <Button onClick={() => openReport(report, 'visual')} variant="outline" size="sm" data-testid={`report-download-${report.id}`}>
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

      {/* Report Modal */}
      <ReportModal open={modalOpen} onClose={() => setModalOpen(false)} report={activeReport} operatorId={selectedOperator !== 'all' ? selectedOperator : isOperator ? 'self' : null} dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
