import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  QrCode, CheckCircle, XCircle, RefreshCw,
  Ticket, User, Calendar, MapPin, AlertCircle,
  Loader2, Shield, Clock, DollarSign, Users, ArrowRight, Search, Bus, Hotel, Utensils, Package,
  Ban, RotateCcw,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDateShort } from '@/utils/dateUtils';
import api from '@/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const SERVICE_ICONS = {
  travel: Bus, hotel: Hotel, restaurant: Utensils, car_rental: Package,
  event: Calendar, package: Package, cinema: Ticket, laundry: Package, banquet: Package,
};

export default function Scanner() {
  const { user, operatorContext } = useAuth();
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [result]);

  const handleScan = async (code) => {
    if (!code?.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/orders/scan/validate', { code: code.trim() });
      setResult(res.data);
      if (res.data.valid) {
        setScanHistory(prev => [{ code: res.data.code, valid: true, time: new Date(), service: res.data.service_name }, ...prev.slice(0, 19)]);
      }
    } catch (err) {
      setResult({ valid: false, code, message: err.response?.data?.detail || 'Failed to validate ticket' });
    } finally { setLoading(false); }
  };

  const handleCheckIn = async () => {
    if (!result?.code) return;
    setCheckingIn(true);
    try {
      await api.post('/orders/scan/check-in', { code: result.code });
      toast.success('Ticket checked in!');
      setResult(prev => ({ ...prev, checked_in: true, checked_in_at: new Date().toISOString() }));
      setScanHistory(prev => prev.map(h => h.code === result.code ? { ...h, checkedIn: true } : h));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-in failed');
    } finally { setCheckingIn(false); }
  };

  const handleReset = () => { setResult(null); setManualCode(''); setTimeout(() => inputRef.current?.focus(), 100); };

  const statusColor = (s) => {
    if (s === 'confirmed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'pending') return 'bg-amber-100 text-amber-700';
    if (s === 'cancelled' || s === 'not_confirmed') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-[#082c59] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <QrCode className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#082c59]" data-testid="scanner-title">Ticket Scanner</h1>
        <p className="text-slate-500 text-sm">
          {operatorContext ? `Scanning for ${operatorContext.operator_name}` : 'Scan or enter ticket codes to validate'}
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">
          {/* Scan Input */}
          <Card className="border-2 border-dashed border-[#082c59]/20 hover:border-[#082c59]/40 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-[#082c59]" />
                <h3 className="font-semibold text-slate-900">Enter Ticket Code</h3>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="e.g. TRV-20260312-A1B2C3D4"
                  className="font-mono text-lg h-12 tracking-wide"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan(manualCode)}
                  data-testid="scan-input"
                />
                <Button onClick={() => handleScan(manualCode)} disabled={loading || !manualCode.trim()} className="bg-[#082c59] hover:bg-[#0a3a75] h-12 px-6" data-testid="scan-btn">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Enter the order number printed on the ticket</p>
            </CardContent>
          </Card>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Recent Scans
                </h4>
                <div className="space-y-1.5">
                  {scanHistory.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors" onClick={() => handleScan(h.code)}>
                      <div className="flex items-center gap-2">
                        {h.valid ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="font-mono text-sm text-slate-700">{h.code}</span>
                        {h.checkedIn && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Checked In</Badge>}
                      </div>
                      <span className="text-[10px] text-slate-400">{h.time.toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {result.valid ? (
            <>
              {/* Valid Ticket Card */}
              <Card className="overflow-hidden border-0 shadow-xl" data-testid="ticket-result-card">
                <div className={`p-5 text-white ${
                  result.is_refunded ? 'bg-gradient-to-r from-rose-600 to-red-700' :
                  result.is_partially_refunded ? 'bg-gradient-to-r from-orange-500 to-rose-500' :
                  result.open_refund ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
                  result.checked_in ? 'bg-gradient-to-r from-blue-600 to-blue-700' :
                  'bg-gradient-to-r from-emerald-600 to-emerald-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        {result.is_refunded ? <Ban className="w-6 h-6" /> :
                         result.is_partially_refunded ? <RotateCcw className="w-6 h-6" /> :
                         result.open_refund ? <AlertCircle className="w-6 h-6" /> :
                         result.checked_in ? <Shield className="w-6 h-6" /> :
                         <CheckCircle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold" data-testid="ticket-result-title">
                          {result.is_refunded ? 'Ticket Refunded — Do Not Admit' :
                           result.is_partially_refunded ? 'Partially Refunded' :
                           result.open_refund ? 'Refund Pending' :
                           result.checked_in ? 'Already Checked In' :
                           'Valid Ticket'}
                        </h2>
                        <p className="font-mono text-white/80 text-sm">{result.code}</p>
                      </div>
                    </div>
                    <Badge className={`${statusColor(result.status)} border-0 text-sm`}>{result.status}</Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Refund overlay — surfaces fully-refunded, partial, and pending refunds */}
                  {result.is_refunded && (
                    <div
                      className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50 flex items-start gap-3"
                      data-testid="refund-banner-refunded"
                    >
                      <Ban className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-rose-800">Refund issued — admission denied.</p>
                        <p className="text-sm text-rose-700 mt-0.5">
                          {result.refunded_amount > 0
                            ? `${formatFCFA(result.refunded_amount)} returned to the customer.`
                            : 'This order was refunded.'}
                          {' '}If the customer disputes this, escalate to support — do not admit them.
                        </p>
                      </div>
                    </div>
                  )}
                  {result.is_partially_refunded && (
                    <div
                      className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50 flex items-start gap-3"
                      data-testid="refund-banner-partial"
                    >
                      <RotateCcw className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-orange-800">Partial refund issued.</p>
                        <p className="text-sm text-orange-700 mt-0.5">
                          {formatFCFA(result.refunded_amount)} of {formatFCFA(result.total_amount)} returned.
                          You may still admit, but please confirm the remaining balance with the customer.
                        </p>
                      </div>
                    </div>
                  )}
                  {result.open_refund && !result.is_refunded && !result.is_partially_refunded && (
                    <div
                      className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50 flex items-start gap-3"
                      data-testid="refund-banner-pending"
                    >
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-amber-800">
                          Refund request {result.open_refund.status === 'approved' ? 'approved — payout pending' : 'pending review'}
                        </p>
                        <p className="text-sm text-amber-700 mt-0.5">
                          Customer asked for {formatFCFA(result.open_refund.requested_amount || 0)} back
                          {result.open_refund.reason ? ` (${result.open_refund.reason.replace(/_/g, ' ')})` : ''}.
                          {result.open_refund.requires_manual_processing
                            ? ' Manual payout pending — admission OK unless support says otherwise.'
                            : ' Decision pending — please confirm with support before admitting.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Customer */}
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <User className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">{result.customer.name}</p>
                      {result.customer.email && <p className="text-sm text-slate-500">{result.customer.email}</p>}
                      {result.customer.phone && <p className="text-sm text-slate-500">{result.customer.phone}</p>}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    {(() => { const Icon = SERVICE_ICONS[result.service_type] || Ticket; return <Icon className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />; })()}
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{result.service_name}</p>
                      <p className="text-sm text-slate-500">{result.operator_name}</p>
                      {result.service_type && <Badge variant="outline" className="mt-1 text-xs capitalize">{result.service_type}</Badge>}
                    </div>
                  </div>

                  {/* Booking Details */}
                  {(result.booking.departure_city || result.booking.travel_date) && (
                    <div className="grid grid-cols-2 gap-3">
                      {result.booking.departure_city && (
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1"><MapPin className="w-3 h-3" /> Route</div>
                          <p className="font-semibold text-sm text-slate-900">{result.booking.departure_city} <ArrowRight className="inline w-3 h-3" /> {result.booking.destination_city}</p>
                        </div>
                      )}
                      {result.booking.travel_date && (
                        <div className="p-3 bg-amber-50 rounded-xl">
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-1"><Calendar className="w-3 h-3" /> Date</div>
                          <p className="font-semibold text-sm text-slate-900">{result.booking.travel_date}</p>
                          {result.booking.departure_time && <p className="text-xs text-slate-500">Dep: {result.booking.departure_time}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Seats & Passengers */}
                  {(result.booking.seats?.length > 0 || result.booking.passengers?.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {result.booking.seats?.length > 0 && (
                        <div className="p-3 bg-violet-50 rounded-xl">
                          <div className="flex items-center gap-1.5 text-xs text-violet-600 mb-1"><Ticket className="w-3 h-3" /> Seats</div>
                          <div className="flex flex-wrap gap-1">{result.booking.seats.map((s, i) => <Badge key={i} className="bg-violet-100 text-violet-700 text-xs">{s}</Badge>)}</div>
                        </div>
                      )}
                      {result.booking.passengers?.length > 0 && (
                        <div className="p-3 bg-purple-50 rounded-xl">
                          <div className="flex items-center gap-1.5 text-xs text-purple-600 mb-1"><Users className="w-3 h-3" /> Passengers</div>
                          {result.booking.passengers.map((p, i) => <p key={i} className="text-xs text-slate-700">{p.first_name} {p.last_name}</p>)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                    <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /><span className="text-sm text-slate-600">Amount Paid</span></div>
                    <span className="text-xl font-bold text-emerald-700">{formatFCFA(result.total_amount)}</span>
                  </div>

                  {/* Payment Status */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Payment</span>
                    <Badge className={statusColor(result.payment_status)}>{result.payment_status}</Badge>
                  </div>

                  {/* Check-in time if already checked in */}
                  {result.checked_in && result.checked_in_at && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-700 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Checked in at {formatDateShort(result.checked_in_at)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                {result.is_refunded ? (
                  <Button disabled className="flex-1 bg-rose-600 h-12 text-base opacity-75" data-testid="refunded-block-btn">
                    <Ban className="w-5 h-5 mr-2" /> Refunded — Do Not Admit
                  </Button>
                ) : !result.checked_in && result.status === 'confirmed' && (result.payment_status === 'paid' || result.payment_status === 'verified') ? (
                  <Button onClick={handleCheckIn} disabled={checkingIn} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base" data-testid="check-in-btn">
                    {checkingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                    Confirm Check-In
                  </Button>
                ) : result.checked_in ? (
                  <Button disabled className="flex-1 bg-blue-600 h-12 text-base opacity-75">
                    <Shield className="w-5 h-5 mr-2" /> Already Checked In
                  </Button>
                ) : (
                  <Button disabled className="flex-1 h-12 text-base opacity-75" variant="outline">
                    <AlertCircle className="w-5 h-5 mr-2" /> {result.status !== 'confirmed' ? 'Not Confirmed' : 'Payment Pending'}
                  </Button>
                )}
                <Button variant="outline" onClick={handleReset} className="h-12 px-6" data-testid="scan-another-btn">
                  <RefreshCw className="w-4 h-4 mr-2" /> Scan Next
                </Button>
              </div>
            </>
          ) : (
            /* Invalid Ticket */
            <Card className="overflow-hidden border-0 shadow-xl">
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <XCircle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold">Invalid Ticket</h2>
                <p className="font-mono text-white/80 text-sm mt-1">{result.code}</p>
              </div>
              <CardContent className="p-5 text-center">
                <p className="text-slate-600 mb-4">{result.message}</p>
                <Button onClick={handleReset} className="bg-[#082c59] hover:bg-[#0a3a75]">
                  <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
