import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Search, FileText, BarChart3, TrendingUp, Download, Eye,
  Truck, DollarSign, Users, Target, Shield, MessageSquare, Activity, User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';

const REPORTS_LIST = [
  // Operational Reports
  { id: "daily-weekly-monthly-trip", name: "Daily / Weekly / Monthly Trip Report", description: "Trips completed, total distance, and average trip duration", category: "operational", audience: "operations" },
  { id: "punctuality-report", name: "Punctuality Report", description: "On-time performance, average delays, and main delay causes", category: "operational", audience: "operations" },
  { id: "booking-report", name: "Booking Report", description: "Bookings volume, cancellation rate, and peak days/hours", category: "operational", audience: "operations" },
  { id: "vehicle-occupancy-report", name: "Vehicle Occupancy Report", description: "Average load factor and peak occupancy periods", category: "operational", audience: "operations" },
  { id: "incident-breakdown-accident", name: "Incident / Breakdown / Accident Report", description: "Incident types, locations, and downtime duration", category: "operational", audience: "operations" },
  { id: "operational-efficiency", name: "Operational Efficiency Report", description: "Service performance and operational metrics analysis", category: "operational", audience: "operations" },
  { id: "booking-analytics", name: "Booking Analytics Report", description: "Booking trends, conversion rates, and customer journey analysis", category: "operational", audience: "operations" },
  // Financial Reports
  { id: "revenue-analysis", name: "Revenue Analysis Report", description: "Detailed revenue breakdown by service category and time period", category: "financial", audience: "operations" },
  { id: "revenue-by-route-vehicle-driver", name: "Revenue by Route / Vehicle / Driver", description: "Revenue contribution across key dimensions", category: "financial", audience: "operations" },
  { id: "operating-expenses", name: "Operating Expenses Report", description: "Fuel, maintenance, and route-related expenses", category: "financial", audience: "operations" },
  { id: "cost-per-km", name: "Cost per Kilometer Analysis", description: "Unit cost analysis by route and period", category: "financial", audience: "operations" },
  { id: "budget-vs-actual", name: "Budget vs Actual Performance", description: "Compare budgeted vs actual revenues and expenses", category: "financial", audience: "operations" },
  { id: "financial-summary", name: "Financial Summary Report", description: "Comprehensive financial overview and key performance indicators", category: "financial", audience: "operations" },
  // HR / Driver Reports
  { id: "driver-schedule-hours", name: "Driver Schedule and Working Hours", description: "Driver rosters, workloads, and overtime", category: "hr_driver", audience: "operations" },
  { id: "absenteeism-tardiness", name: "Absenteeism and Tardiness Report", description: "Attendance deviations and trends", category: "hr_driver", audience: "operations" },
  { id: "driver-performance-evaluation", name: "Driver Performance Evaluation", description: "Punctuality, safety incidents, and feedback", category: "hr_driver", audience: "operations" },
  // Customer Reports
  { id: "customer-insights", name: "Customer Insights Report", description: "Customer behavior analysis and booking patterns", category: "customer", audience: "operations" },
  { id: "customer-satisfaction", name: "Customer Satisfaction Report", description: "Positive feedback rate, complaints, and resolution time", category: "customer", audience: "operations" },
  { id: "customer-retention-loyalty", name: "Customer Retention / Loyalty Report", description: "Repeat customers and retention rates", category: "customer", audience: "operations" },
  // Strategic Reports (Administrators)
  { id: "market-trends", name: "Market Trends Analysis", description: "Market analysis and competitive positioning insights", category: "strategic", audience: "administrators" },
  { id: "operator-comparison", name: "Operator Comparison Report", description: "Performance comparison between different operators", category: "strategic", audience: "administrators" },
  { id: "global-activity", name: "Global Activity Report", description: "Total trips, revenue, and performance across all agencies", category: "strategic", audience: "administrators" },
  { id: "agency-performance", name: "Agency Performance Report", description: "Ranking by revenue, efficiency, and punctuality", category: "strategic", audience: "administrators" },
  { id: "profitability-analysis", name: "Profitability Analysis", description: "Gross margin and net profit per route or agency", category: "strategic", audience: "administrators" },
  { id: "forecast-trend", name: "Forecast and Trend Report", description: "Demand evolution, seasonality, and traffic predictions", category: "strategic", audience: "administrators" },
  // Compliance & Safety
  { id: "vehicle-safety-audit", name: "Vehicle Safety Audit Report", description: "Inspections performed, issues found, corrective actions", category: "compliance", audience: "administrators" },
  { id: "licenses-insurance-technical", name: "Licenses, Insurance, and Technical Check Follow-up", description: "Validity tracking and follow-up actions", category: "compliance", audience: "administrators" },
  { id: "environmental-impact", name: "Environmental Impact Report", description: "CO2 emissions, energy consumption, and green initiatives", category: "compliance", audience: "administrators" },
  // Internal Communication
  { id: "announcement-alert-stats", name: "Announcement and Alert Statistics", description: "Volume, types, recipients, and read rates", category: "internal_comm", audience: "administrators" },
  { id: "internal-engagement", name: "Internal Engagement Report", description: "Response rates and participation in campaigns", category: "internal_comm", audience: "administrators" },
  // Advanced Analytics
  { id: "kpi-dashboard", name: "KPI Dashboard", description: "Occupancy rate, cost per km, satisfaction, delays", category: "advanced_analytics", audience: "administrators" },
  { id: "predictive-analysis", name: "Predictive Analysis Report", description: "Demand forecasting and incident prediction", category: "advanced_analytics", audience: "administrators" },
  { id: "service-performance", name: "Service Performance Report", description: "Individual service analysis and performance metrics", category: "operational", audience: "operations" },
];

