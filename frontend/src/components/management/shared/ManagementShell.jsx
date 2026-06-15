// Shared management-page chrome.
//
// Renders a single "navigation card" containing the page title (always
// visible), a Hide/Show toggle, a collapsible chrome strip (subtitle +
// optional ops-scope filter + Refresh button), and the TabsList for the
// page. The tab CONTENT itself lives outside the card via children
// (the parent passes `<TabsContent value="...">` blocks).
//
// Designed to match the iter215/iter216 pattern proven on the Banquet
// Management page. The same shell now drives Cinema / Hotel / Laundry /
// Travel / Car-Rental management pages.
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronUp, ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react';

export default function ManagementShell({
  title,                  // e.g. "Cinema Management Center"
  icon: TitleIcon,        // lucide icon component
  iconColorClass = 'text-[#082c59]',
  titleColorClass = 'text-[#082c59]',
  subtitle,               // optional descriptive line
  scopeFilter,            // optional ReactNode (OperatorScopeFilter etc.)
  onRefresh,              // optional async callback
  refreshing = false,
  tabs = [],              // [{ value, label, icon, testId? }]
  activeTab,              // controlled active tab
  onTabChange,            // controlled setter
  filterActive = false,   // shows the amber "Filtered" pill while collapsed
  activeTabLabelOverrides = {},  // map value→label for the collapsed pill
  testIdPrefix = 'mgmt',
  defaultExpanded = true,
  children,               // <TabsContent ...> blocks
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeLabel = activeTabLabelOverrides[activeTab]
    || (tabs.find(t => t.value === activeTab)?.label)
    || activeTab;

  const cols = `grid w-full grid-cols-${Math.min(tabs.length, 6)} h-9 bg-slate-100/70`;

  return (
    <div className="p-6 space-y-4">
      {/* ── Nav card ─────────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm" data-testid={`${testIdPrefix}-nav-card`}>
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {TitleIcon && <TitleIcon className={`h-5 w-5 ${iconColorClass} flex-shrink-0`} />}
            <h1 className={`text-2xl font-bold ${titleColorClass} truncate`} data-testid={`${testIdPrefix}-title`}>{title}</h1>
            {!expanded && (
              <>
                <span className="ml-2 hidden sm:inline-block text-slate-300">·</span>
                <Badge className="hidden sm:inline-flex bg-[#082c59]/10 text-[#082c59] border-0 capitalize" data-testid={`${testIdPrefix}-active-tab-pill`}>
                  {activeLabel}
                </Badge>
                {filterActive && (
                  <Badge variant="outline" className="hidden md:inline-flex border-amber-300 text-amber-700 bg-amber-50" data-testid={`${testIdPrefix}-filter-active-pill`}>
                    <SlidersHorizontal className="h-3 w-3 mr-1" /> Filtered
                  </Badge>
                )}
              </>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(v => !v)}
            className="text-slate-600 hover:text-[#082c59] hover:bg-slate-100"
            aria-expanded={expanded}
            aria-controls={`${testIdPrefix}-header-panel`}
            data-testid={`${testIdPrefix}-toggle-header`}
          >
            {expanded ? <><ChevronUp className="h-4 w-4 mr-1" /> Hide</> : <><ChevronDown className="h-4 w-4 mr-1" /> Show controls</>}
          </Button>
        </div>

        {expanded && (
          <div id={`${testIdPrefix}-header-panel`} className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-3">
            {(subtitle || scopeFilter || onRefresh) && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                  {scopeFilter}
                  {onRefresh && (
                    <Button onClick={onRefresh} variant="outline" size="sm" disabled={refreshing} data-testid={`${testIdPrefix}-refresh-btn`}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                </div>
              </div>
            )}
            {tabs.length > 0 && (
              <Tabs value={activeTab} onValueChange={onTabChange}>
                <TabsList className={cols}>
                  {tabs.map(t => {
                    const Icon = t.icon;
                    return (
                      <TabsTrigger key={t.value} value={t.value} disabled={!!t.disabled} className="text-xs" data-testid={t.testId}>
                        {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}{t.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            )}
          </div>
        )}
      </Card>

      {/* Tab content — `children` are the <TabsContent .../> blocks. They
          live inside a duplicate <Tabs> wrapper so shadcn picks them up
          without us needing to bring the content INSIDE the nav card. */}
      <Tabs value={activeTab} onValueChange={onTabChange}>
        {children}
      </Tabs>
    </div>
  );
}
