import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white rounded-lg", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 bg-white",
        month: "space-y-4 bg-white",
        caption: "flex justify-center pt-1 relative items-center bg-white",
        caption_label: "text-sm font-bold text-[#082c59]",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-white p-0 hover:bg-[#082c59]/10 hover:border-[#082c59]/30 transition-all duration-200"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1 bg-white",
        head_row: "flex",
        head_cell:
          "text-[#082c59] font-semibold rounded-md w-9 text-[0.75rem] uppercase",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-[#082c59]/10 [&:has([aria-selected])]:rounded-lg",
          "[&:has([aria-selected].day-outside)]:bg-[#082c59]/5",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-lg [&:has(>.day-range-start)]:rounded-l-lg first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg"
            : "[&:has([aria-selected])]:rounded-lg"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-slate-700 rounded-lg transition-all duration-200",
          "hover:bg-[#082c59]/15 hover:text-[#082c59] hover:scale-110 hover:font-semibold",
          "focus:bg-[#082c59]/15 focus:text-[#082c59]",
          "aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#082c59] text-white font-bold shadow-lg scale-105 hover:bg-[#0a3a75] hover:text-white hover:scale-105 focus:bg-[#082c59] focus:text-white",
        day_today: "bg-amber-100 text-amber-800 font-bold border-2 border-amber-400 hover:bg-amber-200",
        day_outside:
          "day-outside text-slate-300 opacity-50 aria-selected:bg-[#082c59]/30 aria-selected:text-slate-500",
        day_disabled: "text-slate-200 opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100",
        day_range_middle:
          "aria-selected:bg-[#082c59]/15 aria-selected:text-slate-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4 text-[#082c59]", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4 text-[#082c59]", className)} {...props} />
        ),
      }}
      {...props} />
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
