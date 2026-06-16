import React from 'react';

/**
 * Small thumbnail strip of up to 2 vehicle images.
 * Stops click propagation so the parent Card's onClick isn't fired.
 */
export default function VehicleImageThumbnails({ images, vehicleName, onImageClick }) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);
  const displayImages = (images || []).slice(0, 2);

  if (!displayImages.length) return null;

  return (
    <div className="flex gap-1.5 mt-2">
      {displayImages.map((img, idx) => (
        <button
          key={idx}
          onClick={(e) => { e.stopPropagation(); onImageClick(img, vehicleName); }}
          className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 hover:ring-2 hover:ring-blue-400 transition-all shadow-sm"
          data-testid={`bus-thumbnail-${idx}`}
        >
          <img
            src={getImageUrl(img)}
            alt={`${vehicleName} ${idx + 1}`}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
