import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Utensils, ImageIcon } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const CATEGORY_COLORS = {
  starters: 'bg-blue-100 text-blue-700',
  mains: 'bg-orange-100 text-orange-700',
  desserts: 'bg-pink-100 text-pink-700',
  drinks: 'bg-cyan-100 text-cyan-700',
  specials: 'bg-purple-100 text-purple-700',
  sides: 'bg-green-100 text-green-700'
};

export function MenuItemCard({ 
  item, 
  onEdit, 
  onDelete,
  canEdit = true,
  canDelete = true,
  viewMode = 'grid'
}) {
  const isAvailable = item.is_available !== false && item.available !== false;
  const categoryColor = CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-700';

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
        {/* Image */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
          {item.image ? (
            <img 
              src={item.image} 
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = 'https://placehold.co/100x100/f1f5f9/64748b?text=No+Image'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Utensils className="w-6 h-6 text-slate-300" />
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-900 truncate">{item.name}</h4>
            {item.popular && <Badge className="bg-amber-100 text-amber-700 text-xs">Popular</Badge>}
          </div>
          <p className="text-sm text-slate-500 truncate">{item.description}</p>
        </div>
        
        {/* Category & Price */}
        <div className="flex items-center gap-3">
          <Badge className={categoryColor}>{item.category}</Badge>
          <span className="font-semibold text-slate-900">{formatFCFA(item.price)}</span>
          <Badge className={isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {isAvailable ? 'Available' : 'Unavailable'}
          </Badge>
        </div>
        
        {/* Actions */}
        <div className="flex gap-1">
          {canEdit && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(item)}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => onDelete(item)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative h-32 bg-slate-100">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = 'https://placehold.co/300x200/f1f5f9/64748b?text=No+Image'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-slate-300" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge className={categoryColor}>{item.category}</Badge>
          {item.popular && <Badge className="bg-amber-500 text-white">Popular</Badge>}
        </div>
        <Badge 
          className={`absolute top-2 right-2 ${isAvailable ? 'bg-green-500' : 'bg-red-500'} text-white`}
        >
          {isAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      </div>
      
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-slate-900 line-clamp-1">{item.name}</h4>
          <span className="font-bold text-orange-600 whitespace-nowrap">{formatFCFA(item.price)}</span>
        </div>
        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{item.description}</p>
        
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(item)}>
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(item)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MenuItemCard;
