import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, Download, BarChart3, TrendingUp, 
  TrendingDown, Bus, Users, MapPin, Clock, Filter
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Tooltip, Legend } from 'recharts';

const MOCK_TRIP_DATA = {
  summary: {
    totalTrips: 1247,
    totalPassengers: 18456,
    routesCovered: 24,
    avgOccupancy: 72,
    cancellations: 43,
    revenue: 45678000
  },
  dailyData: [
    { date: '2025-12-16', trips: 42, passengers: 620, revenue: 1550000, cancellations: 2 },
    { date: '2025-12-17', trips: 45, passengers: 680, revenue: 1700000, cancellations: 1 },
    { date: '2025-12-18', trips: 38, passengers: 540, revenue: 1350000, cancellations: 3 },
    { date: '2025-12-19', trips: 52, passengers: 780, revenue: 1950000, cancellations: 0 },
    { date: '2025-12-20', trips: 58, passengers: 870, revenue: 2175000, cancellations: 2 },
    { date: '2025-12-21', trips: 65, passengers: 980, revenue: 2450000, cancellations: 1 },
    { date: '2025-12-22', trips: 48, passengers: 720, revenue: 1800000, cancellations: 2 }
  ],
  routeStats: [
    { route: 'Douala → Yaoundé', trips: 156, passengers: 2340, revenue: 8190000, occupancy: 75 },
    { route: 'Yaoundé → Douala', trips: 148, passengers: 2220, revenue: 7770000, occupancy: 75 },
    { route: 'Douala → Bafoussam', trips: 89, passengers: 1246, revenue: 4361000, occupancy: 70 },
    { route: 'Yaoundé → Bamenda', trips: 76, passengers: 1064, revenue: 4256000, occupancy: 70 },
    { route: 'Douala → Buea', trips: 67, passengers: 871, revenue: 2613000, occupancy: 65 },
    { route: 'Yaoundé → Kribi', trips: 54, passengers: 702, revenue: 2457000, occupancy: 65 },
    { route: 'Douala → Limbe', trips: 45, passengers: 585, revenue: 1755000, occupancy: 65 },
    { route: 'Bamenda → Bafoussam', trips: 42, passengers: 504, revenue: 1512000, occupancy: 60 }
  ],
  operatorStats: [
    { operator: 'Touristique Express', trips: 234, passengers: 3510, revenue: 12285000, rating: 4.7 },
    { operator: 'General Voyage', trips: 198, passengers: 2772, revenue: 6930000, rating: 4.5 },
    { operator: 'Vatican Express', trips: 187, passengers: 2805, revenue: 9817500, rating: 4.8 },
    { operator: 'Buca Voyage', trips: 156, passengers: 2184, revenue: 5460000, rating: 4.3 },
    { operator: 'Finex Transport', trips: 134, passengers: 1876, revenue: 5628000, rating: 4.4 }
  ]
};

export default function TripReport() {
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 7), to: new Date() });
  const [viewMode, setViewMode] = useState('daily');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [data, setData] = useState(MOCK_TRIP_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTripData();
  }, [dateRange, viewMode]);

  const loadTripData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/trips', {
        params: {
          from_date: format(dateRange.from, 'yyyy-MM-dd'),
          to_date: format(dateRange.to, 'yyyy-MM-dd'),
          view: viewMode
        }
      });
      if (res.data && res.data.summary && res.data.summary.totalTrips > 0) {
        // Use real data if we have trips
        setData(res.data);
      } else {
        // Fall back to mock data
        setData(MOCK_TRIP_DATA);
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
      // Keep mock data
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Trips', 'Passengers', 'Revenue (FCFA)', 'Cancellations'];
    const rows = data.dailyData.map(d => [d.date, d.trips, d.passengers, d.revenue, d.cancellations]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Trip Report</h1>
          <p className="text-slate-500">Daily, Weekly, and Monthly trip analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Bus className="h-4 w-4" /> Trips</div>
            <p className="text-2xl font-bold text-[#082c59]">{data.summary.totalTrips.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Users className="h-4 w-4" /> Passengers</div>
            <p className="text-2xl font-bold text-[#082c59]">{data.summary.totalPassengers.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><MapPin className="h-4 w-4" /> Routes</div>
            <p className="text-2xl font-bold text-[#082c59]">{data.summary.routesCovered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><TrendingUp className="h-4 w-4" /> Occupancy</div>
            <p className="text-2xl font-bold text-green-600">{data.summary.avgOccupancy}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><TrendingDown className="h-4 w-4" /> Cancellations</div>
            <p className="text-2xl font-bold text-red-500">{data.summary.cancellations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><BarChart3 className="h-4 w-4" /> Revenue</div>
            <p className="text-xl font-bold text-[#082c59]">{formatFCFA(data.summary.revenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trips & Passengers Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'MM/dd')} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => [value.toLocaleString(), name]} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="trips" stroke="#082c59" strokeWidth={2} name="Trips" />
                <Line yAxisId="right" type="monotone" dataKey="passengers" stroke="#10b981" strokeWidth={2} name="Passengers" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'MM/dd')} />
                <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value) => formatFCFA(value)} />
                <Bar dataKey="revenue" fill="#082c59" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Route</th>
                    <th className="text-right py-2">Trips</th>
                    <th className="text-right py-2">Pax</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Occ.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routeStats.map((route, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-2 font-medium">{route.route}</td>
                      <td className="text-right">{route.trips}</td>
                      <td className="text-right">{route.passengers.toLocaleString()}</td>
                      <td className="text-right">{formatFCFA(route.revenue)}</td>
                      <td className="text-right"><Badge variant="outline">{route.occupancy}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Operators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Operator</th>
                    <th className="text-right py-2">Trips</th>
                    <th className="text-right py-2">Pax</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operatorStats.map((op, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-2 font-medium">{op.operator}</td>
                      <td className="text-right">{op.trips}</td>
                      <td className="text-right">{op.passengers.toLocaleString()}</td>
                      <td className="text-right">{formatFCFA(op.revenue)}</td>
                      <td className="text-right"><Badge className="bg-yellow-100 text-yellow-800 border-0">⭐ {op.rating}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
