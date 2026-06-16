// Shared swipable image strip used by Location/Showtime cards.
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

export default function SwipableImages({ images = [], height = 'h-40' }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) {
    return (
      <div className={`${height} bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center`}>
        <ImageIcon className="w-10 h-10 text-indigo-300" />
      </div>
    );
  }
  return (
    <div className={`${height} relative bg-slate-100 overflow-hidden`}>
      <img src={images[idx]} alt="" className="w-full h-full object-cover transition-opacity" />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow"
            aria-label="Previous"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow"
            aria-label="Next"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