const CATEGORIES = {
  operational: { label: "Operational", icon: Truck, color: "bg-blue-100 text-blue-700" },
  financial: { label: "Financial", icon: DollarSign, color: "bg-green-100 text-green-700" },
  hr_driver: { label: "HR / Driver", icon: Users, color: "bg-purple-100 text-purple-700" },
  customer: { label: "Customer", icon: User, color: "bg-orange-100 text-orange-700" },
  strategic: { label: "Strategic", icon: Target, color: "bg-indigo-100 text-indigo-700" },
  compliance: { label: "Compliance & Safety", icon: Shield, color: "bg-red-100 text-red-700" },
  internal_comm: { label: "Internal Communication", icon: MessageSquare, color: "bg-cyan-100 text-cyan-700" },
  advanced_analytics: { label: "Advanced Analytics", icon: Activity, color: "bg-pink-100 text-pink-700" }
};

export default function SystemReports() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const filteredReports = useMemo(() => {
    return REPORTS_LIST.filter(report => {
      const matchesSearch = !searchTerm || 
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;
      const matchesAudience = audienceFilter === 'all' || report.audience === audienceFilter;
      if (!isAdmin && report.audience === 'administrators') return false;
      return matchesSearch && matchesCategory && matchesAudience;
    });
  }, [searchTerm, categoryFilter, audienceFilter, isAdmin]);

  const getCategoryInfo = (category) => CATEGORIES[category] || { label: category, color: "bg-gray-100 text-gray-700", icon: FileText };

  const handleViewReport = (reportId, type) => {
    const report = REPORTS_LIST.find(r => r.id === reportId);
    activityLogger.reportView(reportId, report?.name || reportId);
    toast.info(`Opening ${type} view for report: ${reportId}`);
  };

  const handleExportReport = (reportId, format) => {
    const report = REPORTS_LIST.find(r => r.id === reportId);
    activityLogger.reportDownload(reportId, report?.name || reportId, format);
    toast.success(`Exporting report as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 p-6" data-testid="system-reports-page">
      <div>
        <h1 className="text-2xl font-bold text-[#082c59] flex items-center gap-3">
          <BarChart3 className="h-7 w-7" />
          Reports
        </h1>
        <p className="text-slate-600 mt-1">Business intelligence and operational reports</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
                data-testid="reports-search-input"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-white" data-testid="reports-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="bg-white" data-testid="reports-audience-filter">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Audiences</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                {isAdmin && <SelectItem value="administrators">Administrators</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No reports match your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => {
            const categoryInfo = getCategoryInfo(report.category);
            const CategoryIcon = categoryInfo.icon || FileText;
            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow" data-testid={`report-card-${report.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${categoryInfo.color}`}>
                        <CategoryIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-800">{report.name}</h3>
                        <p className="text-slate-600 text-sm mt-1">{report.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className={categoryInfo.color}>
                            {categoryInfo.label}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 capitalize">
                            {report.audience}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleViewReport(report.id, 'visual')}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        size="sm"
                        data-testid={`report-visual-${report.id}`}
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Visual
                      </Button>
                      <Button
                        onClick={() => handleViewReport(report.id, 'data')}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        size="sm"
                        data-testid={`report-data-${report.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Data
                      </Button>
                      <Button
                        onClick={() => handleExportReport(report.id, 'pdf')}
                        variant="outline"
                        size="sm"
                        data-testid={`report-export-${report.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
