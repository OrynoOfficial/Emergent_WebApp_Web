import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2070',
];

/**
 * 4-column image gallery with a fullscreen lightbox.
 * Same UX as before extraction (no behaviour change).
 */
export default function HotelImageGallery({ images, hotelName }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const galleryImages = images && images.length > 0 ? images : DEFAULT_IMAGES;

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-2 h-64 md:h-96 rounded-xl overflow-hidden">
        {/* Main Image */}
        <div
          className="col-span-2 row-span-2 relative cursor-pointer group"
          onClick={() => setIsModalOpen(true)}
        >
          <img
            src={galleryImages[0]}
            alt={hotelName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </div>

        {/* Thumbnail Grid */}
        {galleryImages.slice(1, 5).map((img, idx) => (
          <div
            key={idx}
            className="relative cursor-pointer group overflow-hidden"
            onClick={() => { setSelectedIndex(idx + 1); setIsModalOpen(true); }}
          >
            <img
              src={img}
              alt={`${hotelName} ${idx + 2}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {idx === 3 && galleryImages.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold">+{galleryImages.length - 5} more</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-none [&>button]:hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-20 text-white bg-black/50 hover:bg-black/70 rounded-full h-10 w-10"
              onClick={() => setIsModalOpen(false)}
              data-testid="gallery-close-btn"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="relative aspect-video">
              <img
                src={galleryImages[selectedIndex]}
                alt={`${hotelName} ${selectedIndex + 1}`}
                className="w-full h-full object-contain"
              />

              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full h-12 w-12"
                onClick={goToPrevious}
                data-testid="gallery-prev-btn"
              >
                <ChevronLeft className="h-7 w-7" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full h-12 w-12"
                onClick={goToNext}
                data-testid="gallery-next-btn"
              >
                <ChevronRight className="h-7 w-7" />
              </Button>
            </div>

            <div className="p-4 text-center text-white">
              {selectedIndex + 1} / {galleryImages.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
