import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bus, Edit, Trash2, Eye } from 'lucide-react';
import PermissionGate from '@/components/common/PermissionGate';

/**
 * VehicleCard - Card component for displaying vehicle information
 */
export function VehicleCard({ vehicle, onView, onEdit, onDelete }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">{vehicle.vehicle_name}</h3>
              <p className="text-sm text-gray-500">{vehicle.plate_number}</p>
            </div>
          </div>
          <Badge className={vehicle.maintenance_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
            {vehicle.maintenance_status}
          </Badge>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Type:</span>
            <span className="capitalize">{vehicle.vehicle_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Seats:</span>
            <span>{vehicle.total_seats || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Model:</span>
            <span>{vehicle.manufacturer} {vehicle.model}</span>
          </div>
        </div>
        {vehicle.amenities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {vehicle.amenities.map(a => (
              <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onView(vehicle)} title="View Details">
            <Eye className="w-4 h-4" />
          </Button>
          <PermissionGate permission="travel.edit">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(vehicle)}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          </PermissionGate>
          <PermissionGate permission="travel.delete">
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(vehicle.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
}

export default VehicleCard;
