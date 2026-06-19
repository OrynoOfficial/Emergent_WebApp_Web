import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Receipt, Search, Download, Eye, Printer, Filter,
  Calendar, DollarSign, CheckCircle, Clock, XCircle,
  FileText, CreditCard, Smartphone, Building, Building2, User, Mail
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { toast } from 'sonner';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import QuickDateRangeFilter, { inRange } from '@/components/common/QuickDateRangeFilter';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import FilterChipSelect from '@/components/shared/FilterChipSelect';
import Pagination from '@/components/common/Pagination';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { TabsContent } from '@/components/ui/tabs';
import BulkActionsBar, { BulkSelectHeader, BulkSelectCell } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';

const BILL_STATUS = ['all', 'paid', 'pending', 'overdue', 'cancelled'];
const PAYMENT_METHODS = ['all', 'mtn_momo', 'orange_money', 'card', 'bank_transfer', 'cash'];
const PAGE_SIZE = 25;

export default function BillsManagement() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [dateRange, setDateRange] = useState({ preset: 'all', from: null, to: null });
  const [viewMode, setViewMode] = useState('list'); // list | grid | details
  const [selectedBill, setSelectedBill] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const res = await api.get('/operator/manual-bookings/', {
        params: { channel: 'all', limit: 500 },
      });
      const orders = res.data?.bookings || [];
      // Map orders → bill shape that the UI expects
      const mapped = orders.map(o => ({
        id: o.order_number || o.id || o._id,
        order_id: o.id || o._id,
        customer_name: o.guest_customer?.name || o.customer_name || o.user_email || 'Customer',
        customer_email: o.guest_customer?.email || o.customer_email || o.user_email || '',
        service_type: o.service_type || o.service_category || 'general',
        description: o.service_name || o.service_title || `${o.service_type || 'Service'} booking`,
        amount: o.subtotal ?? o.total_amount ?? 0,
        tax: o.tax || 0,
        total: o.total_amount || o.final_amount || 0,
        status: (o.payment_status || o.status || 'pending'),
        payment_method: o.payment_method || null,
        operator_id: o.operator_id || '',
        operator_name: o.operator_name || '',
        channel: o.channel || 'online',
        created_at: o.created_at ? new Date(o.created_at).toLocaleDateString() : '',
        paid_at: o.paid_at ? new Date(o.paid_at).toLocaleDateString() : null,
        raw: o,
      }));
      setBills(mapped);
    } catch (error) {
      console.error('Failed to load bills:', error);
      toast.error('Failed to load bills');
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (bill) => {
    try {
      const text = `INVOICE ${bill.id}\n` +
        `Date: ${bill.created_at}\n` +
        `Customer: ${bill.customer_name}${bill.customer_email ? ` <${bill.customer_email}>` : ''}\n` +
        `Service: ${bill.service_type}\n` +
        `Description: ${bill.description}\n` +
        `Subtotal: ${bill.amount}\n` +
        `Tax: ${bill.tax}\n` +
        `Total: ${bill.total}\n` +
        `Payment: ${bill.payment_method || '—'} (${bill.status})\n` +
        (bill.operator_name ? `Operator: ${bill.operator_name}\n` : '');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bill.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bill downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const handlePrint = (bill) => {
    const w = window.open('', '_blank');
    if (!w) return toast.error('Popup blocked');
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${bill.id}</title>
      <style>body{font-family:sans-serif;padding:40px;} h1{color:#082c59} .row{margin:6px 0} .right{text-align:right} table{width:100%;border-collapse:collapse;margin-top:16px} th,td{padding:8px;border-bottom:1px solid #eee;text-align:left} .total{font-size:18px;font-weight:bold;color:#082c59}</style>
      </head><body>
      <h1>Invoice</h1>
      <div class="row"><strong>${bill.id}</strong> · ${bill.created_at}</div>
      <div class="row">Customer: <strong>${bill.customer_name}</strong></div>
      ${bill.customer_email ? `<div class="row">Email: ${bill.customer_email}</div>` : ''}
      ${bill.operator_name ? `<div class="row">Operator: ${bill.operator_name}</div>` : ''}
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>${bill.description}</td><td class="right">${bill.amount}</td></tr>
          <tr><td>Tax</td><td class="right">${bill.tax}</td></tr>
          <tr><td class="total">Total</td><td class="right total">${bill.total}</td></tr>
        </tbody>
      </table>
      <div class="row">Status: <strong>${bill.status}</strong></div>
      <div class="row">Payment method: ${bill.payment_method || '—'}</div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const handleExportAll = () => {
    try {
      const header = ['Invoice', 'Customer', 'Email', 'Service', 'Description', 'Amount', 'Tax', 'Total', 'Status', 'Payment', 'Operator', 'Channel', 'Date'];
      const rows = filteredBills.map(b => [
        b.id, b.customer_name, b.customer_email, b.service_type, b.description,
        b.amount, b.tax, b.total, b.status, b.payment_method || '', b.operator_name || '', b.channel, b.created_at
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredBills.length} bills`);
    } catch {
      toast.error('Export failed');
    }
  };

  const filteredBills = useMemo(() => bills.filter(bill => {
    const matchesSearch = bill.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || bill.payment_method === paymentFilter;
    const matchesOperator = !operatorFilter || bill.operator_id === operatorFilter;
    const matchesDate = inRange(bill.created_at, dateRange.from, dateRange.to);
    return matchesSearch && matchesStatus && matchesPayment && matchesOperator && matchesDate;
  }), [bills, searchQuery, statusFilter, paymentFilter, operatorFilter, dateRange]);

  // Reset pagination when filters change (React-recommended: adjust state during render)
  const filterKey = `${searchQuery}|${statusFilter}|${paymentFilter}|${operatorFilter}|${dateRange.from}|${dateRange.to}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) { setPrevFilterKey(filterKey); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const pagedBills = useMemo(() => filteredBills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredBills, page]);

  // Bulk selection (delete only; bills don't have an active/inactive flag).
  const bulk = useBulkSelection(pagedBills, { idKey: 'id' });
  const bulkDelete = async (ids) => {
    await api.post('/admin/bulk', { collection: 'bills', action: 'delete', ids });
    await loadBills();
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    const icons = {
      paid: <CheckCircle className="w-3 h-3 mr-1" />,
      pending: <Clock className="w-3 h-3 mr-1" />,
      overdue: <XCircle className="w-3 h-3 mr-1" />,
      cancelled: <XCircle className="w-3 h-3 mr-1" />
    };
    return <Badge className={styles[status]}>{icons[status]}{status}</Badge>;
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'mtn_momo': return <Smartphone className="w-4 h-4 text-yellow-600" />;
      case 'orange_money': return <Smartphone className="w-4 h-4 text-orange-600" />;
      case 'card': return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'bank_transfer': return <Building className="w-4 h-4 text-gray-600" />;
      default: return <DollarSign className="w-4 h-4 text-gray-400" />;
    }
  };

  const stats = useMemo(() => ({
    total: filteredBills.length,
    paid: filteredBills.filter(b => b.status === 'paid').length,
    pending: filteredBills.filter(b => b.status === 'pending').length,
    totalRevenue: filteredBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.total || 0), 0),
    pendingAmount: filteredBills.filter(b => b.status === 'pending' || b.status === 'overdue').reduce((sum, b) => sum + (b.total || 0), 0)
  }), [filteredBills]);

  return (
    <>
      <ManagementShell
        title="All Bills"
        icon={Receipt}
        subtitle="Manage customer bills and payment records"
        scopeFilter={
          <div className="flex items-center gap-2 flex-wrap">
            <QuickDateRangeFilter value={dateRange} onChange={setDateRange} />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button className="bg-[#082c59] h-8" size="sm" onClick={handleExportAll}><FileText className="w-3.5 h-3.5 mr-1.5" /> Export All</Button>
          </div>
        }
        onRefresh={loadBills}
        refreshing={loading}
        testIdPrefix="bills-mgmt"
        activeTab="all"
      >
        <TabsContent value="all" className="mt-4 space-y-4" forceMount>
          <SubpageCard title="Scope" icon={Filter} testId="bills-scope-card">
            <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
          </SubpageCard>

          {/* Filters */}
          <SubpageCard title="Filters" icon={Search} count={filteredBills.length} testId="bills-filters-card">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input placeholder="Search bills..." className="pl-9 h-8 bg-white text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="bills-search-input" />
            </div>
            <FilterChipSelect
              icon={CheckCircle}
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={BILL_STATUS.map(s => ({ value: s, label: s === 'all' ? 'All status' : s }))}
              data-testid="bills-status-filter"
            />
            <FilterChipSelect
              icon={CreditCard}
              label="Payment"
              value={paymentFilter}
              onChange={setPaymentFilter}
              options={PAYMENT_METHODS.map(p => ({ value: p, label: p === 'all' ? 'All methods' : p.replace('_', ' ') }))}
              data-testid="bills-payment-filter"
            />
          </SubpageCard>

          {/* Stats (dynamic — reflects active filters) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4" data-testid="bills-stats-grid">
            <Card><CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg"><Receipt className="w-6 h-6 text-blue-600" /></div>
              <div><p className="text-sm text-gray-500">Total Bills</p><p className="text-2xl font-bold">{stats.total}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
              <div><p className="text-sm text-gray-500">Paid</p><p className="text-2xl font-bold">{stats.paid}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg"><Clock className="w-6 h-6 text-yellow-600" /></div>
              <div><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold">{stats.pending}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg"><DollarSign className="w-6 h-6 text-purple-600" /></div>
              <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold">{formatFCFA(stats.totalRevenue)}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg"><Clock className="w-6 h-6 text-orange-600" /></div>
              <div><p className="text-sm text-gray-500">Pending Amount</p><p className="text-xl font-bold">{formatFCFA(stats.pendingAmount)}</p></div>
            </CardContent></Card>
          </div>

      {/* Bills */}
      {loading ? (
        <Card><CardContent className="py-16 text-center text-slate-500">Loading bills...</CardContent></Card>
      ) : filteredBills.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-slate-500">No bills found</CardContent></Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="bills-grid-view">
          {pagedBills.map(bill => (
            <Card key={bill.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs font-bold text-[#082c59] truncate">{bill.id}</span>
                  {getStatusBadge(bill.status)}
                </div>
                <div className="text-sm">
                  <p className="font-medium truncate">{bill.customer_name}</p>
                  <p className="text-xs text-gray-500 truncate">{bill.customer_email}</p>
                </div>
                {bill.service_type && <Badge variant="outline" className="capitalize text-xs">{bill.service_type.replace('_', ' ')}</Badge>}
                <p className="text-sm text-slate-600 line-clamp-2">{bill.description}</p>
                <div className="pt-2 border-t">
                  <p className="text-[10px] uppercase text-slate-400">Total</p>
                  <p className="text-xl font-bold text-[#082c59]">{formatFCFA(bill.total)}</p>
                </div>
                {bill.payment_method && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    {getPaymentIcon(bill.payment_method)}
                    <span className="capitalize">{bill.payment_method.replace('_', ' ')}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedBill(bill); setIsDetailOpen(true); }}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                  <Button size="sm" className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]" onClick={() => handleDownload(bill)}><Download className="w-3.5 h-3.5 mr-1" /> PDF</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === 'details' ? (
        <div className="space-y-3" data-testid="bills-details-view">
          {pagedBills.map(bill => (
            <Card key={bill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#082c59]">{bill.id}</span>
                  {getStatusBadge(bill.status)}
                  {bill.service_type && <Badge variant="outline" className="capitalize text-xs">{bill.service_type.replace('_', ' ')}</Badge>}
                </div>
                <h3 className="font-semibold text-slate-900">{bill.description}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Customer</p>
                    <p className="text-slate-700 font-medium flex items-center gap-1"><User className="h-3 w-3" /> {bill.customer_name}</p>
                  </div>
                  {bill.customer_email && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Email</p>
                      <p className="text-slate-700 font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {bill.customer_email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Created</p>
                    <p className="text-slate-700 font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {bill.created_at}</p>
                  </div>
                  {bill.paid_at && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Paid On</p>
                      <p className="text-slate-700 font-medium">{bill.paid_at}</p>
                    </div>
                  )}
                  {bill.operator_name && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Operator</p>
                      <p className="text-slate-700 font-medium flex items-center gap-1"><Building2 className="h-3 w-3" /> {bill.operator_name}</p>
                    </div>
                  )}
                  {bill.payment_method && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Payment</p>
                      <p className="text-slate-700 font-medium flex items-center gap-1 capitalize">{getPaymentIcon(bill.payment_method)}{bill.payment_method.replace('_', ' ')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Subtotal</p>
                    <p className="text-slate-700 font-medium">{formatFCFA(bill.amount)}</p>
                  </div>
                  {bill.tax > 0 && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Tax</p>
                      <p className="text-slate-700 font-medium">{formatFCFA(bill.tax)}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(bill.total)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedBill(bill); setIsDetailOpen(true); }}><Eye className="w-4 h-4 mr-1" /> View</Button>
                    <Button size="sm" className="bg-[#082c59] hover:bg-[#0a3a75]" onClick={() => handleDownload(bill)}><Download className="w-4 h-4 mr-1" /> PDF</Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(bill)}><Printer className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
      <Card data-testid="bills-list-view">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 w-10">
                    <BulkSelectHeader
                      allSelected={bulk.allSelected}
                      partiallySelected={bulk.partiallySelected}
                      onToggleAll={bulk.toggleAll}
                      testid="bills-bulk-select-all"
                    />
                  </th>
                  <th className="text-left p-4 font-medium">Invoice</th>
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Description</th>
                  <th className="text-left p-4 font-medium">Amount</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Payment</th>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedBills.map(bill => (
                    <tr key={bill.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 w-10">
                        <BulkSelectCell
                          selected={bulk.isSelected(bill.id)}
                          onToggle={bulk.toggle}
                          id={bill.id}
                        />
                      </td>
                      <td className="p-4 font-mono text-sm">{bill.id}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{bill.customer_name}</p>
                          <p className="text-sm text-gray-500">{bill.customer_email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <Badge variant="outline" className="capitalize mb-1">{bill.service_type?.replace('_', ' ')}</Badge>
                          <p className="text-sm">{bill.description}</p>
                        </div>
                      </td>
                      <td className="p-4 font-semibold">{formatFCFA(bill.total)}</td>
                      <td className="p-4">{getStatusBadge(bill.status)}</td>
                      <td className="p-4">
                        {bill.payment_method ? (
                          <div className="flex items-center gap-2">
                            {getPaymentIcon(bill.payment_method)}
                            <span className="text-sm capitalize">{bill.payment_method.replace('_', ' ')}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-sm text-gray-500">{bill.created_at}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedBill(bill); setIsDetailOpen(true); }} title="View"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(bill)} title="Download"><Download className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePrint(bill)} title="Print"><Printer className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            total={filteredBills.length}
            pageSize={PAGE_SIZE}
            itemLabel="bill"
            className="mt-2"
          />
        </TabsContent>
      </ManagementShell>

      {/* Bill Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-lg font-bold">{selectedBill.id}</p>
                  <p className="text-sm text-gray-500">Created: {selectedBill.created_at}</p>
                </div>
                {getStatusBadge(selectedBill.status)}
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Customer</h4>
                <p>{selectedBill.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedBill.customer_email}</p>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Service</h4>
                <p>{selectedBill.description}</p>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatFCFA(selectedBill.amount)}</span></div>
                <div className="flex justify-between"><span>Tax (10%)</span><span>{formatFCFA(selectedBill.tax)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="text-[#082c59]">{formatFCFA(selectedBill.total)}</span></div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
                <Button variant="outline" className="flex-1"><Printer className="w-4 h-4 mr-2" /> Print</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkActionsBar
        count={bulk.count}
        entityLabel="bill"
        selectedIds={bulk.selectedIds}
        selectedRows={bulk.selectedRows}
        onClear={bulk.clear}
        onDelete={bulkDelete}
        onExport={(rows) => rows.map(b => ({
          id: b.id, customer: b.customer_name, email: b.customer_email,
          service: b.service_type, total: b.total, status: b.status,
          payment: b.payment_method, created: b.created_at,
        }))}
      />
    </>
  );
}
