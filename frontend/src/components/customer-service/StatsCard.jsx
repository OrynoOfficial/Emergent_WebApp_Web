import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getColorClasses } from './constants';

// Dashboard Stats Card Component
export const StatsCard = ({ title, value, subtitle, icon, trend, color = "blue" }) => {
  return (
    <Card className={`bg-gradient-to-br ${getColorClasses(color)} text-white border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-white/70 text-xs mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-xs">{Math.abs(trend)}% from last week</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-white/20 rounded-xl">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
