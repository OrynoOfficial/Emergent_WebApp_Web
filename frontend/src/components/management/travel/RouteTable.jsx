import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, CheckCircle, Eye } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import PermissionGate from '@/components/common/PermissionGate';

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
 * RouteTable - Table component for displaying travel routes
 */
export function RouteTable({ 
  routes, 
  loading, 
  isAdmin, 
  onAdd, 
  onView, 
  onEdit, 
  onDelete, 
  onApprove 
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Travel Routes</CardTitle>
        <PermissionGate permission="travel.create">
          <Button onClick={onAdd} className="bg-[#082c59]">
            <Plus className="w-4 h-4 mr-2" /> Add Route
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : routes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No routes found. Create your first route!</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map(route => (
                <TableRow key={route.id}>
                  <TableCell>
                    <div className="font-medium">{route.from_city} → {route.to_city}</div>
                    <div className="text-sm text-gray-500">{route.operator_name}</div>
                  </TableCell>
                  <TableCell>
                    <div>{route.departure_time} - {route.arrival_time}</div>
                    <div className="text-sm text-gray-500">{route.duration}</div>
                  </TableCell>
                  <TableCell>
                    <div>{route.vehicle_name || '-'}</div>
                    <div className="text-sm text-gray-500">{route.total_seats} seats</div>
                  </TableCell>
                  <TableCell>{formatFCFA(route.price)}</TableCell>
                  <TableCell>{getStatusBadge(route.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onView(route)} title="View Details">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isAdmin && route.status === 'pending' && (
                        <PermissionGate permission="travel.approve">
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => onApprove(route.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                      )}
                      <PermissionGate permission="travel.edit">
                        <Button size="sm" variant="outline" onClick={() => onEdit(route)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="travel.delete">
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(route.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default RouteTable;
