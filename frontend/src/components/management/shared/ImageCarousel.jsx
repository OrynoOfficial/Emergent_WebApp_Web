import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * ImageCarousel - Horizontal scrollable image carousel with preview
 */
export function ImageCarousel({
  images = [],
  height = 200,
  showNavigation = true,
  showCounter = true,
  onImageClick,
  emptyIcon: EmptyIcon = ImageIcon,
  emptyText = 'No images',
  className = ''
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const validImages = images.filter(img => img && img.trim());

  if (validImages.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-100 rounded-xl ${className}`}
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <EmptyIcon className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">{emptyText}</p>
        </div>
      </div>
    );
  }

  const goToPrev = () => {
    setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(validImages[currentIndex], currentIndex);
    } else {
      setShowFullscreen(true);
    }
  };

  return (
    <>
      <div className={`relative rounded-xl overflow-hidden group ${className}`} style={{ height }}>
        {/* Main Image */}
        <img
          src={validImages[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
          onClick={handleImageClick}
          onError={(e) => {
            e.target.src = 'https://placehold.co/400x300/f1f5f9/64748b?text=No+Image';
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Navigation Arrows */}
        {showNavigation && validImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Counter Badge */}
        {showCounter && validImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {currentIndex + 1} / {validImages.length}
          </div>
        )}

        {/* Fullscreen Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); setShowFullscreen(true); }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        {/* Dots Indicator */}
        {validImages.length > 1 && validImages.length <= 6 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {validImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-0">
          <div className="relative">
            <img
              src={validImages[currentIndex]}
              alt={`Image ${currentIndex + 1}`}
              className="w-full max-h-[80vh] object-contain"
            />
            {validImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/20 hover:bg-white/30 text-white"
                  onClick={goToPrev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/20 hover:bg-white/30 text-white"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  {currentIndex + 1} / {validImages.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * ImageThumbnails - Thumbnail strip for image selection
 */
export function ImageThumbnails({
  images = [],
  selectedIndex = 0,
  onSelect,
  size = 60,
  className = ''
}) {
  const validImages = images.filter(img => img && img.trim());

  if (validImages.length <= 1) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 ${className}`}>
      {validImages.map((img, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(idx)}
          className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
            idx === selectedIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-slate-300'
          }`}
          style={{ width: size, height: size }}
        >
          <img
            src={img}
            alt={`Thumbnail ${idx + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://placehold.co/100x100/f1f5f9/64748b?text=?';
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default { ImageCarousel, ImageThumbnails };
