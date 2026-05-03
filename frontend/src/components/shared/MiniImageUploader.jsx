import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, ImagePlus } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

/**
 * Compact 3-photo (configurable) image uploader.
 * Used by Package service offerings + customer package booking forms.
 */
export default function MiniImageUploader({
  images = [],
  onChange,
  max = 3,
  folder = 'packages',
  label,
  helperText,
  accent = 'red',  // red | navy | emerald
  required = false,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);

  const accentClasses = {
    red: { ring: 'border-red-300 hover:border-red-400 bg-red-50/30', icon: 'text-red-500', dot: 'bg-red-500' },
    navy: { ring: 'border-slate-300 hover:border-slate-400 bg-slate-50/30', icon: 'text-[#082c59]', dot: 'bg-[#082c59]' },
    emerald: { ring: 'border-emerald-300 hover:border-emerald-400 bg-emerald-50/30', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
    blue: { ring: 'border-blue-300 hover:border-blue-400 bg-blue-50/30', icon: 'text-blue-600', dot: 'bg-blue-500' },
    orange: { ring: 'border-orange-300 hover:border-orange-400 bg-orange-50/30', icon: 'text-orange-600', dot: 'bg-orange-500' },
    pink: { ring: 'border-pink-300 hover:border-pink-400 bg-pink-50/30', icon: 'text-pink-600', dot: 'bg-pink-500' },
  }[accent] || {};

  const handleFiles = async (files) => {
    if (!files?.length) return;
    const toUpload = Array.from(files).slice(0, max - images.length);
    if (!toUpload.length) {
      toast.error(`Maximum ${max} images allowed`);
      return;
    }
    setUploading(true);
    const next = [...images];
    for (const file of toUpload) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB`);
        continue;
      }
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', folder);
        const res = await api.post('/uploads/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success && res.data?.file_url) next.push(res.data.file_url);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    onChange(next);
    setUploading(false);
  };

  const removeAt = (idx) => onChange(images.filter((_, i) => i !== idx));

  const slots = Array.from({ length: max }, (_, i) => images[i] || null);

  return (
    <div className="space-y-2" data-testid="mini-image-uploader">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
            <span className="ml-2 text-xs text-slate-400 font-normal">({images.length}/{max})</span>
          </label>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {slots.map((src, idx) =>
          src ? (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm">
              <img src={getImageUrl(src)} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                data-testid={`remove-image-${idx}`}
              >
                <X className="h-3 w-3" />
              </button>
              {idx === 0 && (
                <span className={`absolute bottom-1 left-1 ${accentClasses.dot} text-white text-[10px] px-1.5 py-0.5 rounded`}>
                  Main
                </span>
              )}
            </div>
          ) : (
            <button
              key={idx}
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-square rounded-xl border-2 border-dashed ${accentClasses.ring} flex flex-col items-center justify-center text-xs text-slate-500 transition-all hover:scale-[1.02] disabled:opacity-50`}
              data-testid={`upload-slot-${idx}`}
            >
              {uploading ? (
                <RefreshCw className={`h-5 w-5 ${accentClasses.icon} animate-spin`} />
              ) : (
                <>
                  <ImagePlus className={`h-6 w-6 ${accentClasses.icon} mb-1`} />
                  <span>Photo {idx + 1}</span>
                </>
              )}
            </button>
          )
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {helperText && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}
