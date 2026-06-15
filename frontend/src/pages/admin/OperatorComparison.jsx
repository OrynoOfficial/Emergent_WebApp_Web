import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select';
import { Loader2, X, Plus, TrendingUp, ShoppingBag, CheckCircle2, BarChart3, Trophy, Banknote } from 'lucide-react';
import { formatFCFA } from '../../utils/currency';
import api from '../../api/client';
import ManagementShell from '../../components/management/shared/ManagementShell';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const OP_COLORS = ['#082c59', '#0ea5e9', '#f97316']; // 1st/2nd/3rd column
const PERIODS = [
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '1year', label: 'Last 12 months' },
];

export default function OperatorComparison() {
  const [allOperators, setAllOperators] = useState([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(['', '']); // up to 3 slots
  const [period, setPeriod] = useState('30days');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch the operator catalog once
  useEffect(() => {
    (async () => {
      try {
        setOpsLoading(true);
        const { data } = await api.get('/operators/?limit=100');
        const list = (data?.operators || []).map((o) => ({
          id: o.id || o._id,
          name: o.name || o.operator_name || o.company_name || o.id,
        }));
        setAllOperators(list);
      } catch {
        setAllOperators([]);
      } finally {
        setOpsLoading(false);
      }
    })();
  }, []);

  // Re-fetch comparison whenever picks or period change (need ≥2 ids)
  useEffect(() => {
    const ids = selectedIds.filter(Boolean);
    if (ids.length < 2) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/analytics/admin/operator-comparison', {
          params: { operator_ids: ids.join(','), period },
        });
        if (!cancelled) setData(data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedIds, period]);

  const setSlot = (idx, value) => {
    setSelectedIds((arr) => {
      const next = [...arr];
      next[idx] = value;
      return next;
    });
  };

  const removeSlot = (idx) => {
    setSelectedIds((arr) => arr.filter((_, i) => i !== idx));
  };

  const addSlot = () => {
    setSelectedIds((arr) => (arr.length < 3 ? [...arr, ''] : arr));
  };

  // Build merged daily chart data — { date, [opName]: revenue, ... }
  const mergedChart = useMemo(() => {
    if (!data?.operators) return [];
    const byDate = new Map();
    data.operators.forEach((op) => {
      (op.daily_data || []).forEach((d) => {
        const row = byDate.get(d.date) || { date: d.date };
        row[op.operator_name] = d.revenue;
        byDate.set(d.date, row);
      });
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Identify the winner for each KPI (used to surface a small "leader" badge)
  const winners = useMemo(() => {
    if (!data?.operators?.length) return {};
    const max = (key) => data.operators.reduce((acc, op) =>
      (op[key] > (acc?.[key] ?? -Infinity) ? op : acc), null);
    return {
      revenue: max('total_revenue')?.operator_id,
      orders: max('total_orders')?.operator_id,
      completion: max('completion_rate')?.operator_id,
      aov: max('avg_order_value')?.operator_id,
    };
  }, [data]);

  const opPickerSlots = selectedIds;

  return (
    <ManagementShell
      title="Operator Comparison"
      icon={BarChart3}
      subtitle="Stack 2–3 operators side-by-side to spot performance gaps across the same period."
      scopeFilter={
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="comparison-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      testIdPrefix="op-comparison"
      activeTab="all"
    >
      {/* Operator pickers */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Pick operators to compare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {opPickerSlots.map((selected, idx) => {
              const available = allOperators.filter(
                (op) => !selectedIds.includes(op.id) || op.id === selected
              );
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: OP_COLORS[idx] || '#94a3b8' }}
                  />
                  <Select value={selected} onValueChange={(v) => setSlot(idx, v)} disabled={opsLoading}>
                    <SelectTrigger data-testid={`comparison-operator-slot-${idx}`} className="flex-1">
                      <SelectValue placeholder={opsLoading ? 'Loading…' : `Operator ${idx + 1}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((op) => (
                        <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedIds.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSlot(idx)} title="Remove">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {selectedIds.length < 3 && (
            <Button
              variant="outline" size="sm" className="mt-3" onClick={addSlot}
              data-testid="comparison-add-operator"
            >
              <Plus className="h-4 w-4 mr-1" /> Add a third operator
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Comparing operators…
        </div>
      ) : !data?.operators?.length ? (
        <div className="text-center py-16 text-slate-400 text-sm" data-testid="comparison-empty">
          Pick at least 2 operators above to see the comparison.
        </div>
      ) : (
        <>
          {/* Side-by-side KPI cards */}
          <div className={`grid grid-cols-1 ${data.operators.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4`}>
            {data.operators.map((op, idx) => (
              <Card
                key={op.operator_id}
                className="border-l-4"
                style={{ borderLeftColor: OP_COLORS[idx] || '#94a3b8' }}
                data-testid={`comparison-card-${op.operator_id}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#082c59] flex items-center justify-between">
                    <span className="truncate" title={op.operator_name}>{op.operator_name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Kpi
                    icon={Banknote}
                    label="Revenue"
                    value={formatFCFA(op.total_revenue || 0)}
                    leader={winners.revenue === op.operator_id}
                  />
                  <Kpi
                    icon={ShoppingBag}
                    label="Orders"
                    value={op.total_orders}
                    leader={winners.orders === op.operator_id}
                  />
                  <Kpi
                    icon={TrendingUp}
                    label="Avg Order Value"
                    value={formatFCFA(op.avg_order_value || 0)}
                    leader={winners.aov === op.operator_id}
                  />
                  <Kpi
                    icon={CheckCircle2}
                    label="Completion Rate"
                    value={`${op.completion_rate}%`}
                    leader={winners.completion === op.operator_id}
                  />
                  <div className="flex items-center gap-2 text-xs pt-1 border-t">
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700">{op.completed_orders} done</Badge>
                    <Badge variant="outline" className="border-amber-200 text-amber-700">{op.pending_orders} pending</Badge>
                    <Badge variant="outline" className="border-red-200 text-red-600">{op.cancelled_orders} cancelled</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Daily revenue trend overlay */}
          <Card data-testid="comparison-chart-card">
            <CardHeader>
              <CardTitle className="text-base text-[#082c59]">Daily revenue — overlay</CardTitle>
            </CardHeader>
            <CardContent>
              {mergedChart.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No orders in this period to chart.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={mergedChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                    <Tooltip formatter={(v) => formatFCFA(v)} />
                    <Legend />
                    {data.operators.map((op, idx) => (
                      <Line
                        key={op.operator_id}
                        type="monotone"
                        dataKey={op.operator_name}
                        stroke={OP_COLORS[idx] || '#94a3b8'}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#082c59]">Revenue by service category</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-medium text-slate-600">Category</th>
                    {data.operators.map((op, idx) => (
                      <th key={op.operator_id} className="py-2 px-3 font-medium" style={{ color: OP_COLORS[idx] }}>
                        {op.operator_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {buildCategoryRows(data.operators).map((row) => (
                    <tr key={row.category} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 capitalize font-medium text-slate-700">{row.category}</td>
                      {data.operators.map((op) => {
                        const val = row.values[op.operator_id];
                        return (
                          <td key={op.operator_id} className="py-2 px-3 text-slate-700">
                            {val ? (
                              <div>
                                <p className="font-semibold">{formatFCFA(val.revenue)}</p>
                                <p className="text-xs text-slate-400">{val.orders} orders</p>
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </ManagementShell>
  );
}

function Kpi({ icon: Icon, label, value, leader }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-600">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-slate-800">{value}</span>
        {leader && (
          <Trophy className="h-3.5 w-3.5 text-amber-500" title="Top across selection" />
        )}
      </div>
    </div>
  );
}

// Pivot operator-by-category data into one row per category for the table.
function buildCategoryRows(operators) {
  const categories = new Set();
  operators.forEach((op) => (op.by_category || []).forEach((c) => categories.add(c.category)));
  return Array.from(categories).sort().map((cat) => ({
    category: cat,
    values: Object.fromEntries(
      operators.map((op) => {
        const cell = (op.by_category || []).find((c) => c.category === cat);
        return [op.operator_id, cell ? { orders: cell.orders, revenue: cell.revenue } : null];
      })
    ),
  }));
}
