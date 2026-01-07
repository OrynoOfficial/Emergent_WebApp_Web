import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bed, Edit, Trash2, ChevronLeft, ChevronRight, Users, Building2, Maximize2
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import PermissionGate from '@/components/common/PermissionGate';

// Room Image Carousel Component
function RoomImageCarousel({ images, className = "w-48 h-36" }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 rounded-l-lg`}>
        <Bed className="w-12 h-12 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100 flex-shrink-0 rounded-l-lg`}>
      <img src={getImageUrl(images[currentIndex])} alt={`Room ${currentIndex + 1}`} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} 
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow z-10"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} 
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow z-10"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded z-10">
            {currentIndex + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * RoomCard - Card component for displaying room information
 */
export function RoomCard({ room, onEdit, onDelete }) {
  const total = room.total_rooms || 1;
  const avail = room.available_rooms ?? total;
  const isLow = avail <= Math.ceil(total * 0.2) && avail > 0;
  const isOut = avail <= 0;
  const stockPercent = Math.round((avail / total) * 100);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex relative">
        <RoomImageCarousel images={room.images} className="w-64 h-48" />
        
        {/* Availability badge */}
        <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg z-20 ${isOut ? 'bg-red-600 text-white' : isLow ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{avail}</span>
            <span className="opacity-80">/ {total} left</span>
          </div>
        </div>
        
        <div className="flex-1 p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-lg text-slate-800">{room.room_name || 'Room'}</h4>
              <p className="text-sm text-slate-500 capitalize mt-0.5">{room.room_type} • {room.bed_type} bed</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(room.base_price || room.price_per_night)}</p>
              <p className="text-xs text-slate-500">per night</p>
            </div>
          </div>
          
          {/* Room details row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
              <Users className="w-4 h-4 text-slate-500 mb-1" />
              <span className="text-sm font-semibold text-slate-700">{room.capacity}</span>
              <span className="text-[10px] text-slate-500">Guests</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
              <Bed className="w-4 h-4 text-slate-500 mb-1" />
              <span className="text-sm font-semibold text-slate-700 capitalize">{room.bed_type || 'Queen'}</span>
              <span className="text-[10px] text-slate-500">Bed</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
              <Building2 className="w-4 h-4 text-slate-500 mb-1" />
              <span className="text-sm font-semibold text-slate-700">{room.floor || '-'}</span>
              <span className="text-[10px] text-slate-500">Floor</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
              <Maximize2 className="w-4 h-4 text-slate-500 mb-1" />
              <span className="text-sm font-semibold text-slate-700">{room.size_sqm || room.size || '-'}</span>
              <span className="text-[10px] text-slate-500">sqm</span>
            </div>
          </div>

          {/* Availability status with progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <Badge className={`${isOut ? 'bg-red-100 text-red-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} text-xs px-2.5 py-1`}>
              {isOut ? 'Sold Out' : isLow ? `Low Stock (${avail} left)` : `Available (${avail} left)`}
            </Badge>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${stockPercent}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">{stockPercent}%</span>
          </div>

          {/* Room amenities */}
          {room.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {room.amenities.slice(0, 5).map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded text-xs text-blue-700">
                  {amenity.replace('_', ' ')}
                </div>
              ))}
              {room.amenities.length > 5 && (
                <div className="bg-blue-100 px-2 py-0.5 rounded text-xs text-blue-800 font-medium">
                  +{room.amenities.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-col justify-center gap-2 p-4 border-l bg-slate-50/50">
          <PermissionGate permission="hotels.manage_rooms">
            <Button size="sm" variant="outline" onClick={() => onEdit(room)} className="bg-white">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 bg-white hover:bg-red-50" onClick={() => onDelete(room.id || room._id)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </PermissionGate>
        </div>
      </div>
    </Card>
  );
}

export default RoomCard;
