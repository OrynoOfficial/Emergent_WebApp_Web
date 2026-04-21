import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  Clock,
  Package,
  CreditCard,
  Receipt,
  QrCode,
  Download,
  Printer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Bus,
  Hash,
  Armchair,
  Users as UsersIcon,
  RefreshCw,
  Info,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate as fmtDate, formatDateTime as fmtDateTime, getTimezone } from '@/utils/dateUtils';

const getStatusConfig = (status) => {
  const configs = {
    pending: {
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: AlertCircle,
      label: 'Pending'
    },
    confirmed: {
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: CheckCircle,
      label: 'Confirmed'
    },
    completed: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: CheckCircle,
      label: 'Completed'
    },
    delivered: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: Truck,
      label: 'Delivered'
    },
    cancelled: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: XCircle,
      label: 'Cancelled'
    },
    reserved: {
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      icon: Clock,
      label: 'Reserved'
    },
  };
  return configs[status] || configs.pending;
};

const getCategoryIcon = (category) => {
  const icons = {
    hotel: '🏨',
    restaurant: '🍽️',
    travel: '🚌',
    car_rental: '🚗',
    event: '🎫',
    package: '📦',
    cinema: '🎬',
    laundry: '👔',
    banquet: '🎊',
  };
  return icons[category] || '📦';
};

// Uses the user's active timezone (see utils/dateUtils.js).
const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  const out = includeTime ? fmtDateTime(dateString) : fmtDate(dateString);
  return out === '-' ? 'N/A' : out;
};

// QR Code generator URL
const generateQRCodeUrl = (order) => {
  const data = JSON.stringify({
    orderId: order.id,
    orderNumber: order.order_number,
    service: order.service_name || order.service_title
  });
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
};

