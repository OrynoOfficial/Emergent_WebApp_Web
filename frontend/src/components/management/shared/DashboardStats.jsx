import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4', '#EAB308', '#EF4444'];

/**
 * StatCard - Individual statistic card with optional trend indicator
 */
export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  colorScheme = 'blue',
  onClick,
  className = ''
}) {
  const colorMap = {
    blue: { bg: 'from-blue-500 to-blue-600', text: 'text-blue-600', bgLight: 'bg-blue-50' },
    green: { bg: 'from-green-500 to-green-600', text: 'text-green-600', bgLight: 'bg-green-50' },
    purple: { bg: 'from-purple-500 to-purple-600', text: 'text-purple-600', bgLight: 'bg-purple-50' },
    amber: { bg: 'from-amber-500 to-amber-600', text: 'text-amber-600', bgLight: 'bg-amber-50' },
    rose: { bg: 'from-rose-500 to-rose-600', text: 'text-rose-600', bgLight: 'bg-rose-50' },
    slate: { bg: 'from-slate-500 to-slate-600', text: 'text-slate-600', bgLight: 'bg-slate-50' }
  };
  const colors = colorMap[colorScheme] || colorMap.blue;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            {trend && trendValue && (
              <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span className="text-xs font-medium">{trendValue}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl ${colors.bgLight}`}>
              <Icon className={`h-6 w-6 ${colors.text}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * StatsGrid - Grid of stat cards
 */
export function StatsGrid({ stats, columns = 4 }) {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  };

  return (
    <div className={`grid gap-4 ${colsClass[columns] || colsClass[4]}`}>
      {stats.map((stat, idx) => (
        <StatCard key={stat.key || idx} {...stat} />
      ))}
    </div>
  );
}

/**
 * MiniBarChart - Small bar chart for dashboard
 */
export function MiniBarChart({ data, dataKey = 'value', nameKey = 'name', height = 200, colors = CHART_COLORS }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          formatter={(value) => [formatFCFA(value), 'Revenue']}
        />
        <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * MiniPieChart - Small pie chart for distribution data
 */
export function MiniPieChart({ data, dataKey = 'value', nameKey = 'name', height = 200, colors = CHART_COLORS }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={70}
          innerRadius={40}
          dataKey={dataKey}
          nameKey={nameKey}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          formatter={(value, name) => [value, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * MiniAreaChart - Small area chart for trends
 */
export function MiniAreaChart({ data, dataKey = 'value', nameKey = 'name', height = 200, color = '#3B82F6' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Area 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color} 
          fill={color} 
          fillOpacity={0.2} 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default { StatCard, StatsGrid, MiniBarChart, MiniPieChart, MiniAreaChart };
