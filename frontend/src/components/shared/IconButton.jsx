/**
 * IconButton — icon-only button with a built-in accessible tooltip.
 *
 * Purpose
 *   The platform has too many text labels on small actions like
 *   `Filters`, `Refresh`, `Add`, `Edit`, `Grid`, `List`, `Details`.
 *   They eat horizontal real estate on dense management screens.
 *   This component renders just the icon + a hover/focus Radix tooltip
 *   carrying the original label — keeps a11y intact (screen readers
 *   announce the aria-label) while clawing back ~80% of the space.
 *
 * Usage
 *   <IconButton icon={Plus} label="Add operator" onClick={...} />
 *
 *   variant: "ghost" (default) | "outline" | "solid" | "danger"
 *   size:    "sm" (default 32px) | "md" (40px) | "icon" (matches shadcn)
 *   tone:    optional accent override (slate, brand, danger). When omitted
 *            the variant decides.
 *   active:  highlight as "currently-on" — used for grid/list toggles.
 */
import React, { forwardRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const SIZE_STYLES = {
  sm:   'h-8 w-8',
  md:   'h-10 w-10',
  icon: 'h-9 w-9',
};

const ICON_SIZE = {
  sm:   'w-4 h-4',
  md:   'w-5 h-5',
  icon: 'w-4 h-4',
};

const VARIANT_STYLES = {
  ghost:   'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  outline: 'text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300',
  solid:   'text-white bg-[#082c59] hover:bg-[#0a3a75]',
  danger:  'text-red-600 hover:bg-red-50',
};

const ACTIVE_STYLES = 'bg-[#082c59] text-white hover:bg-[#0a3a75] hover:text-white';

const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    onClick,
    size = 'sm',
    variant = 'ghost',
    active = false,
    disabled = false,
    className,
    'data-testid': testId,
    as: Component = 'button',
    type = 'button',
    side = 'top',
    ...rest
  },
  ref,
) {
  if (!Icon) return null;
  const button = (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId || `icon-${label?.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#082c59]/40 disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
        SIZE_STYLES[size],
        active ? ACTIVE_STYLES : VARIANT_STYLES[variant],
        className,
      )}
      {...rest}
    >
      <Icon className={ICON_SIZE[size]} />
    </Component>
  );

  // If no label provided, render naked (rare — tooltip is the whole point).
  if (!label) return button;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={6} className="text-xs font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default IconButton;
