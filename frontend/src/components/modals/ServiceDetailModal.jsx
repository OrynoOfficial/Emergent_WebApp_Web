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
  MapPin,
  Star,
  Clock,
  Phone,
  Mail,
  Globe,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Calendar,
  Image,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

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

const getStatusBadge = (status) => {
  const configs = {
    active: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    pending: { color: 'bg-amber-100 text-amber-700', icon: Clock },
    inactive: { color: 'bg-slate-100 text-slate-700', icon: XCircle },
    rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
  };
  const config = configs[status] || configs.pending;
  const StatusIcon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <StatusIcon className="h-3 w-3" />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </Badge>
  );
};

export default function ServiceDetailModal({ 
  service, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  onApprove, 
  onReject,
  isAdmin,
  category = 'service'
}) {
  if (!service) return null;

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this service?')) {
      if (onDelete) onDelete(service.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{getCategoryIcon(service.category || category)}</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{service.name || service.title || 'Service'}</h2>
              <p className="text-sm text-slate-500 font-normal capitalize">
                {service.category || category}
              </p>
            </div>
            {getStatusBadge(service.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Image */}
          {service.image_url || service.images?.[0] ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
              <img
                src={service.image_url || service.images[0]}
                alt={service.name || service.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-slate-100 flex items-center justify-center">
              <Image className="h-16 w-16 text-slate-300" />
            </div>
          )}

          {/* Description */}
          {service.description && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</h3>
              <p className="text-slate-700">{service.description}</p>
            </div>
          )}

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            {(service.address || service.city || service.location) && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="font-medium">
                      {service.address && <span className="block">{service.address}</span>}
                      {service.city || service.location}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rating */}
            {service.rating !== undefined && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Star className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Rating</p>
                    <p className="font-medium">
                      {service.rating?.toFixed(1) || 'N/A'} ⭐
                      {service.reviews_count && (
                        <span className="text-slate-500 text-sm ml-1">({service.reviews_count} reviews)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Price */}
            {(service.price || service.price_per_night || service.price_range) && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Price</p>
                    <p className="font-medium">
                      {service.price ? formatFCFA(service.price) : ''}
                      {service.price_per_night ? `${formatFCFA(service.price_per_night)}/night` : ''}
                      {service.price_range && (
                        <Badge variant="outline" className="ml-1">
                          {service.price_range === 'budget' && 'Budget'}
                          {service.price_range === 'moderate' && 'Moderate'}
                          {service.price_range === 'upscale' && 'Upscale'}
                          {service.price_range === 'fine_dining' && 'Fine Dining'}
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Capacity */}
            {(service.capacity || service.total_seats || service.rooms_count) && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Capacity</p>
                    <p className="font-medium">
                      {service.capacity || service.total_seats || service.rooms_count}
                      {service.rooms_count ? ' rooms' : ' seats'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact Info */}
          {(service.phone || service.email || service.website) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  {service.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{service.phone}</span>
                    </div>
                  )}
                  {service.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span>{service.email}</span>
                    </div>
                  )}
                  {service.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-slate-400" />
                      <a href={service.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {service.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Features/Amenities */}
          {(service.features?.length > 0 || service.amenities?.length > 0 || service.cuisine_type?.length > 0) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {service.cuisine_type ? 'Cuisine Types' : 'Features & Amenities'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(service.features || service.amenities || service.cuisine_type || []).map((item, i) => (
                    <Badge key={i} variant="outline" className="capitalize">
                      {item.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Operator Info */}
          {service.operator_name && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Operator</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="font-medium">{service.operator_name}</p>
                  {service.operator_email && (
                    <p className="text-sm text-slate-500">{service.operator_email}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {/* Admin Actions for Pending Services */}
          {isAdmin && service.status === 'pending' && (
            <>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => onReject && onReject(service.id)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => onApprove && onApprove(service.id)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(service)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          
          {onDelete && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
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
