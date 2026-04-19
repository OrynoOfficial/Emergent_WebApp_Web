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
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import QuickDateRangeFilter, { inRange } from '@/components/common/QuickDateRangeFilter';
import ViewModeToggle from '@/components/common/ViewModeToggle';

const BILL_STATUS = ['all', 'paid', 'pending', 'overdue', 'cancelled'];
const PAYMENT_METHODS = ['all', 'mtn_momo', 'orange_money', 'card', 'bank_transfer', 'cash'];

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

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders/');
      const data = res.data.orders || res.data || [];
      setBills(data.length > 0 ? data : mockBills);
    } catch (error) {
      console.error('Failed to load bills:', error);
      setBills(mockBills);
    } finally {
      setLoading(false);
    }
  };

  const mockBills = [
    { id: 'INV-2025-001', customer_name: 'Jean Mbarga', customer_email: 'jean@example.com', service_type: 'hotels', description: 'Hilton Yaounde - 3 nights', amount: 255000, tax: 25500, total: 280500, status: 'paid', payment_method: 'mtn_momo', created_at: '2025-12-20', paid_at: '2025-12-20' },
    { id: 'INV-2025-002', customer_name: 'Marie Ngo', customer_email: 'marie@example.com', service_type: 'travel', description: 'Yaounde to Douala - 2 tickets', amount: 12000, tax: 1200, total: 13200, status: 'paid', payment_method: 'orange_money', created_at: '2025-12-19', paid_at: '2025-12-19' },
    { id: 'INV-2025-003', customer_name: 'Paul Fotso', customer_email: 'paul@example.com', service_type: 'car_rental', description: 'Mercedes C-Class - 5 days', amount: 475000, tax: 47500, total: 522500, status: 'pending', payment_method: null, created_at: '2025-12-18', paid_at: null },
    { id: 'INV-2025-004', customer_name: 'Aminata Diallo', customer_email: 'aminata@example.com', service_type: 'restaurants', description: 'La Belle Epoque - Dinner for 4', amount: 85000, tax: 8500, total: 93500, status: 'paid', payment_method: 'card', created_at: '2025-12-17', paid_at: '2025-12-17' },
    { id: 'INV-2025-005', customer_name: 'Emmanuel Tchamba', customer_email: 'emmanuel@example.com', service_type: 'events', description: 'Concert Ticket x2', amount: 30000, tax: 3000, total: 33000, status: 'overdue', payment_method: null, created_at: '2025-12-10', paid_at: null },
    { id: 'INV-2025-006', customer_name: 'Sylvie Kamga', customer_email: 'sylvie@example.com', service_type: 'packages', description: 'Kribi Beach Escape - 2 persons', amount: 300000, tax: 30000, total: 330000, status: 'cancelled', payment_method: null, created_at: '2025-12-15', paid_at: null },
    { id: 'INV-2025-007', customer_name: 'Bruno Essomba', customer_email: 'bruno@example.com', service_type: 'hotels', description: 'Mont Febe Hotel - 2 nights', amount: 180000, tax: 18000, total: 198000, status: 'paid', payment_method: 'bank_transfer', created_at: '2025-12-16', paid_at: '2025-12-17' },
    { id: 'INV-2025-008', customer_name: 'Claire Mvondo', customer_email: 'claire@example.com', service_type: 'laundry', description: 'Premium Laundry Service', amount: 15000, tax: 1500, total: 16500, status: 'pending', payment_method: null, created_at: '2025-12-21', paid_at: null }
  ];

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

  const stats = {
    total: bills.length,
    paid: bills.filter(b => b.status === 'paid').length,
    pending: bills.filter(b => b.status === 'pending').length,
    totalRevenue: bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.total || 0), 0),
    pendingAmount: bills.filter(b => b.status === 'pending' || b.status === 'overdue').reduce((sum, b) => sum + (b.total || 0), 0)
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">All Bills</h1>
          <p className="text-gray-600">Manage customer bills and payment records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickDateRangeFilter value={dateRange} onChange={setDateRange} />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button className="bg-[#082c59]"><FileText className="w-4 h-4 mr-2" /> Export All</Button>
        </div>
      </div>

      <div className="flex">
        <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search bills..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-white">
                {BILL_STATUS.map(s => <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Payment Method" /></SelectTrigger>
              <SelectContent className="bg-white">
                {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p} className="capitalize">{p === 'all' ? 'All Methods' : p.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bills */}
      {loading ? (
        <Card><CardContent className="py-16 text-center text-slate-500">Loading bills...</CardContent></Card>
      ) : filteredBills.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-slate-500">No bills found</CardContent></Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="bills-grid-view">
          {filteredBills.map(bill => (
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
                  <Button size="sm" className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]"><Download className="w-3.5 h-3.5 mr-1" /> PDF</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === 'details' ? (
        <div className="space-y-3" data-testid="bills-details-view">
          {filteredBills.map(bill => (
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
                    <Button size="sm" className="bg-[#082c59] hover:bg-[#0a3a75]"><Download className="w-4 h-4 mr-1" /> PDF</Button>
                    <Button variant="outline" size="sm"><Printer className="w-4 h-4" /></Button>
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
                {filteredBills.map(bill => (
                    <tr key={bill.id} className="border-b hover:bg-slate-50">
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
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedBill(bill); setIsDetailOpen(true); }}><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm"><Printer className="w-4 h-4" /></Button>
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
    </div>
  );
}
