import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hotel, MapPin, Star, Bed, Edit, Trash2, ChevronLeft, ChevronRight,
  Wifi, Waves, Dumbbell, Sparkles, Utensils, Coffee, ParkingCircle, Bell, Car, Building2
} from 'lucide-react';
import PermissionGate from '@/components/common/PermissionGate';

// Amenity Icon Mapper
const getAmenityIcon = (amenity) => {
  const icons = {
    wifi: <Wifi className="w-3.5 h-3.5" />,
    pool: <Waves className="w-3.5 h-3.5" />,
    gym: <Dumbbell className="w-3.5 h-3.5" />,
    spa: <Sparkles className="w-3.5 h-3.5" />,
    restaurant: <Utensils className="w-3.5 h-3.5" />,
    bar: <Coffee className="w-3.5 h-3.5" />,
    parking: <ParkingCircle className="w-3.5 h-3.5" />,
    room_service: <Bell className="w-3.5 h-3.5" />,
    airport_shuttle: <Car className="w-3.5 h-3.5" />
  };
  return icons[amenity] || null;
};

// Image Carousel Component
function HotelImageCarousel({ images, className = "h-48" }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center`}>
        <Hotel className="h-16 w-16 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100`}>
      <img 
        src={getImageUrl(images[currentIndex])} 
        alt={`Image ${currentIndex + 1}`} 
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      {images.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} 
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} 
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, idx) => (
              <button 
                key={idx} 
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }} 
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'}`} 
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10">
            {currentIndex + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * HotelCard - Card component for displaying hotel information
 */
export function HotelCard({ hotel, isSelected, onEdit, onDelete, onViewRooms, viewMode = 'grid' }) {
  if (viewMode === 'list') {
    return (
      <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl ${isSelected ? 'ring-2 ring-[#082c59] shadow-xl' : 'shadow-md'}`}>
        <div className="flex">
          <div className="relative w-56 shrink-0">
            <HotelImageCarousel images={hotel.images} className="h-full min-h-[160px]" />
            <div className="absolute top-3 left-3 z-20">
              <Badge className="bg-white/95 text-slate-800 shadow-lg font-semibold gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{hotel.star_rating}
              </Badge>
            </div>
          </div>
          <div className="flex-1 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{hotel.name}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5" /><span>{hotel.city}, {hotel.country}</span>
                </div>
              </div>
              {hotel.operator_name && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 truncate max-w-[150px]">{hotel.operator_name}</span>
                </div>
              )}
            </div>
            {hotel.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {hotel.amenities.slice(0, 8).map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md" title={amenity.replace('_', ' ')}>
                    {getAmenityIcon(amenity)}<span className="text-xs text-slate-600 capitalize">{amenity.replace('_', ' ')}</span>
                  </div>
                ))}
                {hotel.amenities.length > 8 && (
                  <div className="flex items-center bg-[#082c59]/10 px-2 py-1 rounded-md">
                    <span className="text-xs font-medium text-[#082c59]">+{hotel.amenities.length - 8}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" onClick={onViewRooms} className="bg-[#082c59] hover:bg-[#0a3a75]">
                <Bed className="w-4 h-4 mr-1.5" /> View Rooms
              </Button>
              <PermissionGate permission="hotels.edit">
                <Button size="sm" variant="outline" onClick={onEdit} className="px-3">
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
              </PermissionGate>
              <PermissionGate permission="hotels.delete">
                <Button size="sm" variant="outline" onClick={onDelete} className="px-3 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view (default)
  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl relative ${isSelected ? 'ring-2 ring-[#082c59] shadow-xl' : 'shadow-md hover:-translate-y-1'}`}>
      <div className="relative">
        <HotelImageCarousel images={hotel.images} className="h-48" />
        <div className="absolute top-3 left-3 z-20">
          <Badge className="bg-white/95 text-slate-800 shadow-lg font-semibold gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{hotel.star_rating}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{hotel.name}</h3>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
            <MapPin className="w-3.5 h-3.5" /><span>{hotel.city}, {hotel.country}</span>
          </div>
        </div>
        {hotel.operator_name && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 truncate">{hotel.operator_name}</span>
          </div>
        )}
        {hotel.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hotel.amenities.slice(0, 6).map((amenity, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md" title={amenity.replace('_', ' ')}>
                {getAmenityIcon(amenity)}<span className="text-xs text-slate-600 capitalize">{amenity.replace('_', ' ')}</span>
              </div>
            ))}
            {hotel.amenities.length > 6 && (
              <div className="flex items-center bg-[#082c59]/10 px-2 py-1 rounded-md">
                <span className="text-xs font-medium text-[#082c59]">+{hotel.amenities.length - 6}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button size="sm" onClick={onViewRooms} className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]">
            <Bed className="w-4 h-4 mr-1.5" /> View Rooms
          </Button>
          <PermissionGate permission="hotels.edit">
            <Button size="sm" variant="outline" onClick={onEdit} className="px-3">
              <Edit className="w-4 h-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="hotels.delete">
            <Button size="sm" variant="outline" onClick={onDelete} className="px-3 text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
}

export default HotelCard;