export default function OrderDetailModal({ order, isOpen, onClose, onCancel, onDownloadReceipt }) {
  if (!order) return null;

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const qrCodeUrl = generateQRCodeUrl(order);

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QRCode-${order.order_number}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('QR Code download failed:', error);
      alert('Failed to download QR code.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{getCategoryIcon(order.service_category || order.service_type)}</span>
            <div>
              <h2 className="text-xl font-bold">Order Details</h2>
              <p className="text-sm text-slate-500 font-normal">#{order.order_number}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`${statusConfig.color} flex items-center gap-1 px-3 py-1`}>
                <StatusIcon className="h-4 w-4" />
                {statusConfig.label}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Booked on</p>
              <p className="text-sm font-medium" data-testid="order-booked-on">{formatDate(order.created_at, true)}</p>
              <p className="text-[10px] text-slate-400">{getTimezone()}</p>
            </div>
          </div>

          {/* Reassignment banner — shows when the resource attached to this booking has been swapped */}
          {Array.isArray(order.reassignment_history) && order.reassignment_history.length > 0 && (() => {
            const latest = order.reassignment_history[order.reassignment_history.length - 1];
            const fromLabel = latest?.from?.plate_number || latest?.from?.vehicle_name || latest?.from?.name || '—';
            const toLabel = latest?.to?.plate_number || latest?.to?.vehicle_name || latest?.to?.name || '—';
            const reasonLabel = latest?.reason_note || (latest?.reason ? latest.reason.charAt(0).toUpperCase() + latest.reason.slice(1) : 'Updated');
            const at = latest?.at ? formatDate(latest.at, true) : '';
            return (
              <div
                data-testid="reassignment-banner"
                className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Your {order.service_type === 'travel' ? 'bus' : 'resource'} was changed
                  </p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    <span className="font-mono text-xs bg-white/60 border border-amber-200 px-1.5 py-0.5 rounded">{fromLabel}</span>
                    <span className="mx-1.5">→</span>
                    <span className="font-mono text-xs bg-white border border-amber-300 px-1.5 py-0.5 rounded font-bold">{toLabel}</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> {reasonLabel}{at ? ` · ${at}` : ''}
                  </p>
                  {order.reassignment_history.length > 1 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {order.reassignment_history.length} changes recorded for this booking.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <Separator />

          {/* Service Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Service Information</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              {/* Show departure and destination for travel */}
              {(order.booking_details?.departure_city && order.booking_details?.destination_city) ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <span className="font-bold text-lg text-slate-900">
                    {order.booking_details.departure_city} → {order.booking_details.destination_city}
                  </span>
                </div>
              ) : (
                <h4 className="font-bold text-lg text-slate-900">{order.service_name || order.service_title || 'Service'}</h4>
              )}
              
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Service Category</p>
                  <p className="text-sm font-medium capitalize">{(order.service_category || order.service_type)?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Operator</p>
                  <p className="text-sm font-medium">{order.operator_name || order.booking_details?.operator_name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Booking Details</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Service Type</p>
                  <p className="text-sm font-medium capitalize">{(order.service_type || order.service_category)?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Service Date</p>
                  <p className="text-sm font-medium" data-testid="service-date">
                    {(() => {
                      const d = order.booking_details?.travel_date
                        || order.booking_details?.service_date
                        || order.booking_details?.check_in
                        || order.service_date;
                      return d ? formatDate(d) : 'N/A';
                    })()}
                  </p>
                </div>
              </div>

              {/* Service Time: prefer operator/customer-selected service_time, else route departure_time */}
              {(order.service_time || order.booking_details?.service_time || order.booking_details?.travel_time || order.booking_details?.departure_time || order.booking_details?.arrival_time) && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  {(order.service_time || order.booking_details?.service_time || order.booking_details?.travel_time || order.booking_details?.departure_time) && (
                    <div>
                      <p className="text-xs text-slate-500">Service Time</p>
                      <p className="text-sm font-medium" data-testid="service-time">
                        {order.service_time || order.booking_details?.service_time || order.booking_details?.travel_time || order.booking_details?.departure_time}
                      </p>
                    </div>
                  )}
                  {order.booking_details?.arrival_time && (
                    <div>
                      <p className="text-xs text-slate-500">Arrival Time</p>
                      <p className="text-sm font-medium">{order.booking_details.arrival_time}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Check-in/Check-out for hotels */}
              {(order.booking_details?.check_in || order.booking_details?.check_out) && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  {order.booking_details?.check_in && (
                    <div>
                      <p className="text-xs text-slate-500">Check-in</p>
                      <p className="text-sm font-medium">{formatDate(order.booking_details.check_in)}</p>
                    </div>
                  )}
                  {order.booking_details?.check_out && (
                    <div>
                      <p className="text-xs text-slate-500">Check-out</p>
                      <p className="text-sm font-medium">{formatDate(order.booking_details.check_out)}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Additional details */}
              {(order.booking_details?.vehicle_type || order.booking_details?.guests || order.booking_details?.selected_seats?.length > 0) && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  {order.booking_details?.vehicle_type && (
                    <div>
                      <p className="text-xs text-slate-500">Vehicle Type</p>
                      <p className="text-sm font-medium">{order.booking_details.vehicle_type}</p>
                    </div>
                  )}
                  {order.booking_details?.guests && (
                    <div>
                      <p className="text-xs text-slate-500">Guests</p>
                      <p className="text-sm font-medium">{order.booking_details.guests}</p>
                    </div>
                  )}
                  {order.booking_details?.selected_seats?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Seats</p>
                      <p className="text-sm font-medium">{order.booking_details.selected_seats.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Info — for travel bookings */}
          {(order.service_type === 'travel' || order.service_category === 'travel') && (
            (() => {
              const v = order.booking_details?.vehicle_info || {};
              const plate = v.plate_number || order.booking_details?.plate_number;
              const vName = v.vehicle_name || v.name || order.booking_details?.vehicle_name;
              const model = [v.manufacturer, v.model].filter(Boolean).join(' ') || order.booking_details?.vehicle_model;
              const images = v.images || order.booking_details?.vehicle_images || [];
              const vType = v.vehicle_type || order.booking_details?.vehicle_type;
              const seats = order.booking_details?.seat_numbers || order.booking_details?.selected_seats || [];
              if (!plate && !vName && !model && images.length === 0 && !vType) return null;
              return (
                <div data-testid="order-vehicle-info">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Bus className="h-4 w-4 text-[#082c59]" /> Your Vehicle
                  </h3>
                  <div className="rounded-xl border-2 border-[#082c59]/10 bg-gradient-to-br from-[#082c59]/5 to-white p-4">
                    <div className="flex gap-4 items-start">
                      {images.length > 0 ? (
                        <img
                          src={images[0]}
                          alt={vName || 'Vehicle'}
                          className="w-28 h-20 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-28 h-20 rounded-lg bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                          <Bus className="h-8 w-8 text-[#082c59]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {vName && <p className="font-bold text-slate-900">{vName}</p>}
                        {model && <p className="text-sm text-slate-600">{model}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {plate && (
                            <Badge className="bg-[#082c59] text-white font-mono text-xs gap-1" data-testid="ticket-plate-number">
                              <Hash className="h-3 w-3" /> {plate}
                            </Badge>
                          )}
                          {vType && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {vType.replace('_', ' ')}
                            </Badge>
                          )}
                          {seats.length > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs gap-1">
                              <Armchair className="h-3 w-3" /> Seat{seats.length > 1 ? 's' : ''} {seats.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 italic">
                      Show this ticket and the plate number to the agent at boarding.
                    </p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Customer Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer Information</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              {/* Get customer name from various sources */}
              {(() => {
                const customerName = order.customer_name || 
                  (order.booking_details?.passengers?.[0] && 
                    `${order.booking_details.passengers[0].first_name || ''} ${order.booking_details.passengers[0].last_name || ''}`.trim()) ||
                  (order.booking_details?.firstName && order.booking_details?.lastName && 
                    `${order.booking_details.firstName} ${order.booking_details.lastName}`) ||
                  null;
                
                const idNumber = order.booking_details?.passengers?.[0]?.id_number || 
                  order.booking_details?.idNumber ||
                  null;
                
                const phone = order.customer_phone || 
                  order.booking_details?.passengers?.[0]?.phone ||
                  order.booking_details?.phone ||
                  null;

                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Customer Name</p>
                      <p className="text-sm font-medium">{customerName || order.user_email || 'N/A'}</p>
                    </div>
                    {idNumber && (
                      <div>
                        <p className="text-xs text-slate-500">ID/Passport Number</p>
                        <p className="text-sm font-medium">{idNumber}</p>
                      </div>
                    )}
                    {phone && (
                      <div>
                        <p className="text-xs text-slate-500">Phone Number</p>
                        <p className="text-sm font-medium">{phone}</p>
                      </div>
                    )}
                    {(order.customer_email || order.user_email) && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="text-sm font-medium">{order.customer_email || order.user_email}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Show all passengers if more than one */}
              {order.booking_details?.passengers?.length > 1 && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">All Passengers ({order.booking_details.passengers.length})</p>
                  <div className="space-y-1">
                    {order.booking_details.passengers.map((p, idx) => (
                      <p key={idx} className="text-sm text-slate-700">
                        {idx + 1}. {p.first_name} {p.last_name} 
                        {p.id_number && <span className="text-slate-500 ml-2">(ID: {p.id_number})</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Notes */}
          {order.customer_notes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Special Requests</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 italic">"{order.customer_notes}"</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment Summary */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment Summary</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatFCFA(order.subtotal || order.amount || 0)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-medium">{formatFCFA(order.tax)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-medium text-green-600">-{formatFCFA(order.discount)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-[#082c59]">
                  {formatFCFA(order.total_amount || order.final_amount || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  Payment: {order.payment_method || 'Not specified'} • {order.payment_status || 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* QR Code Section - Show for confirmed/reserved orders */}
          {['confirmed', 'reserved', 'completed'].includes(order.status) && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Ticket</h3>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <img
                  src={qrCodeUrl}
                  alt="Order QR Code"
                  className="mx-auto rounded-lg shadow-md mb-3"
                />
                <p className="text-xs text-slate-500 mb-3">
                  Present this QR code to the service provider
                </p>
                <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {order.status === 'pending' && onCancel && (
            <Button
              variant="destructive"
              onClick={() => onCancel(order.id || order._id)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {onDownloadReceipt && (
            <Button variant="outline" onClick={() => onDownloadReceipt(order)}>
              <Receipt className="h-4 w-4 mr-2" />
              Receipt
            </Button>
          )}
          <Button onClick={onClose} className="bg-[#082c59]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
