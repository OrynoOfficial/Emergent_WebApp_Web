import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageSquare, Inbox, Activity, UserPlus, AlertTriangle, CheckCircle,
  Users, Building2, User, PieChart, BarChart2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import { StatsCard } from './StatsCard';
import { CHART_COLORS } from './constants';

export function DashboardTab({ stats, categoryChartData, statusChartData }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatsCard title="Total Tickets" value={stats?.total || 0} subtitle="All time" icon={<MessageSquare className="w-6 h-6" />} color="blue" />
        <StatsCard title="Open" value={stats?.by_status?.open || 0} subtitle="Needs attention" icon={<Inbox className="w-6 h-6" />} color="blue" />
        <StatsCard title="In Progress" value={stats?.by_status?.in_progress || 0} subtitle="Being worked on" icon={<Activity className="w-6 h-6" />} color="purple" />
        <StatsCard title="Unassigned" value={stats?.unassigned || 0} subtitle="Needs assignment" icon={<UserPlus className="w-6 h-6" />} color="amber" />
        <StatsCard title="Urgent" value={stats?.urgent || 0} subtitle="High priority" icon={<AlertTriangle className="w-6 h-6" />} color="red" />
        <StatsCard title="Resolved Today" value={stats?.today || 0} subtitle="This day" icon={<CheckCircle className="w-6 h-6" />} color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-slate-200/50 bg-gradient-to-br from-[#082c59]/[0.03] to-slate-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="w-5 h-5 text-[#082c59]" />Tickets by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200/50 bg-gradient-to-br from-[#082c59]/[0.03] to-slate-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart2 className="w-5 h-5 text-[#082c59]" />Tickets by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#082c59" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload */}
      {stats?.team_workload?.length > 0 && (
        <Card className="shadow-lg border-slate-200/50 bg-gradient-to-br from-[#082c59]/[0.03] to-slate-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-[#082c59]" />Team Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.team_workload.map((member, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg border border-slate-200/40 shadow-sm">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-[#082c59] text-white">
                      {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{member.count} tickets assigned</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-lg bg-gradient-to-br from-blue-50/80 to-[#082c59]/[0.05] border-blue-200/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-[#082c59] rounded-xl">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-[#082c59]/70 text-sm font-medium">Customer Tickets</p>
                <p className="text-3xl font-bold text-[#082c59]">{stats?.by_user_type?.customer || 0}</p>
                <p className="text-slate-500 text-xs mt-1">From end users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-gradient-to-br from-indigo-50/80 to-[#082c59]/[0.05] border-indigo-200/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-indigo-600 rounded-xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-indigo-700/70 text-sm font-medium">Operator Tickets</p>
                <p className="text-3xl font-bold text-indigo-800">{stats?.by_user_type?.operator || 0}</p>
                <p className="text-slate-500 text-xs mt-1">From service operators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
