import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
    Download, FileText, Calendar, Eye, Loader2, Search, 
    Filter, ChevronLeft, ChevronRight, Receipt, X, 
    SlidersHorizontal, ArrowUpDown, Tag, User, Hash
} from 'lucide-react';
import { ordersAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';

const ITEMS_PER_PAGE = 10;

// Service type options for filter
const SERVICE_TYPES = [
    { value: 'all', label: 'All Services' },
    { value: 'travel', label: 'Travel' },
    { value: 'hotel', label: 'Hotels' },
    { value: 'car_rental', label: 'Car Rental' },
    { value: 'restaurant', label: 'Restaurants' },
    { value: 'event', label: 'Events' },
    { value: 'package', label: 'Packages' },
];

// Status options for filter
const STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'cancelled', label: 'Cancelled' },
];

// Sort options
const SORT_OPTIONS = [
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'amount_desc', label: 'Amount: High to Low' },
    { value: 'amount_asc', label: 'Amount: Low to High' },
];

export default function Receipts() {
    const { user, isOperatorUser } = useAuth();
    const [bills, setBills] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBill, setSelectedBill] = useState(null);
    const [showInvoice, setShowInvoice] = useState(false);
    
    // Determine view mode based on user role
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isOperator = user?.role === 'operator' || isOperatorUser;
    const isAllReceiptsView = isAdmin; // Admin sees all receipts
    
    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date_desc');
    const [showFilters, setShowFilters] = useState(false);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadData();
    }, [isAllReceiptsView, isOperator]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, serviceFilter, statusFilter, sortBy]);

    const loadData = async () => {
        try {
            let response;
            if (isAllReceiptsView) {
                // Admin: fetch all orders/receipts
                response = await ordersAPI.getAll({ limit: 500 });
            } else if (isOperator) {
                // Operator: fetch orders for their services
                response = await ordersAPI.getOperatorOrders({ limit: 500, operator_id: user?.operator_id });
            } else {
                // Customer: fetch only their orders
                response = await ordersAPI.getMyOrders({ limit: 500 });
            }
            const orders = response.data?.orders || [];
            
            const formattedBills = orders.map(order => ({
                id: order.id || order._id,
                bill_number: order.order_number || `ORD-${(order.id || order._id || '').slice(-6)}`,
                customer_name: order.customer_name || user?.full_name || 'Customer',
                customer_email: order.customer_email || user?.email || '',
                amount: order.total_amount || order.final_amount || 0,
                status: order.payment_status || order.status || 'pending',
                service_type: order.service_type || order.service_category || 'general',
                created_date: order.created_at || order.createdAt || new Date().toISOString(),
                due_date: order.due_date,
                currency: 'FCFA',
                tags: order.tags || [order.service_type || order.service_category].filter(Boolean),
                operator_name: order.operator_name || '',
            }));
            
            setBills(formattedBills);
        } catch (error) {
            console.error("Failed to load bills:", error);
            setBills([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and search logic
    const filteredAndSortedBills = useMemo(() => {
        let result = [...bills];
        
        // Search filter (number, user, tags, service)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(bill => 
                bill.bill_number?.toLowerCase().includes(query) ||
                bill.customer_name?.toLowerCase().includes(query) ||
                bill.customer_email?.toLowerCase().includes(query) ||
                bill.service_type?.toLowerCase().includes(query) ||
                bill.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        // Service type filter
        if (serviceFilter !== 'all') {
            result = result.filter(bill => bill.service_type === serviceFilter);
        }
        
        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(bill => 
                bill.status?.toLowerCase() === statusFilter.toLowerCase()
            );
        }
        
        // Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'date_asc':
                    return new Date(a.created_date) - new Date(b.created_date);
                case 'date_desc':
                    return new Date(b.created_date) - new Date(a.created_date);
                case 'amount_asc':
                    return a.amount - b.amount;
                case 'amount_desc':
                    return b.amount - a.amount;
                default:
                    return 0;
            }
        });
        
        return result;
    }, [bills, searchQuery, serviceFilter, statusFilter, sortBy]);

    // Pagination logic
    const totalPages = Math.ceil(filteredAndSortedBills.length / ITEMS_PER_PAGE);
    const paginatedBills = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedBills.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedBills, currentPage]);

    // Stats
    const stats = useMemo(() => {
        const total = filteredAndSortedBills.reduce((sum, b) => sum + b.amount, 0);
        const paid = filteredAndSortedBills.filter(b => ['paid', 'completed'].includes(b.status?.toLowerCase())).length;
        const pending = filteredAndSortedBills.filter(b => b.status?.toLowerCase() === 'pending').length;
        return { total, paid, pending, count: filteredAndSortedBills.length };
    }, [filteredAndSortedBills]);

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'paid':
            case 'completed':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'unpaid':
            case 'pending':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'overdue':
            case 'cancelled':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getServiceIcon = (service) => {
        const colors = {
            travel: 'bg-blue-500',
            hotel: 'bg-purple-500',
            car_rental: 'bg-orange-500',
            restaurant: 'bg-pink-500',
            event: 'bg-cyan-500',
            package: 'bg-indigo-500',
        };
        return colors[service] || 'bg-slate-500';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    const downloadPDF = (bill) => {
        const logoUrl = 'https://customer-assets.emergentagent.com/job_momobook-app/artifacts/syef01ek_f6726dae0_logo.png';
        const invoiceHTML = `
            <html>
            <head>
                <title>Receipt ${bill.bill_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .invoice-details { margin-bottom: 30px; }
                    .amount { font-size: 24px; font-weight: bold; color: #059669; }
                    .logo-img { width: 120px; height: auto; margin-bottom: 10px; }
                    .slogan { color: #666; font-style: italic; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo-img" />
                    <h1>RECEIPT</h1>
                    <p class="slogan">Convenient, Reliable</p>
                </div>
                <div class="invoice-details">
                    <p><strong>Receipt Number:</strong> ${bill.bill_number}</p>
                    <p><strong>Date:</strong> ${formatDate(bill.created_date)}</p>
                    <p><strong>Customer:</strong> ${bill.customer_name}</p>
                    <p><strong>Status:</strong> ${bill.status.toUpperCase()}</p>
                    ${bill.service_type ? `<p><strong>Service Type:</strong> ${bill.service_type.toUpperCase()}</p>` : ''}
                </div>
                <div class="amount">
                    <p>Total Amount: ${formatCurrency(bill.amount)}</p>
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([invoiceHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-${bill.bill_number}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setServiceFilter('all');
        setStatusFilter('all');
        setSortBy('date_desc');
    };

    const hasActiveFilters = searchQuery || serviceFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'date_desc';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-[#082c59] rounded-lg">
                            <Receipt className="h-6 w-6 text-white" />
                        </div>
                        Receipts
                    </h1>
                    <p className="text-slate-500 mt-1">View and download your payment receipts</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Total Receipts</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.count}</p>
                            </div>
                            <div className="p-3 bg-slate-200 rounded-full">
                                <FileText className="h-5 w-5 text-slate-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-emerald-600 font-medium">Paid</p>
                                <p className="text-2xl font-bold text-emerald-700">{stats.paid}</p>
                            </div>
                            <div className="p-3 bg-emerald-200 rounded-full">
                                <Receipt className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-600 font-medium">Pending</p>
                                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                            </div>
                            <div className="p-3 bg-amber-200 rounded-full">
                                <Calendar className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-[#082c59]/5 to-[#082c59]/10 border-[#082c59]/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[#082c59] font-medium">Total Amount</p>
                                <p className="text-xl font-bold text-[#082c59]">{formatCurrency(stats.total)}</p>
                            </div>
                            <div className="p-3 bg-[#082c59]/20 rounded-full">
                                <Receipt className="h-5 w-5 text-[#082c59]" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filters Section */}
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by receipt number, customer, service, or tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white border-slate-200 focus:border-[#082c59] focus:ring-[#082c59]/20"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Filter Toggle Button (Mobile) */}
                        <Button 
                            variant="outline" 
                            onClick={() => setShowFilters(!showFilters)}
                            className="lg:hidden border-slate-200"
                        >
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Filters
                            {hasActiveFilters && (
                                <span className="ml-2 px-1.5 py-0.5 bg-[#082c59] text-white text-xs rounded-full">!</span>
                            )}
                        </Button>

                        {/* Desktop Filters */}
                        <div className="hidden lg:flex items-center gap-3">
                            <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-slate-200">
                                    <Tag className="h-4 w-4 mr-2 text-slate-400" />
                                    <SelectValue placeholder="Service" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {SERVICE_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] bg-white border-slate-200">
                                    <Filter className="h-4 w-4 mr-2 text-slate-400" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {STATUS_OPTIONS.map(status => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[170px] bg-white border-slate-200">
                                    <ArrowUpDown className="h-4 w-4 mr-2 text-slate-400" />
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {SORT_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {hasActiveFilters && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={clearFilters}
                                    className="text-slate-500 hover:text-slate-700"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Mobile Filters Panel */}
                    {showFilters && (
                        <div className="lg:hidden mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue placeholder="Service Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {SERVICE_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {STATUS_OPTIONS.map(status => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {SORT_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {hasActiveFilters && (
                                <Button 
                                    variant="outline" 
                                    onClick={clearFilters}
                                    className="sm:col-span-3"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Search hints */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-xs text-slate-400">Search by:</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <Hash className="h-3 w-3" /> Number
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <User className="h-3 w-3" /> Customer
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <Tag className="h-3 w-3" /> Tags
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <FileText className="h-3 w-3" /> Service
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Results Count */}
            {!isLoading && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                        Showing {paginatedBills.length} of {filteredAndSortedBills.length} receipts
                        {hasActiveFilters && ` (filtered from ${bills.length} total)`}
                    </span>
                </div>
            )}

            {/* Bills List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mb-4" />
                    <p className="text-slate-500">Loading receipts...</p>
                </div>
            ) : paginatedBills.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <FileText className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No receipts found</h3>
                            <p className="text-slate-500 mb-4">
                                {hasActiveFilters 
                                    ? "No receipts match your current filters."
                                    : "You don't have any receipts yet."}
                            </p>
                            {hasActiveFilters && (
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {paginatedBills.map((bill, index) => (
                        <Card 
                            key={bill.id} 
                            className="group bg-white border border-slate-200 hover:border-[#082c59]/30 hover:shadow-md transition-all duration-200 overflow-hidden"
                        >
                            <CardContent className="p-0">
                                <div className="flex items-stretch">
                                    {/* Color indicator */}
                                    <div className={`w-1.5 ${getServiceIcon(bill.service_type)}`} />
                                    
                                    <div className="flex-1 p-4 sm:p-5">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            {/* Left side - Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className="font-mono text-sm font-bold text-[#082c59]">
                                                        #{bill.bill_number}
                                                    </span>
                                                    <Badge variant="outline" className={`text-xs ${getStatusColor(bill.status)}`}>
                                                        {bill.status}
                                                    </Badge>
                                                    {bill.service_type && bill.service_type !== 'general' && (
                                                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200 capitalize">
                                                            {bill.service_type.replace('_', ' ')}
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1.5">
                                                        <User className="h-3.5 w-3.5" />
                                                        {bill.customer_name}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {formatDate(bill.created_date)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right side - Amount & Actions */}
                                            <div className="flex items-center gap-4 sm:gap-6">
                                                <div className="text-right">
                                                    <p className="text-xl sm:text-2xl font-bold text-[#082c59]">
                                                        {formatCurrency(bill.amount)}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        onClick={() => {
                                                            setSelectedBill(bill);
                                                            setShowInvoice(true);
                                                        }} 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="border-slate-200 hover:border-[#082c59] hover:text-[#082c59]"
                                                    >
                                                        <Eye className="h-4 w-4 sm:mr-1.5" />
                                                        <span className="hidden sm:inline">View</span>
                                                    </Button>
                                                    <Button 
                                                        onClick={() => downloadPDF(bill)} 
                                                        size="sm"
                                                        className="bg-[#082c59] hover:bg-[#0a3a75]"
                                                    >
                                                        <Download className="h-4 w-4 sm:mr-1.5" />
                                                        <span className="hidden sm:inline">Download</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-slate-500">
                                Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="border-slate-200"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                
                                {/* Page numbers */}
                                <div className="hidden sm:flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={currentPage === pageNum 
                                                    ? "bg-[#082c59] hover:bg-[#0a3a75]" 
                                                    : "border-slate-200"
                                                }
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="border-slate-200"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Invoice Preview Dialog - UNCHANGED as requested */}
            <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
                <DialogContent className="max-w-2xl bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-[#082c59]">Receipt Preview</DialogTitle>
                    </DialogHeader>
                    {selectedBill && (
                        <div className="p-6 bg-white rounded-lg">
                            <div className="text-center mb-8">
                                <img 
                                    src="https://customer-assets.emergentagent.com/job_momobook-app/artifacts/syef01ek_f6726dae0_logo.png" 
                                    alt="Logo" 
                                    className="h-16 w-auto mx-auto mb-3"
                                />
                                <h3 className="text-xl font-bold text-slate-700">RECEIPT</h3>
                                <p className="text-slate-500 italic">Convenient, Reliable</p>
                            </div>
                            <div className="space-y-4 mb-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="font-semibold text-slate-600">Receipt Number:</p>
                                        <p className="text-slate-900">{selectedBill.bill_number}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-600">Date:</p>
                                        <p className="text-slate-900">{formatDate(selectedBill.created_date)}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-600">Customer:</p>
                                        <p className="text-slate-900">{selectedBill.customer_name}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-600">Status:</p>
                                        <Badge className={getStatusColor(selectedBill.status)}>
                                            {selectedBill.status}
                                        </Badge>
                                    </div>
                                    {selectedBill.service_type && (
                                        <div>
                                            <p className="font-semibold text-slate-600">Service Type:</p>
                                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                                {selectedBill.service_type}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-center border-t border-slate-200 pt-6">
                                <p className="text-sm text-slate-500 mb-2">Total Amount</p>
                                <p className="text-4xl font-bold text-[#082c59]">
                                    {formatCurrency(selectedBill.amount)}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
