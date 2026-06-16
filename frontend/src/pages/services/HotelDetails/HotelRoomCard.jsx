import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  CheckCircle, Eye, Coffee, Users, Bed, Maximize,
  X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=2070',
];

/**
 * Compact room card with built-in lightbox gallery.
 * `compact` toggles between a vertically stacked layout (true) and a
 * left-image/right-details layout (false).
 */
export default function HotelRoomCard({ room, nights, checkIn, checkOut, onReserve, compact = false }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const images = room.images && room.images.length > 0 ? room.images : DEFAULT_IMAGES;
  const pricePerNight = room.base_price || room.price || room.price_per_night || 0;
  const totalPrice = pricePerNight * nights;
  const roomName = room.room_name || room.room_type || 'Standard Room';
  const availableRooms = room.available_rooms || room.available || 0;

  const goToPrevious = () => setSelectedImageIndex((p) => (p === 0 ? images.length - 1 : p - 1));
  const goToNext = () => setSelectedImageIndex((p) => (p === images.length - 1 ? 0 : p + 1));

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition-all duration-300 group">
        <div className={compact ? 'flex flex-col' : 'flex flex-col lg:flex-row'}>
          {/* Image Section */}
          <div className={compact ? 'relative h-40' : 'lg:w-1/3 relative'}>
            <div className={compact ? 'relative h-full' : 'relative h-48 lg:h-full min-h-[180px]'}>
              <img
                src={images[0]}
                alt={roomName}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => { setSelectedImageIndex(0); setGalleryOpen(true); }}
              />

              {/* Photo count badge */}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {images.length}
              </div>

              {/* Availability indicator */}
              <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold ${
                availableRooms <= 2
                  ? 'bg-red-500 text-white'
                  : availableRooms <= 5
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-500 text-white'
              }`}>
                {availableRooms <= 2 ? `Only ${availableRooms} left!` : `${availableRooms} avail`}
              </div>
            </div>
          </div>

          {/* Room Details Section */}
          <div className={compact ? 'p-4 flex flex-col' : 'lg:w-2/3 p-4 flex flex-col'}>
            <div className="mb-3">
              <h3 className="text-base font-bold text-slate-900 capitalize">{roomName}</h3>
              {room.description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{room.description}</p>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded text-xs">
                  <Users className="w-3 h-3 text-blue-600" />
                  <span className="text-slate-700">{room.capacity || 2} Guests</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded text-xs">
                  <Bed className="w-3 h-3 text-purple-600" />
                  <span className="text-slate-700">{room.bed_type || 'Queen'}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded text-xs">
                  <Maximize className="w-3 h-3 text-amber-600" />
                  <span className="text-slate-700">{room.size_sqm || 25} m²</span>
                </div>
              </div>
            </div>

            {room.amenities?.length > 0 && (
              <div className="mb-3 pb-2 border-b border-slate-100">
                <div className="flex flex-wrap gap-1.5">
                  {room.amenities.slice(0, 4).map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] text-slate-600">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <span className="capitalize">{amenity.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                  {room.amenities.length > 4 && (
                    <span className="text-[10px] text-slate-400">+{room.amenities.length - 4} more</span>
                  )}
                </div>
              </div>
            )}

            {(room.free_cancellation || room.breakfast_included) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {room.free_cancellation && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Free Cancel
                  </div>
                )}
                {room.breakfast_included && (
                  <div className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                    <Coffee className="w-3 h-3" />
                    Breakfast
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-[#082c59]">{formatFCFA(pricePerNight)}</p>
                  <p className="text-[10px] text-slate-500">per night</p>
                  {nights > 0 && (
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {nights} {nights === 1 ? 'night' : 'nights'}: {formatFCFA(totalPrice)}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => onReserve(room)}
                  size="sm"
                  className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] hover:from-[#0a3a75] hover:to-[#0a5aa5] text-white rounded-lg px-4 h-9 text-xs shadow-md"
                >
                  Reserve Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 bg-black border-none [&>button]:hidden">
          <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex justify-between items-center text-white">
                <div>
                  <h3 className="font-bold text-lg capitalize">{roomName}</h3>
                  <p className="text-xs text-white/70 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {room.capacity || 2}</span>
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {room.bed_type || 'Queen'}</span>
                    <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {room.size_sqm || 25} m²</span>
                  </p>
                </div>
                <button
                  onClick={() => setGalleryOpen(false)}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative px-12">
              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <img
                src={images[selectedImageIndex]}
                alt={`${roomName} - Image ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            <div className="p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
                      index === selectedImageIndex
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-center text-white/70 text-xs mt-1">
                {selectedImageIndex + 1} / {images.length}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
