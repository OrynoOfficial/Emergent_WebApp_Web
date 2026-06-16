import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Star, Bus, Armchair, Shield, AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { isPast } from '@/utils/dateUtils';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import VehicleImageThumbnails from './VehicleImageThumbnails';
import { getAmenityIcon, getDefaultAmenities, getVehicleTypeStyle } from './helpers';

/**
 * Trip card in the "Grid" view (3-up gradient header tiles).
 */
export default function TripCardGrid({ trip, onSelect, tripDate, onImageClick, isFav, toggleFav }) {
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);
  const isTripPast = isPast(tripDate, trip.departure_time);
  const tripId = trip._id || trip.id;

  return (
    <Card
      className={`group overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all duration-300 ${
        isTripPast
          ? 'cursor-not-allowed'
          : 'hover:shadow-2xl transform hover:-translate-y-1'
      }`}
      style={isTripPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      {/* Header with gradient */}
      <div className={`relative h-32 p-4 ${isTripPast ? 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700' : 'bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f]'}`}>
        {isTripPast && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-slate-700 text-white">
              <AlertCircle className="w-3 h-3 mr-1" /> Departed
            </Badge>
          </div>
        )}
        {!isTripPast && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            <SubscribeButton operatorId={trip.operator_id} operatorName={trip.operator_name} variant="icon" />
            <FavouriteButton
              isFavourite={!!isFav(tripId)}
              onToggle={() => toggleFav(trip)}
              testId={`fav-btn-${tripId}`}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
              emptyClass="text-white"
            />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className={`${isTripPast ? 'bg-slate-600' : getVehicleTypeStyle(trip.vehicle_type)} shadow-lg`}>
            <Star className="w-3 h-3 mr-1" />
            {trip.vehicle_type}
          </Badge>
        </div>
        {!isTripPast && (
          <div className="absolute bottom-3 right-3 z-10" data-testid={`travel-fomo-grid-${tripId}`}>
            <AlmostSoldOutBadge count={trip.available_seats} unit="seats" />
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 text-white">
            <Bus className="w-5 h-5" />
            <span className="font-bold text-lg">{trip.operator_name}</span>
          </div>
        </div>
      </div>

      <CardContent className="p-5">
        {/* Route & Time */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <p className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{trip.departure_time}</p>
            <p className="text-sm text-slate-500">{trip.from_city}</p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <div className="text-xs text-slate-400 mb-1">{trip.duration || '~3h 30m'}</div>
            <div className="w-full h-[2px] bg-slate-200 relative">
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isTripPast ? 'bg-slate-400' : 'bg-[#082c59]'}`} />
              <ArrowRight className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`} />
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isTripPast ? 'bg-slate-400' : 'bg-emerald-500'}`} />
            </div>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-emerald-600'}`}>{trip.arrival_time}</p>
            <p className="text-sm text-slate-500">{trip.to_city}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className={`flex items-center justify-between text-sm rounded-xl p-3 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-slate-50'}`}>
          <div className={`flex items-center gap-1.5 ${isTripPast ? 'text-slate-400' : 'text-orange-600'}`}>
            <Armchair className="w-4 h-4" />
            <span className="font-medium">{isTripPast ? 'No longer available' : trip.available_seats === 0 ? 'Sold Out' : `${trip.available_seats ?? trip.total_seats ?? 40} seats`}</span>
          </div>
          {!isTripPast && (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Insured</span>
            </div>
          )}
        </div>

        {/* Vehicle Info, Plate Number & Images */}
        <div className={`rounded-xl p-3 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-blue-50/70 border border-blue-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus className={`w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${isTripPast ? 'text-slate-500' : 'text-blue-800'}`}>{trip.vehicle_name || trip.operator_name}</span>
            </div>
            {trip.plate_number && (
              <Badge variant="outline" className={`text-xs font-bold ${isTripPast ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-[#082c59]/10 text-[#082c59] border-[#082c59]/20'}`} data-testid={`plate-number-${tripId}`}>
                {trip.plate_number}
              </Badge>
            )}
          </div>
          {!isTripPast && trip.vehicle_images?.length > 0 && (
            <VehicleImageThumbnails
              images={trip.vehicle_images}
              vehicleName={trip.vehicle_name || trip.operator_name}
              onImageClick={onImageClick}
            />
          )}
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tripAmenities.slice(0, 3).map((amenity, idx) => {
            const Icon = getAmenityIcon(amenity);
            return (
              <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded-full ${isTripPast ? 'bg-slate-100' : 'bg-slate-100'}`}>
                <Icon className={`h-3 w-3 ${isTripPast ? 'text-slate-400' : 'text-slate-600'}`} />
                <span className={`text-xs ${isTripPast ? 'text-slate-400' : 'text-slate-600'}`}>{amenity}</span>
              </div>
            );
          })}
          {tripAmenities.length > 3 && (
            <div className="px-2 py-1 bg-slate-100 rounded-full">
              <span className="text-xs text-slate-500">+{tripAmenities.length - 3}</span>
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <div className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{formatCurrency(trip.price)}</div>
            <div className="text-xs text-slate-500">per person</div>
          </div>
          {isTripPast ? (
            <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl px-5">
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={() => onSelect({ ...trip, tripDate })}
              className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl px-5"
            >
              Select
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
