import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Phone, Clock, Eye, Edit, Trash2, Utensils } from 'lucide-react';
import { ImageCarousel } from '../shared/ImageCarousel';
import { ActionMenu } from '../shared/DataTable';
import { formatFCFA } from '@/utils/currency';

const PRICE_RANGE_LABELS = { budget: '$', moderate: '$$', upscale: '$$$', fine_dining: '$$$$' };

export function RestaurantCard({ 
  restaurant, 
  onView, 
  onEdit, 
  onDelete,
  viewMode = 'grid',
  canEdit = true,
  canDelete = true
}) {
  const images = restaurant.images?.filter(img => img) || [];
  const cuisineTypes = restaurant.cuisine_type || [];

  const actions = [
    { key: 'view', label: 'View Details', icon: Eye, onClick: () => onView(restaurant) },
    canEdit && { key: 'edit', label: 'Edit', icon: Edit, onClick: () => onEdit(restaurant) },
    canEdit && canDelete && { divider: true },
    canDelete && { key: 'delete', label: 'Delete', icon: Trash2, onClick: () => onDelete(restaurant), destructive: true }
  ].filter(Boolean);

  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Image */}
            <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
              {images.length > 0 ? (
                <img 
                  src={images[0]} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = 'https://placehold.co/200x200/f1f5f9/64748b?text=No+Image'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Utensils className="w-8 h-8 text-slate-300" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900 truncate">{restaurant.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{restaurant.city}, {restaurant.country}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={restaurant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                    {restaurant.status || 'active'}
                  </Badge>
                  <ActionMenu actions={actions} item={restaurant} />
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-medium">{restaurant.rating || 4.5}</span>
                </div>
                <Badge variant="outline">{PRICE_RANGE_LABELS[restaurant.price_range] || '$$'}</Badge>
                {cuisineTypes.slice(0, 2).map(c => (
                  <Badge key={c} variant="secondary" className="capitalize text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Image Carousel */}
      <div className="relative">
        <ImageCarousel 
          images={images} 
          height={180}
          emptyIcon={Utensils}
          emptyText="No images"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge className={restaurant.status === 'active' ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}>
            {restaurant.status || 'Active'}
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <ActionMenu actions={actions} item={restaurant} />
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-slate-900 line-clamp-1">{restaurant.name}</h3>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="font-medium text-sm">{restaurant.rating || 4.5}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">{restaurant.address || restaurant.city}</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline">{PRICE_RANGE_LABELS[restaurant.price_range] || '$$'}</Badge>
          {cuisineTypes.slice(0, 2).map(c => (
            <Badge key={c} variant="secondary" className="capitalize text-xs">{c}</Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Phone className="w-3.5 h-3.5" />
            <span>{restaurant.phone || 'No phone'}</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onView(restaurant)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RestaurantCard;
