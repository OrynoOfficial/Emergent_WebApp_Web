import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  FileText, Download, Calendar as CalendarIcon, Filter,
  BarChart3, PieChart, TrendingUp, DollarSign, Users,
  Clock, CheckCircle, Eye, Printer, Mail, RefreshCw
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import QuickDateRangeFilter from '@/components/common/QuickDateRangeFilter';

const REPORT_TYPES = [
  { id: 'bookings', name: 'Bookings Report', icon: FileText, description: 'All bookings with status and details' },
  { id: 'revenue', name: 'Revenue Report', icon: DollarSign, description: 'Revenue breakdown by service and period' },
  { id: 'operators', name: 'Operators Report', icon: Users, description: 'Operator performance and metrics' },
  { id: 'customers', name: 'Customers Report', icon: Users, description: 'Customer activity and retention' },
  { id: 'commissions', name: 'Commissions Report', icon: TrendingUp, description: 'Commission earnings and payouts' },
  { id: 'cancellations', name: 'Cancellations Report', icon: Clock, description: 'Cancelled bookings analysis' }
];

const SAVED_REPORTS = [
  { id: '1', name: 'Monthly Revenue - December 2025', type: 'revenue', created: '2025-12-20', status: 'ready' },
  { id: '2', name: 'Q4 Bookings Summary', type: 'bookings', created: '2025-12-15', status: 'ready' },
  { id: '3', name: 'Top Operators - 2025', type: 'operators', created: '2025-12-10', status: 'ready' },
  { id: '4', name: 'Customer Analysis - Nov 2025', type: 'customers', created: '2025-11-30', status: 'ready' },
  { id: '5', name: 'Weekly Commission Report', type: 'commissions', created: '2025-12-18', status: 'processing' }
];

const SCHEDULED_REPORTS = [
  { id: '1', name: 'Daily Bookings Summary', frequency: 'Daily', nextRun: '2025-12-23 06:00', recipients: 3 },
  { id: '2', name: 'Weekly Revenue Report', frequency: 'Weekly', nextRun: '2025-12-29 08:00', recipients: 5 },
  { id: '3', name: 'Monthly Operator Performance', frequency: 'Monthly', nextRun: '2026-01-01 09:00', recipients: 2 }
];

export default function Reporting() {
  const [selectedReportType, setSelectedReportType] = useState(null);
  const [dateRange, setDateRange] = useState({ preset: 'last_30_days', from: null, to: null });
  const [operatorFilter, setOperatorFilter] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!selectedReportType) return;
    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setGenerating(false);
    // In production, this would generate the actual report
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and manage business reports</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        {/* Generate Report Tab */}
        <TabsContent value="generate" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Report Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REPORT_TYPES.map(report => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReportType(report.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedReportType === report.id
                        ? 'border-[#082c59] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${selectedReportType === report.id ? 'bg-[#082c59]' : 'bg-gray-100'}`}>
                        <report.icon className={`w-5 h-5 ${selectedReportType === report.id ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <h3 className="font-semibold">{report.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{report.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedReportType && (
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label>Date Range</Label>
                    <div className="mt-2">
                      <QuickDateRangeFilter value={dateRange} onChange={setDateRange} />
                    </div>
                  </div>
                  <div>
                    <Label>Operator</Label>
                    <div className="mt-2">
                      <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
                    </div>
                  </div>
                  <div>
                    <Label>Service Filter</Label>
                    <Select>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="All Services" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="hotels">Hotels</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="car_rental">Car Rental</SelectItem>
                        <SelectItem value="restaurants">Restaurants</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Format</Label>
                    <Select defaultValue="pdf">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel (XLSX)</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Group By</Label>
                    <Select defaultValue="day">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="service">Service Type</SelectItem>
                        <SelectItem value="operator">Operator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button className="bg-[#082c59]" onClick={handleGenerateReport} disabled={generating}>
                    {generating ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                    )}
                  </Button>
                  <Button variant="outline">
                    <Mail className="w-4 h-4 mr-2" /> Schedule Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Saved Reports Tab */}
        <TabsContent value="saved" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Report Name</th>
                      <th className="text-left p-4 font-medium">Type</th>
                      <th className="text-left p-4 font-medium">Created</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAVED_REPORTS.map(report => (
                      <tr key={report.id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{report.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">{report.type}</Badge>
                        </td>
                        <td className="p-4 text-gray-500">{report.created}</td>
                        <td className="p-4">
                          {report.status === 'ready' ? (
                            <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm"><Printer className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Scheduled Reports</CardTitle>
                <Button className="bg-[#082c59]"><CalendarIcon className="w-4 h-4 mr-2" /> New Schedule</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {SCHEDULED_REPORTS.map(schedule => (
                  <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Clock className="w-5 h-5 text-[#082c59]" />
                      </div>
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                        <p className="text-sm text-gray-500">
                          {schedule.frequency} • Next run: {schedule.nextRun}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">
                        <Mail className="w-3 h-3 mr-1" /> {schedule.recipients} recipients
                      </Badge>
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-600">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
