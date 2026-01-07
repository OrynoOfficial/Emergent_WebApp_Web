import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bus, Edit } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const getStatusBadge = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    inactive: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800'
  };
  return <Badge className={colors[status] || 'bg-gray-100'}>{status}</Badge>;
};

/**
 * ViewDetailsDialog - Dialog component for viewing route/vehicle details
 */
export function ViewDetailsDialog({ open, onOpenChange, item, type, onEdit }) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className={`h-5 w-5 ${type === 'route' ? 'text-blue-600' : 'text-purple-600'}`} />
            {type === 'route' ? 'Route Details' : 'Vehicle Details'}
          </DialogTitle>
        </DialogHeader>
        
        {type === 'route' ? (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-bold text-lg text-blue-900">
                {item.from_city} → {item.to_city}
              </h3>
              <p className="text-sm text-blue-700">Route ID: {item.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">Departure</p><p className="font-medium">{item.departure_time}</p></div>
              <div><p className="text-slate-500">Arrival</p><p className="font-medium">{item.arrival_time}</p></div>
              <div><p className="text-slate-500">Duration</p><p className="font-medium">{item.duration || 'N/A'}</p></div>
              <div><p className="text-slate-500">Price</p><p className="font-bold text-green-600">{formatFCFA(item.price)}</p></div>
              <div><p className="text-slate-500">Vehicle</p><p className="font-medium">{item.vehicle_name || 'Not assigned'}</p></div>
              <div><p className="text-slate-500">Total Seats</p><p className="font-medium">{item.total_seats || 'N/A'}</p></div>
              <div><p className="text-slate-500">Status</p>{getStatusBadge(item.status)}</div>
              <div><p className="text-slate-500">Operator</p><p className="font-medium">{item.operator_name || 'N/A'}</p></div>
            </div>
            {item.amenities?.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1">
                  {item.amenities.map(a => (
                    <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-bold text-lg text-purple-900">{item.vehicle_name}</h3>
              <p className="text-sm text-purple-700">Plate: {item.plate_number}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">Type</p><p className="font-medium capitalize">{item.vehicle_type}</p></div>
              <div><p className="text-slate-500">Total Seats</p><p className="font-medium">{item.total_seats || 'N/A'}</p></div>
              <div><p className="text-slate-500">Manufacturer</p><p className="font-medium">{item.manufacturer || 'N/A'}</p></div>
              <div><p className="text-slate-500">Model</p><p className="font-medium">{item.model || 'N/A'}</p></div>
              <div><p className="text-slate-500">Year</p><p className="font-medium">{item.year || 'N/A'}</p></div>
              <div>
                <p className="text-slate-500">Status</p>
                <Badge className={item.maintenance_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                  {item.maintenance_status}
                </Badge>
              </div>
            </div>
            {item.amenities?.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1">
                  {item.amenities.map(a => (
                    <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}
            {item.notes && (
              <div>
                <p className="text-slate-500 text-sm mb-1">Notes</p>
                <p className="text-sm bg-slate-50 p-3 rounded">{item.notes}</p>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => { onEdit(item); onOpenChange(false); }}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-[#082c59]">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ViewDetailsDialog;
