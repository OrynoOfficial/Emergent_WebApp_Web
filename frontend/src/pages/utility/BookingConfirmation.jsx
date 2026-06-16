import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, Download, Share2, Printer, Home,
  Calendar, MapPin, User, CreditCard, Clock,
  Ticket, Hotel, Car, Utensils, QrCode, Bus, Hash, Armchair
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const SERVICE_ICONS = {
  hotels: Hotel,
  travel: Ticket,
  car_rental: Car,
  restaurants: Utensils,
  default: Ticket
};

export default function BookingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    // Get booking from state or search params
    if (location.state?.booking) {
      setBooking(location.state.booking);
    } else {
      // Generate mock booking for demo
      setBooking({
        id: searchParams.get('id') || 'BK-2025-00456',
        status: 'confirmed',
        service_type: searchParams.get('type') || 'travel',
        service_name: 'Express Voyage - Premium',
        description: 'Yaounde to Douala',
        date: '2025-12-25',
        time: '08:00',
        duration: '4 hours',
        customer: {
          name: 'Jean Mbarga',
          email: 'jean@example.com',
          phone: '+237 699 111 222'
        },
        details: {
          seats: '2 passengers',
          class: 'VIP',
          seat_numbers: 'A1, A2'
        },
        payment: {
          method: 'MTN Mobile Money',
          amount: 13000,
          transaction_id: 'TXN-123456789',
          paid_at: '2025-12-22 14:30'
        },
        qr_code: 'TKT-2025-001234'
      });
    }
  }, [location.state, searchParams]);

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59]"></div>
      </div>
    );
  }

  const ServiceIcon = SERVICE_ICONS[booking.service_type] || SERVICE_ICONS.default;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600">Your booking has been successfully completed</p>
        </div>

        {/* Booking Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ServiceIcon className="w-7 h-7 text-[#082c59]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{booking.service_name}</h2>
                  <p className="text-gray-500">{booking.description}</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 capitalize">{booking.status}</Badge>
            </div>

            {/* Booking Reference */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-gray-500 mb-1">Booking Reference</p>
              <p className="text-2xl font-mono font-bold text-[#082c59]">{booking.id}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{booking.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="font-medium">{booking.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Passengers</p>
                  <p className="font-medium">{booking.details.seats}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Seats</p>
                  <p className="font-medium">{booking.details.seat_numbers}</p>
                </div>
              </div>
            </div>

            {/* Vehicle Info — for travel */}
            {booking.service_type === 'travel' && (booking.vehicle || booking.details?.vehicle_info) && (() => {
              const v = booking.vehicle || booking.details?.vehicle_info || {};
              const img = (v.images && v.images[0]) || v.image_url;
              return (
                <div className="mb-6 rounded-xl border-2 border-[#082c59]/10 bg-gradient-to-br from-[#082c59]/5 to-white p-4" data-testid="confirmation-vehicle-info">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Bus className="h-4 w-4 text-[#082c59]" /> Your Vehicle
                  </h3>
                  <div className="flex gap-4 items-start">
                    {img ? (
                      <img src={img} alt={v.vehicle_name || 'Vehicle'} className="w-32 h-24 rounded-lg object-cover border flex-shrink-0" />
                    ) : (
                      <div className="w-32 h-24 rounded-lg bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                        <Bus className="h-10 w-10 text-[#082c59]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      {v.vehicle_name && <p className="font-bold">{v.vehicle_name}</p>}
                      {(v.manufacturer || v.model) && (
                        <p className="text-sm text-slate-600">
                          {[v.manufacturer, v.model].filter(Boolean).join(' ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {v.plate_number && (
                          <Badge className="bg-[#082c59] text-white font-mono text-xs gap-1" data-testid="confirmation-plate-number">
                            <Hash className="h-3 w-3" /> {v.plate_number}
                          </Badge>
                        )}
                        {v.vehicle_type && (
                          <Badge variant="outline" className="text-xs capitalize">{v.vehicle_type.replace('_', ' ')}</Badge>
                        )}
                        {booking.details?.seat_numbers && (
                          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs gap-1">
                            <Armchair className="h-3 w-3" /> Seat{String(booking.details.seat_numbers).includes(',') ? 's' : ''} {booking.details.seat_numbers}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 italic">
                    Show this plate number to the agent at boarding to find your vehicle.
                  </p>
                </div>
              );
            })()}

            {/* QR Code */}
            <div className="flex items-center justify-center gap-6 p-6 bg-white border-2 border-dashed border-gray-200 rounded-lg mb-6">
              <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-20 h-20 text-slate-400" />
              </div>
              <div className="text-left">
                <p className="text-sm text-gray-500 mb-1">Ticket Code</p>
                <p className="text-lg font-mono font-bold">{booking.qr_code}</p>
                <p className="text-sm text-gray-500 mt-2">Show this code at boarding</p>
              </div>
            </div>

            {/* Extra-luggage manifest — printed on the ticket so security and
                boarding staff can verify each bag's contents at a glance. */}
            {Array.isArray(booking.details?.extra_luggage_descriptions) && booking.details.extra_luggage_descriptions.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 mb-6" data-testid="ticket-luggage-manifest">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-200 text-amber-800 text-xs font-bold">
                    {booking.details.extra_luggage_descriptions.length}
                  </span>
                  <h3 className="font-semibold text-amber-900">Extra Luggage Manifest</h3>
                  <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Show at boarding</Badge>
                </div>
                <ol className="space-y-2">
                  {booking.details.extra_luggage_descriptions.map((desc, idx) => (
                    <li key={idx} className="flex gap-3 items-start text-sm" data-testid={`ticket-luggage-bag-${idx}`}>
                      <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-300 text-amber-800 text-[11px] font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="text-slate-700 leading-snug">{desc}</p>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-amber-700/80 italic mt-3">
                  Contents declared by the passenger. Please ensure they match what's actually inside.
                </p>
              </div>
            )}

            {/* Operator brand strip — uses operator.logo_url when available,
                otherwise falls back to a clean monogram avatar. Sits on every
                ticket so customers know who they're travelling with. */}
            {(booking.operator_name || booking.operator_logo_url) && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6" data-testid="ticket-operator-strip">
                {booking.operator_logo_url ? (
                  <img
                    src={booking.operator_logo_url}
                    alt={booking.operator_name || 'Operator'}
                    className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#082c59] to-[#0a3a73] text-white flex items-center justify-center font-bold shrink-0">
                    {(booking.operator_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Operated by</p>
                  <p className="font-semibold text-slate-900 truncate">{booking.operator_name || 'Operator'}</p>
                </div>
              </div>
            )}

            {/* Payment Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Details
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method</span>
                  <span>{booking.payment.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono text-sm">{booking.payment.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid On</span>
                  <span>{booking.payment.paid_at}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total Paid</span>
                  <span className="text-[#082c59]">{formatFCFA(booking.payment.amount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Customer Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span>{booking.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span>{booking.customer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{booking.customer.phone}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button className="flex-1 bg-[#082c59]">
            <Download className="w-4 h-4 mr-2" /> Download Ticket
          </Button>
          <Button variant="outline" className="flex-1">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>

        {/* Info Note */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-1">Important Information</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>A confirmation email has been sent to {booking.customer.email}</li>
            <li>Please arrive at least 30 minutes before departure</li>
            <li>Show the QR code or booking reference at the counter</li>
            <li>Keep this confirmation for your records</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
