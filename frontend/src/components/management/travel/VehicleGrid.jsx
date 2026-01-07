import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import PermissionGate from '@/components/common/PermissionGate';
import { VehicleCard } from './VehicleCard';

/**
 * VehicleGrid - Grid component for displaying vehicles
 */
export function VehicleGrid({ vehicles, loading, onAdd, onView, onEdit, onDelete }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Vehicles</CardTitle>
        <PermissionGate permission="travel.create">
          <Button onClick={onAdd} className="bg-[#082c59]">
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No vehicles found. Add your first vehicle!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map(vehicle => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VehicleGrid;
