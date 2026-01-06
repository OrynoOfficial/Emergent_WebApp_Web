import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Save, X, AlertTriangle, Trash2 } from 'lucide-react';

/**
 * FormDialog - Reusable form dialog wrapper
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  onSubmit,
  submitLabel = 'Save',
  submitIcon: SubmitIcon = Save,
  cancelLabel = 'Cancel',
  isSubmitting = false,
  maxWidth = 'max-w-lg',
  destructive = false,
  submitDisabled = false
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`bg-white ${maxWidth}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className={`h-5 w-5 ${destructive ? 'text-red-600' : 'text-blue-600'}`} />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="py-4 space-y-4">
            {children}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={isSubmitting || submitDisabled}
            className={destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : SubmitIcon ? (
              <SubmitIcon className="h-4 w-4 mr-2" />
            ) : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ConfirmDialog - Confirmation dialog for destructive actions
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  warningMessage,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  destructive = true
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${destructive ? 'text-red-600' : ''}`}>
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        {warningMessage && (
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">{warningMessage}</p>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isSubmitting}
            className={destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            <Trash2 className="h-4 w-4 mr-2" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * FormField - Reusable form field with label
 */
export function FormField({
  label,
  required = false,
  error,
  children,
  hint,
  className = ''
}) {
  return (
    <div className={className}>
      {label && (
        <Label className="mb-1.5 block">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/**
 * FormInput - Input with label
 */
export function FormInput({
  label,
  required,
  error,
  hint,
  className,
  ...inputProps
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <Input {...inputProps} className={`mt-1 ${error ? 'border-red-300' : ''}`} />
    </FormField>
  );
}

/**
 * FormTextarea - Textarea with label
 */
export function FormTextarea({
  label,
  required,
  error,
  hint,
  className,
  ...textareaProps
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <Textarea {...textareaProps} className={`mt-1 ${error ? 'border-red-300' : ''}`} />
    </FormField>
  );
}

/**
 * FormSelect - Select with label
 */
export function FormSelect({
  label,
  required,
  error,
  hint,
  options = [],
  placeholder = 'Select...',
  value,
  onValueChange,
  className
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={`mt-1 ${error ? 'border-red-300' : ''}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/**
 * FormCheckboxGroup - Checkbox group for multi-select
 */
export function FormCheckboxGroup({
  label,
  required,
  error,
  hint,
  options = [],
  values = [],
  onChange,
  columns = 2,
  className
}) {
  const toggleValue = (value) => {
    const newValues = values.includes(value)
      ? values.filter(v => v !== value)
      : [...values, value];
    onChange(newValues);
  };

  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };

  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <div className={`grid ${colsClass[columns] || colsClass[2]} gap-2 mt-2`}>
        {options.map(opt => (
          <label 
            key={opt.value} 
            className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Checkbox
              checked={values.includes(opt.value)}
              onCheckedChange={() => toggleValue(opt.value)}
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </FormField>
  );
}

export default { FormDialog, ConfirmDialog, FormField, FormInput, FormTextarea, FormSelect, FormCheckboxGroup };
