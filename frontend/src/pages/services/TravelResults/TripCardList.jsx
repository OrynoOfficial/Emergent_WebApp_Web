import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Clock, Star, Bus, Armchair, AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { isPast } from '@/utils/dateUtils';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import VehicleImageThumbnails from './VehicleImageThumbnails';
import { getAmenityIcon, getDefaultAmenities, getVehicleTypeStyle } from './helpers';

/**
 * Trip card in the horizontal "List" view.
 */
export default function TripCardList({ trip, onSelect, tripDate, onImageClick }) {
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);
  const isTripPast = isPast(tripDate, trip.departure_time);

  return (
    <Card
      className={`overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all ${
        isTripPast ? 'cursor-not-allowed' : 'hover:shadow-xl'
      }`}
      style={isTripPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Left Section - Operator Info */}
        <div className={`lg:w-1/4 p-6 text-white flex flex-col justify-center ${isTripPast ? 'bg-gradient-to-br from-slate-500 to-slate-600' : 'bg-gradient-to-br from-[#082c59] to-[#0a3a75]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Bus className="w-6 h-6" />
            <span className="font-bold text-lg">{trip.operator_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`w-fit ${isTripPast ? 'bg-slate-600' : getVehicleTypeStyle(trip.vehicle_type)}`}>
              <Star className="w-3 h-3 mr-1" />
              {trip.vehicle_type}
            </Badge>
            {isTripPast && (
              <Badge className="bg-slate-700">
                <AlertCircle className="w-3 h-3 mr-1" /> Departed
              </Badge>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <Armchair className="w-4 h-4" />
              {isTripPast ? 'N/A' : trip.available_seats === 0 ? 'Sold Out' : `${trip.available_seats ?? trip.total_seats ?? 40} seats`}
            </span>
          </div>
          {!isTripPast && (
            <div className="mt-2" data-testid={`travel-fomo-list-${trip.id || trip._id}`}>
              <AlmostSoldOutBadge count={trip.available_seats} unit="seats" />
            </div>
          )}
        </div>

        {/* Middle Section - Route Details */}
        <div className="lg:w-1/2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-3xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{trip.departure_time}</p>
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {trip.from_city}
              </p>
            </div>
            <div className="flex-1 px-6 flex flex-col items-center">
              <div className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {trip.duration || '~3h 30m'}
              </div>
              <div className="w-full h-1 rounded-full relative bg-slate-200">
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${isTripPast ? 'bg-slate-400' : 'bg-[#082c59]'}`} />
                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${isTripPast ? 'bg-slate-400' : 'bg-emerald-500'}`} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Direct</p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${isTripPast ? 'text-slate-400' : 'text-emerald-600'}`}>{trip.arrival_time}</p>
              <p className="text-slate-600 flex items-center gap-1 justify-end">
                <MapPin className="w-4 h-4" />
                {trip.to_city}
              </p>
            </div>
          </div>

          {/* Vehicle Info, Plate Number & Images */}
          <div className={`rounded-xl p-3 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-blue-50/70 border border-blue-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bus className={`w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-blue-600'}`} />
                <span className={`text-sm font-semibold ${isTripPast ? 'text-slate-500' : 'text-blue-800'}`}>{trip.vehicle_name || trip.operator_name}</span>
              </div>
              {trip.plate_number && (
                <Badge variant="outline" className={`text-xs font-bold ${isTripPast ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-[#082c59]/10 text-[#082c59] border-[#082c59]/20'}`}>
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
          <div className="flex flex-wrap gap-2">
            {tripAmenities.map((amenity, idx) => {
              const Icon = getAmenityIcon(amenity);
              return (
                <Badge key={idx} variant="outline" className={`${isTripPast ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-50 border-slate-200'}`}>
                  <Icon className={`w-3 h-3 mr-1 ${isTripPast ? 'text-slate-400' : ''}`} />
                  {amenity}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Right Section - Price & CTA */}
        <div className={`lg:w-1/4 p-6 flex flex-col justify-center items-center border-l ${isTripPast ? 'bg-slate-100' : 'bg-slate-50'}`}>
          <div className="text-sm text-slate-500 mb-1">From</div>
          <div className={`text-3xl font-bold mb-1 ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{formatCurrency(trip.price)}</div>
          <div className="text-sm text-slate-500 mb-4">per person</div>
          {isTripPast ? (
            <Button disabled className="w-full bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl">
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={() => onSelect({ ...trip, tripDate })}
              className="w-full bg-[#082c59] hover:bg-[#0a3a75] rounded-xl"
            >
              Select Trip
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
