import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Package, MapPin, Search, ArrowRight, Truck, CheckCircle, Clock,
  PackageCheck, AlertCircle, Camera, ShieldCheck,
} from 'lucide-react';

const STATUS_CONFIG = {
  pending:           { label: 'Pending Pickup',     icon: Clock,        color: 'bg-amber-500' },
  received:          { label: 'Package Received',   icon: PackageCheck, color: 'bg-blue-500' },
  in_transit:        { label: 'In Transit',          icon: Truck,        color: 'bg-indigo-500' },
  out_for_delivery:  { label: 'Out for Delivery',    icon: Truck,        color: 'bg-purple-500' },
  delivered:         { label: 'Delivered',           icon: CheckCircle,  color: 'bg-emerald-500' },
  delayed:           { label: 'Delayed',             icon: AlertCircle,  color: 'bg-rose-500' },
};

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const fullUrl = (u) => (u && u.startsWith('/')) ? BACKEND + u : u;

export default function TrackPackage() {
  const { trackingNumber: paramTn } = useParams();
  const navigate = useNavigate();
  const [tn, setTn] = useState(paramTn || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const lookup = useCallback(async (number) => {
    if (!number) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await axios.get(`${BACKEND}/api/packages/track/${encodeURIComponent(number.trim())}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 404
        ? `No package found with tracking number "${number}".`
        : 'Tracking lookup failed. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-lookup when the URL contains a tracking number
  useEffect(() => {
    if (paramTn) {
      setTn(paramTn);
      lookup(paramTn);
    }
  }, [paramTn, lookup]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tn.trim()) return;
    navigate(`/track/${tn.trim().toUpperCase()}`);
  };

  const statusCfg = data ? (STATUS_CONFIG[data.status] || { label: data.status, icon: Package, color: 'bg-slate-500' }) : null;
  const StatusIcon = statusCfg?.icon || Package;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] text-white">
        <div className="px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Track your shipment</h1>
              <p className="text-sm text-white/80">Enter your Oryno tracking number to see live status, photos and timeline.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={tn}
                onChange={(e) => setTn(e.target.value.toUpperCase())}
                placeholder="ORYNO-XXXXXXXX"
                className="pl-9 h-12 bg-white text-slate-900 font-mono uppercase"
                data-testid="track-input"
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-6 bg-white text-[#082c59] hover:bg-slate-100 font-semibold"
              disabled={loading || !tn.trim()}
              data-testid="track-submit-btn"
            >
              {loading ? 'Searching…' : <>Track <ArrowRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </form>
        </div>
      </div>

      {/* Result */}
      <div className="px-6 py-8">
        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Tracking failed</p>
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!error && !data && !loading && !paramTn && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Paste a tracking number above to see your shipment status.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6" data-testid="track-result">
            {/* Status card */}
            <Card className="overflow-hidden">
              <div className={`${statusCfg.color} text-white px-6 py-4 flex items-center gap-3`}>
                <StatusIcon className="h-6 w-6" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-white/70">Current status</p>
                  <p className="text-xl font-bold">{statusCfg.label}</p>
                </div>
                <Badge className="bg-white/20 text-white border-0 font-mono text-xs">{data.tracking_number}</Badge>
              </div>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">From</p>
                    <p className="text-base font-semibold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-slate-400" /> {data.origin || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">To</p>
                    <p className="text-base font-semibold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-slate-400" /> {data.destination || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Estimated delivery</p>
                    <p className="text-sm font-medium text-slate-900">{data.estimated_delivery || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Weight</p>
                    <p className="text-sm font-medium text-slate-900">{data.weight ? `${data.weight} kg` : '—'}</p>
                  </div>
                  {data.current_location && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Current location</p>
                      <p className="text-sm font-medium text-slate-900">{data.current_location}</p>
                    </div>
                  )}
                  {data.vehicle && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Carrier</p>
                      <p className="text-sm font-medium text-slate-900">{data.vehicle}</p>
                    </div>
                  )}
                </div>
                {data.description && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contents</p>
                    <p className="text-sm text-slate-700">{data.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sender's photos */}
            {data.package_photos && data.package_photos.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Package photos (at pickup)</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.package_photos.map((u, i) => (
                      <button key={i} type="button" onClick={() => setLightbox(fullUrl(u))} className="aspect-square overflow-hidden rounded-lg border border-slate-200 hover:opacity-90 transition" data-testid={`pkg-photo-${i}`}>
                        <img src={fullUrl(u)} alt={`Package ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Proof of delivery */}
            {data.delivery_photos && data.delivery_photos.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/40">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-emerald-900">Proof of delivery</h3>
                  </div>
                  <p className="text-xs text-emerald-800/80 mb-3">The operator submitted these photos when handing your package over.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {data.delivery_photos.map((u, i) => (
                      <button key={i} type="button" onClick={() => setLightbox(fullUrl(u))} className="aspect-square overflow-hidden rounded-lg border border-emerald-200 hover:opacity-90 transition" data-testid={`pod-photo-${i}`}>
                        <img src={fullUrl(u)} alt={`Proof ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {data.events && data.events.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 mb-4">Timeline</h3>
                  <div className="relative">
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
                    <div className="space-y-5">
                      {data.events.map((ev, i) => {
                        const cfg = STATUS_CONFIG[ev.status] || { label: ev.title, icon: Package, color: 'bg-slate-400' };
                        const Icon = cfg.icon;
                        return (
                          <div key={i} className="relative flex gap-3" data-testid={`timeline-event-${i}`}>
                            <div className={`relative z-10 h-7 w-7 rounded-full ${cfg.color} flex items-center justify-center shadow-sm`}>
                              <Icon className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex items-baseline justify-between flex-wrap gap-1">
                                <p className="font-semibold text-sm text-slate-900">{ev.title}</p>
                                {ev.timestamp && (
                                  <p className="text-xs text-slate-500">{new Date(ev.timestamp).toLocaleString()}</p>
                                )}
                              </div>
                              {ev.description && <p className="text-sm text-slate-600 mt-0.5">{ev.description}</p>}
                              {ev.location && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" /> {ev.location}
                                </p>
                              )}
                              {ev.photos && ev.photos.length > 0 && (
                                <div className="mt-2 grid grid-cols-3 gap-1.5 max-w-md">
                                  {ev.photos.map((u, j) => (
                                    <button key={j} type="button" onClick={() => setLightbox(fullUrl(u))} className="aspect-square overflow-hidden rounded border border-slate-200">
                                      <img src={fullUrl(u)} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Preview" className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
