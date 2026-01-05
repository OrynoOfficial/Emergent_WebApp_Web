import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#082c59] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#082c59] text-white shadow-sm hover:bg-[#0a3a75]",
        secondary:
          "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
        destructive:
          "border-transparent bg-red-100 text-red-700 shadow-sm hover:bg-red-200",
        outline: "border-slate-300 text-slate-600 hover:bg-slate-50",
        success: "border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
        warning: "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
