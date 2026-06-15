import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import {
  BarChart3, TrendingUp, TrendingDown, Download, Eye, ChevronDown,
  DollarSign, Users, Target, MessageSquare, Activity,
  FileText, Loader2, Calendar, RefreshCw, Table2, Search,
  Building2, ArrowUpRight, ArrowDownRight, Minus, FileDown, FileSpreadsheet, FileJson
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { TabsContent } from '@/components/ui/tabs';

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
  operational: { label: "Operational", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  financial: { label: "Financial", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  customer: { label: "Customer", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
};

const DATE_PRESETS = [
  { label: "Last 3 Days", days: 3 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 14 Days", days: 14 },
  { label: "Last Month", days: 30 },
  { label: "Last 3 Months", days: 90 },
];

const SERVICE_TYPES = [
  { value: "all", label: "All Services" },
  { value: "travel", label: "Travel" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cinema", label: "Cinema" },
  { value: "pressing", label: "Laundry" },
  { value: "banquet", label: "Banquet" },
  { value: "packages", label: "Packages" },
  { value: "car_rental", label: "Car Rental" },
  { value: "events", label: "Events" },
];

function formatNum(n) {
  if (n == null) return '0';
  if (typeof n === 'string') return n;
  return n.toLocaleString();
}

function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

// ========== Animated KPI Card ==========
function KpiCard({ label, value, suffix = '', index = 0, prevValue }) {
  const trend = prevValue != null && typeof value === 'number' && typeof prevValue === 'number'
    ? ((value - prevValue) / (prevValue || 1) * 100).toFixed(1)
    : null;
  const isUp = trend > 0;
  const isDown = trend < 0;

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
      style={{ animationDelay: `${index * 80}ms` }}
      data-testid={`kpi-${label.replace(/\s/g, '-').toLowerCase()}`}
    >
      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2 group-hover:text-slate-500 transition-colors">
        {label.replace(/_/g, ' ')}
      </p>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-[#082c59] tabular-nums animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ animationDelay: `${index * 80 + 150}ms`, animationFillMode: 'backwards' }}>
          {formatNum(value)}{suffix}
        </p>
        {trend != null && Math.abs(trend) > 0.1 && (
          <div className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : isDown ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Chart Renderer ==========
function ChartBlock({ chart, index = 0 }) {
  if (!chart || !chart.data || chart.data.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No data available</div>;
  }
  const xKey = Object.keys(chart.data[0]).find(k => ['name', 'date', 'month', 'hour', 'day'].includes(k)) || 'name';
  const dataKeys = Object.keys(chart.data[0]).filter(k => k !== xKey);

  if (chart.type === 'pie') {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'backwards' }}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius={110} innerRadius={55}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false} fontSize={11} animationDuration={800} animationBegin={index * 100}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatNum(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chart.type === 'line' || chart.type === 'area') {
    const ChartComp = chart.type === 'area' ? AreaChart : LineChart;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'backwards' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ChartComp data={chart.data}>
            <defs>
              {dataKeys.map((k, i) => (
                <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v) => formatNum(v)} />
            {dataKeys.map((k, i) => (
              chart.type === 'area'
                ? <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#grad-${k})`} strokeWidth={2} dot={false} animationDuration={1000} animationBegin={i * 200} />
                : <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: '#fff', stroke: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={1000} animationBegin={i * 200} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </ChartComp>
        </ResponsiveContainer>
      </div>
    );
  }
  // Default: bar
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'backwards' }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chart.data}>
          <defs>
            {dataKeys.map((k, i) => (
              <linearGradient key={k} id={`bar-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.9} />
                <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v) => formatNum(v)} cursor={{ fill: 'rgba(8,44,89,0.04)' }} />
          {dataKeys.map((k, i) => <Bar key={k} dataKey={k} fill={`url(#bar-${k})`} radius={[6, 6, 0, 0]} animationDuration={800} animationBegin={i * 150} />)}
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========== Inline Report View ==========
function ReportView({ data, viewMode }) {
  if (!data) return null;

  if (viewMode === 'data') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {data.summary && (
          <Card className="border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#082c59] to-[#0a3a75] px-5 py-3">
              <h4 className="font-semibold text-sm text-white flex items-center gap-2"><Table2 className="w-4 h-4" /> Key Metrics</h4>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Metric</th>
                    <th className="py-3 px-5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val], i) => (
                    <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors animate-in fade-in slide-in-from-left-2 duration-300"
                      style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                      <td className="py-3 px-5 text-slate-700 capitalize font-medium">{key.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-5 text-right font-bold text-[#082c59] tabular-nums">{formatNum(val)}{key.includes('rate') ? '%' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
        {data.table && (
          <Card className="border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3">
              <h4 className="font-semibold text-sm text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Detailed Data</h4>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {data.table.headers.map((h, i) => (
                        <th key={i} className="py-3 px-4 text-left font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors animate-in fade-in duration-200"
                        style={{ animationDelay: `${ri * 30}ms`, animationFillMode: 'backwards' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2.5 px-4 text-slate-700 tabular-nums">{formatNum(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.table.rows.length === 0 && <p className="text-center py-10 text-slate-400">No detailed data available</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Visual mode
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {data.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data.summary).filter(([k]) => k !== 'currency').map(([key, val], i) => (
            <KpiCard key={key} label={key} value={val} suffix={key.includes('rate') ? '%' : ''} index={i} />
          ))}
        </div>
      )}
      {data.charts?.map((chart, i) => (
        <Card key={i} className="border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-6">
            <h4 className="font-semibold text-sm text-slate-800 mb-1">{chart.title}</h4>
            {chart.subtitle && <p className="text-xs text-slate-400 mb-4">{chart.subtitle}</p>}
            <ChartBlock chart={chart} index={i} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ========== Download Helpers ==========
function downloadCSV(data, filename) {
  if (!data?.table) { toast.error('No table data for CSV'); return; }
  const rows = [data.table.headers.join(','), ...data.table.rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${filename}.json`; a.click(); URL.revokeObjectURL(url);
}

async function downloadPDF(containerId, filename) {
  try {
    toast.info('Generating PDF...');
    const el = document.getElementById(containerId);
    if (!el) { toast.error('Nothing to export'); return; }
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${filename}.pdf`);
    toast.success('PDF downloaded');
  } catch (err) {
    console.error('PDF export error:', err);
    toast.error('PDF export failed');
  }
}

// ========== Date Range Picker ==========
function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const [open, setOpen] = useState(false);

  // Sync local state when prop changes (React docs: adjust state during render)
  const [prevDateFrom, setPrevDateFrom] = useState(dateFrom);
  const [prevDateTo, setPrevDateTo] = useState(dateTo);
  if (dateFrom !== prevDateFrom || dateTo !== prevDateTo) {
    setPrevDateFrom(dateFrom);
    setPrevDateTo(dateTo);
    setCustomFrom(dateFrom);
    setCustomTo(dateTo);
  }

  const applyPreset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const df = from.toISOString().slice(0, 10);
    const dt = to.toISOString().slice(0, 10);
    onChange(df, dt);
    setOpen(false);
  };

  const applyCustom = () => {
    onChange(customFrom, customTo);
    setOpen(false);
  };

  const clear = () => {
    onChange('', '');
    setOpen(false);
  };

  const label = dateFrom && dateTo
    ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
    : dateFrom ? `From ${formatDate(dateFrom)}`
    : dateTo ? `Until ${formatDate(dateTo)}`
    : 'All Time';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 text-sm font-normal min-w-[200px] justify-start" data-testid="date-range-trigger">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className={dateFrom || dateTo ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
          {(dateFrom || dateTo) && (
            <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1 bg-blue-50 text-blue-600 border-blue-200">Active</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white" align="start">
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Select</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DATE_PRESETS.map(p => (
              <button key={p.days} onClick={() => applyPreset(p.days)}
                className="text-left px-3 py-2 rounded-lg text-sm hover:bg-[#082c59] hover:text-white transition-colors text-slate-700">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Range</p>
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-sm h-9" />
            <span className="text-slate-300 text-xs">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-sm h-9" />
          </div>
          <Button onClick={applyCustom} size="sm" className="w-full mt-2 bg-[#082c59] hover:bg-[#0a3a75] h-8 text-xs">Apply Custom Range</Button>
        </div>
        {(dateFrom || dateTo) && (
          <div className="p-2">
            <button onClick={clear} className="w-full text-center text-xs text-red-500 hover:text-red-700 py-1.5">Clear Date Filter</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ========== Operator Scope Selector ==========
function OperatorScope({ operators, value, onChange }) {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  const filtered = operators.filter(op => {
    const matchSearch = !search || op.name.toLowerCase().includes(search.toLowerCase());
    const matchService = serviceFilter === 'all'
      || op.operator_type === serviceFilter
      || op.operator_type === 'multi'
      || (op.service_types || []).includes(serviceFilter);
    return matchSearch && matchService;
  });

  const selectedName = operators.find(op => op.id === value)?.name;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 text-sm font-normal min-w-[180px] justify-start" data-testid="operator-scope-trigger">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className={value ? 'text-slate-800 truncate max-w-[140px]' : 'text-slate-400'}>
            {selectedName || 'All Operators'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-white" align="end">
        <div className="p-2 border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search operators..." className="pl-8 h-8 text-xs" />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          <button onClick={() => onChange('all')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${!value ? 'bg-blue-50 text-[#082c59] font-medium' : 'text-slate-700'}`}>
            <Building2 className="w-4 h-4 text-slate-400" /> All Operators
            <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1">{operators.length}</Badge>
          </button>
          {filtered.map(op => (
            <button key={op.id} onClick={() => onChange(op.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${value === op.id ? 'bg-blue-50 text-[#082c59] font-medium' : 'text-slate-700'}`}>
              <div className="w-6 h-6 rounded-full bg-[#082c59]/10 flex items-center justify-center text-[10px] font-bold text-[#082c59]">
                {op.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block truncate text-sm">{op.name}</span>
                {op.operator_type && <span className="text-[10px] text-slate-400">{op.operator_type}</span>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-4">No operators found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ========== Main Page ==========
export default function SystemReports() {
  const { user } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState('');
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
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
      api.get('/operators/by-service').then(r => setOperators(r.data.operators || [])).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    const handleClick = (e) => { if (dlRef.current && !dlRef.current.contains(e.target)) setShowDownloadMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedReportId) { setReportData(null); return; }
    setLoading(true); setReportData(null);
    try {
      const params = new URLSearchParams({ report_id: selectedReportId });
      if (selectedOperator) params.append('operator_id', selectedOperator);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await api.get(`/reports/generate?${params}`);
      setReportData(res.data);
    } catch { toast.error('Failed to generate report'); }
    finally { setLoading(false); }
  }, [selectedReportId, selectedOperator, dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filename = `${selectedReportId || 'report'}_${reportData?.scope?.replace(/\s/g, '_') || 'all'}_${new Date().toISOString().slice(0, 10)}`;

  return (
    <>
      <ManagementShell
        title="Reports"
        icon={BarChart3}
        subtitle="Business intelligence and operational analytics"
        scopeFilter={isAdmin && (
          <OperatorScope operators={operators} value={selectedOperator} onChange={(v) => setSelectedOperator(v === 'all' ? '' : v)} />
        )}
        testIdPrefix="system-reports-mgmt"
        activeTab="all"
      >
        <TabsContent value="all" className="mt-4 space-y-4" forceMount>

      {/* Controls Bar */}
      <SubpageCard title="Report" icon={FileText} testId="system-reports-controls-card">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full">
            {/* Report Selector */}
            <div className="flex-1 min-w-0">
              <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                <SelectTrigger className="bg-white h-9 text-sm w-full" data-testid="report-selector">
                  <SelectValue placeholder="Select a report...">
                    {selectedReport && (
                      <div className="flex items-center gap-2">
                        <selectedReport.icon className="h-4 w-4 text-[#082c59]" />
                        <span className="font-medium">{selectedReport.name}</span>
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
                                <span className="text-xs text-slate-400 ml-2 hidden md:inline">{r.description}</span>
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

            {/* Date Range Picker */}
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />

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
                <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="h-8 w-8 p-0" title="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {/* Download dropdown */}
                <div className="relative" ref={dlRef}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => setShowDownloadMenu(!showDownloadMenu)} disabled={!reportData} data-testid="download-btn">
                    <Download className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" />
                  </Button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[180px] py-1.5 animate-in fade-in zoom-in-95 duration-150">
                      <button onClick={() => { downloadPDF('report-content', filename); setShowDownloadMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 transition-colors">
                        <FileDown className="w-4 h-4 text-red-500" />
                        <div><span className="font-medium">PDF</span><span className="text-xs text-slate-400 ml-1">Visual export</span></div>
                      </button>
                      <button onClick={() => { downloadCSV(reportData, filename); setShowDownloadMenu(false); toast.success('CSV downloaded'); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 transition-colors">
                        <FileSpreadsheet className="w-4 h-4 text-green-500" />
                        <div><span className="font-medium">CSV</span><span className="text-xs text-slate-400 ml-1">Spreadsheet data</span></div>
                      </button>
                      <button onClick={() => { downloadJSON(reportData, filename); setShowDownloadMenu(false); toast.success('JSON downloaded'); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 transition-colors">
                        <FileJson className="w-4 h-4 text-blue-500" />
                        <div><span className="font-medium">JSON</span><span className="text-xs text-slate-400 ml-1">Raw data</span></div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
      </SubpageCard>

      {/* Report Content */}
      <div id="report-content">
        {!selectedReportId ? (
          <div className="text-center py-24 animate-in fade-in duration-500">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <BarChart3 className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400">Select a report to get started</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">Choose from the dropdown above to view detailed analytics and insights</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-28 animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-[#082c59] animate-spin" />
            </div>
            <span className="mt-5 text-slate-500 font-medium">Generating {selectedReport?.name}...</span>
            <span className="text-xs text-slate-400 mt-1">Crunching the numbers</span>
          </div>
        ) : reportData ? (
          <div className="animate-in fade-in duration-300">
            {/* Report header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {selectedReport && (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${CATEGORIES[selectedReport.category]?.color}`}>
                    <selectedReport.icon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{reportData.title || selectedReport?.name}</h2>
                  <p className="text-xs text-slate-500">
                    {reportData.scope && <><span className="font-medium">Scope:</span> {reportData.scope}</>}
                    {reportData.generated_at && <> &middot; Generated {new Date(reportData.generated_at).toLocaleString()}</>}
                  </p>
                </div>
              </div>
            </div>
            <ReportView data={reportData} viewMode={viewMode} />
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">No data returned for this report</div>
        )}
      </div>
        </TabsContent>
      </ManagementShell>
    </>
  );
}
