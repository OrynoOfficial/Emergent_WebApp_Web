import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import DatePickerModal from './DatePickerModal';

/**
 * Drop-in replacement for <Input type="date" />.
 * Opens the DatePickerModal on click. Self-contained state.
 */
export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  minDate,
  maxDate,
  title,
  className,
  error,
  required = false,
  disabled = false,
  'data-testid': testId,
}) {
  const [open, setOpen] = useState(false);

  const parsedDate = value ? new Date(value) : null;
  const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

  const handleSelect = (date) => {
    // Emit as ISO date string (YYYY-MM-DD) for form compatibility
    const iso = format(date, 'yyyy-MM-dd');
    // Support both event-like onChange and direct value onChange
    if (typeof onChange === 'function') {
      onChange(iso);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex items-center gap-2 w-full h-12 px-3 rounded-md border border-slate-200 bg-white text-left text-sm",
          "hover:border-[#082c59] focus:border-[#082c59] focus:ring-1 focus:ring-[#082c59] outline-none transition-all",
          isValidDate ? "text-slate-900 font-medium" : "text-slate-400",
          error && "border-red-500",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        data-testid={testId}
      >
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 truncate">
          {isValidDate ? format(parsedDate, 'EEE, MMM d, yyyy') : placeholder}
        </span>
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <DatePickerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
        selectedDate={isValidDate ? parsedDate : undefined}
        minDate={minDate}
        maxDate={maxDate}
        title={title || label || placeholder}
      />
    </>
  );
}
