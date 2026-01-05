import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Receipt, Search, Download, Eye, Printer, Filter,
  Calendar, DollarSign, CheckCircle, Clock, XCircle,
  FileText, CreditCard, Smartphone, Building
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const BILL_STATUS = ['all', 'paid', 'pending', 'overdue', 'cancelled'];
const PAYMENT_METHODS = ['all', 'mtn_momo', 'orange_money', 'card', 'bank_transfer', 'cash'];

export default function BillsManagement() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
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

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || bill.payment_method === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Bills & Invoices</h1>
          <p className="text-gray-600">Manage customer bills and payment records</p>
        </div>
        <Button className="bg-[#082c59]"><FileText className="w-4 h-4 mr-2" /> Export All</Button>
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

      {/* Bills Table */}
      <Card>
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
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-8">Loading...</td></tr>
                ) : filteredBills.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-500">No bills found</td></tr>
                ) : (
                  filteredBills.map(bill => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
