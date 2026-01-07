import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Bus, Edit, Building2, ChevronLeft, ChevronRight, Armchair } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const getStatusBadge = (status) => {
  const colors = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    inactive: 'bg-slate-100 text-slate-800 border-slate-200',
    suspended: 'bg-red-100 text-red-800 border-red-200'
  };
  return <Badge className={colors[status] || 'bg-slate-100'}>{status}</Badge>;
};

// Image Carousel Component for Vehicles
const VehicleImageCarousel = ({ images, className = "h-48" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center rounded-lg`}>
        <Bus className="h-16 w-16 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100 rounded-lg`}>
      <img 
        src={getImageUrl(images[currentIndex])} 
        alt={`Vehicle ${currentIndex + 1}`} 
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
      />
      {images.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)} 
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)} 
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentIndex(idx)} 
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'}`} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * ViewDetailsDialog - Dialog component for viewing route/vehicle details
 */
export function ViewDetailsDialog({ open, onOpenChange, item, type, onEdit }) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;
  
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className={`h-5 w-5 ${type === 'route' ? 'text-blue-600' : 'text-purple-600'}`} />
            {type === 'route' ? 'Route Details' : 'Vehicle Details'}
          </DialogTitle>
        </DialogHeader>
        
        {type === 'route' ? (
          <div className="space-y-4 py-4">
            {/* Route header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <h3 className="font-bold text-xl">
                {item.from_city} → {item.to_city}
              </h3>
              <p className="text-blue-100 text-sm mt-1">Route ID: {item.id}</p>
            </div>
            
            {/* Operator - More visible and colored */}
            {item.operator_name && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-600 font-medium">Assigned Operator</p>
                    <p className="font-bold text-indigo-900 text-lg">{item.operator_name}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Departure</p>
                <p className="font-semibold text-lg">{item.departure_time || '--:--'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Arrival</p>
                <p className="font-semibold text-lg">{item.arrival_time || '--:--'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Duration</p>
                <p className="font-semibold">{item.duration || 'N/A'}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <p className="text-slate-500 text-xs">Price</p>
                <p className="font-bold text-emerald-600 text-lg">{formatFCFA(item.price)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Vehicle</p>
                <p className="font-semibold">{item.vehicle_name || 'Not assigned'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Total Seats</p>
                <p className="font-semibold flex items-center gap-1">
                  <Armchair className="w-4 h-4" /> {item.total_seats || 'N/A'}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                </div>
                {getStatusBadge(item.status)}
              </div>
            </div>
            
            {item.amenities?.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1">
                  {item.amenities.map(a => (
                    <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Vehicle Images */}
            <VehicleImageCarousel images={item.images} className="h-48" />
            
            {/* Image Thumbnails */}
            {item.images?.length > 1 && (
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2">
                  {item.images.map((img, idx) => (
                    <img 
                      key={idx}
                      src={getImageUrl(img)}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-14 w-20 object-cover rounded-lg border-2 border-white shadow-sm"
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
            
            {/* Vehicle header */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
              <h3 className="font-bold text-xl">{item.vehicle_name}</h3>
              <p className="text-purple-100">Plate: {item.plate_number}</p>
            </div>
            
            {/* Operator - pulled from route assignment */}
            {item.operator_name && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-600 font-medium">Assigned Operator</p>
                    <p className="font-bold text-indigo-900 text-lg">{item.operator_name}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Type</p>
                <p className="font-semibold capitalize">{item.vehicle_type}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-slate-500 text-xs">Total Seats</p>
                <p className="font-bold text-blue-600 text-lg">{item.total_seats || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Manufacturer</p>
                <p className="font-semibold">{item.manufacturer || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Model</p>
                <p className="font-semibold">{item.model || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Year</p>
                <p className="font-semibold">{item.year || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-xs">Status</p>
                <Badge className={item.maintenance_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                  {item.maintenance_status}
                </Badge>
              </div>
            </div>
            
            {item.amenities?.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1">
                  {item.amenities.map(a => (
                    <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {item.notes && (
              <div>
                <p className="text-slate-500 text-sm mb-1">Notes</p>
                <p className="text-sm bg-slate-50 p-3 rounded">{item.notes}</p>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => { onEdit(item); onOpenChange(false); }}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-blue-600">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ViewDetailsDialog;
