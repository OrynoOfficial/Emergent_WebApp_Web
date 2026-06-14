// Shared 4-tab nav for the Super Admin → Operators section.
//
// Used by:
//   • OperatorsManagement.jsx       (Operators tab)
//   • OperatorCategoriesPage.jsx    (Categories tab)
//   • (future) Geography / Market Segments pages can drop this in too.
//
// Keeps the four tabs in lock-step so when we add a 5th area later we
// only edit one file.
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Globe, TrendingUp, Sparkles } from 'lucide-react';

const TABS = [
  { value: 'operators',       label: 'Operators',       icon: Building,    path: '/admin/operators' },
  { value: 'geography',       label: 'Geography',       icon: Globe,       path: '/admin/operators/geography' },
  { value: 'market-segments', label: 'Market Segments', icon: TrendingUp,  path: '/admin/operators/market-segments' },
  { value: 'categories',      label: 'Categories',      icon: Sparkles,    path: '/admin/operators/categories' },
];

function deriveValueFromPath(pathname) {
  if (pathname.includes('/geography')) return 'geography';
  if (pathname.includes('/market-segments')) return 'market-segments';
  if (pathname.includes('/categories')) return 'categories';
  return 'operators';
}

export default function OperatorSectionTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const value = deriveValueFromPath(location.pathname);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const target = TABS.find(t => t.value === next);
        if (target) navigate(target.path);
      }}
    >
      <TabsList
        className={`grid w-full grid-cols-${TABS.length} mb-6 bg-slate-100`}
        data-testid="operator-management-tabs"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid={`tab-${tab.value}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
