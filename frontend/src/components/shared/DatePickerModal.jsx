import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DatePickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedDate,
  minDate = new Date(), // Default: disable past dates
  maxDate,
  title = "Select Date"
}) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const modalRef = useRef(null);
  
  const today = startOfDay(new Date());
  const minDateNormalized = minDate ? startOfDay(minDate) : null;
  const maxDateNormalized = maxDate ? startOfDay(maxDate) : null;

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleDateClick = (date) => {
    const normalizedDate = startOfDay(date);
    
    // Check if date is disabled
    if (minDateNormalized && isBefore(normalizedDate, minDateNormalized)) return;
    if (maxDateNormalized && isBefore(maxDateNormalized, normalizedDate)) return;
    
    onSelect(date);
    onClose(); // Auto-close on selection
  };

  const renderDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      const currentDay = day;
      const normalizedDay = startOfDay(currentDay);
      const isCurrentMonth = isSameMonth(currentDay, monthStart);
      const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
      const isToday = isSameDay(currentDay, today);
      const isPast = minDateNormalized && isBefore(normalizedDay, minDateNormalized);
      const isFuture = maxDateNormalized && isBefore(maxDateNormalized, normalizedDay);
      const isDisabled = isPast || isFuture;

      days.push(
        <button
          key={day.toISOString()}
          type="button"
          disabled={isDisabled}
          onClick={() => handleDateClick(currentDay)}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200",
            // Base styles
            !isCurrentMonth && "text-slate-300",
            isCurrentMonth && !isDisabled && !isSelected && "text-slate-700",
            // Hover styles (not disabled, not selected)
            !isDisabled && !isSelected && "hover:bg-[#082c59]/15 hover:text-[#082c59] hover:scale-110 hover:font-bold cursor-pointer",
            // Today highlight
            isToday && !isSelected && "bg-amber-100 text-amber-800 font-bold border-2 border-amber-400",
            // Selected state
            isSelected && "bg-[#082c59] text-white font-bold shadow-lg scale-105",
            // Disabled/past dates
            isDisabled && "text-slate-300 bg-slate-50 cursor-not-allowed opacity-50"
          )}
        >
          {format(currentDay, 'd')}
        </button>
      );
      day = addDays(day, 1);
    }

    return days;
  };

  if (!isOpen) return null;

  /* Render the modal in a Portal attached to <body> so it always centres
     to the VIEWPORT — never to a transformed ancestor (Radix Dialog, parents
     with `transform`/`filter` etc. would otherwise hijack the fixed
     positioning and clip the bottom of the calendar off-screen when the
     user opens the picker without scrolling first). */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto my-auto max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-[#082c59] text-white p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#082c59]" />
          </button>
          <h4 className="text-lg font-bold text-[#082c59]">
            {format(currentMonth, 'MMMM yyyy')}
          </h4>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#082c59]" />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 px-4 py-2 bg-slate-50">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="w-10 h-8 flex items-center justify-center text-xs font-semibold text-[#082c59] uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 p-4">
          {renderDays()}
        </div>

        {/* Legend */}
        <div className="px-4 pb-4 flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-400"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#082c59]"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-slate-200"></div>
            <span>Unavailable</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
