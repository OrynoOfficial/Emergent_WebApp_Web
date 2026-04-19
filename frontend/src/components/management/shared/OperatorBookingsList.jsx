import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe2, Store, Filter, RefreshCw, Phone, Mail, User, Banknote,
  CreditCard, Calendar, Receipt, Loader2
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';

const CHANNEL_LABELS = {
  on_site: { label: 'Walk-in', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Store },
  online: { label: 'Online', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe2 },
};

const PAYMENT_LABELS = {
  cash: 'Cash',
  pos: 'POS/Card',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  bank_transfer: 'Bank Transfer',
  stripe: 'Card',
  other: 'Other',
};

/**
 * Unified operator bookings list with channel filter (Online / Walk-in / All).
 *
 * Props:
 *  - serviceType: filter by service (e.g., 'travel')
 *  - refreshKey?: bump this to force refetch
 */
export default function OperatorBookingsList({ serviceType, refreshKey = 0 }) {
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({ total: 0, on_site_count: 0, online_count: 0 });
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/operator/manual-bookings/', {
        params: { service_type: serviceType, channel, limit: 100 },
      });
      setBookings(res.data?.bookings || []);
      setCounts({
        total: res.data?.total || 0,
        on_site_count: res.data?.on_site_count || 0,
        online_count: res.data?.online_count || 0,
      });
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [serviceType, channel]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings, refreshKey]);

  const filtered = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.order_number || '').toLowerCase().includes(q) ||
      (b.guest_customer?.name || '').toLowerCase().includes(q) ||
      (b.guest_customer?.phone || '').toLowerCase().includes(q) ||
      (b.user_email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all" data-testid="bookings-channel-all">
              All <Badge className="ml-2 bg-slate-600 text-white">{counts.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="online" data-testid="bookings-channel-online">
              <Globe2 className="h-3.5 w-3.5 mr-1" /> Online <Badge className="ml-2 bg-blue-500 text-white">{counts.online_count}</Badge>
            </TabsTrigger>
            <TabsTrigger value="on_site" data-testid="bookings-channel-onsite">
              <Store className="h-3.5 w-3.5 mr-1" /> Walk-in <Badge className="ml-2 bg-amber-500 text-white">{counts.on_site_count}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Input
            placeholder="Search ref, customer, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 bg-white"
            data-testid="bookings-search-input"
          />
          <Button variant="outline" size="icon" onClick={fetchBookings} disabled={loading} data-testid="bookings-refresh-btn">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No bookings found</h3>
          <p className="text-sm text-slate-500">
            {channel === 'on_site'
              ? 'Walk-in bookings will appear here once you record them.'
              : 'Bookings will show up here as they come in.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const chKey = b.channel === 'on_site' ? 'on_site' : 'online';
            const ChannelInfo = CHANNEL_LABELS[chKey];
            const ChannelIcon = ChannelInfo.icon;
            const customerName =
              b.guest_customer?.name ||
              b.customer_name ||
              b.user_email ||
              'Customer';
            const seats = b.booking_details?.seat_numbers;
            return (
              <Card key={b.order_number} className="hover:shadow-md transition-shadow" data-testid={`booking-row-${b.order_number}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#082c59] text-white flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-[#082c59]">{b.order_number}</span>
                          <Badge className={`${ChannelInfo.color} border text-xs gap-1`}>
                            <ChannelIcon className="h-3 w-3" /> {ChannelInfo.label}
                          </Badge>
                          {b.is_manual && !b.customer_linked && (
                            <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs">Guest</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900 truncate">{b.service_name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {customerName}</span>
                          {b.guest_customer?.phone && (
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.guest_customer.phone}</span>
                          )}
                          {b.guest_customer?.email && (
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {b.guest_customer.email}</span>
                          )}
                          {b.booking_details?.travel_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {b.booking_details.travel_date}</span>
                          )}
                          {Array.isArray(seats) && seats.length > 0 && (
                            <span className="text-slate-700">Seats: {seats.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:flex-col md:items-end">
                      <div className="text-right">
                        <div className="text-base font-bold text-[#082c59]">{formatFCFA(b.total_amount || 0)}</div>
                        <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                          {b.payment_method === 'cash' ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                          {PAYMENT_LABELS[b.payment_method] || b.payment_method || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {b.notes && (
                    <div className="mt-2 text-xs text-slate-500 italic border-t pt-2">Note: {b.notes}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
