import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, ChevronLeft, X } from 'lucide-react';

/**
 * SetupWizard — shared multi-step modal used for Operator / User onboarding.
 *
 * Props:
 *   open               — controlled open state
 *   onOpenChange       — set the open state
 *   title              — wizard title (top of left rail)
 *   subtitle           — short blurb under the title
 *   steps              — array of { id, title, description?, render({ data, setData, errors }), validate?(data) => string[]|null, optional? }
 *   data               — current form data (controlled by parent)
 *   setData            — updater (newPartial => merge into data) — accepts (partial|fn)
 *   onFinish           — async (data) => any; called when "Finish" clicked on last step
 *   finishLabel        — defaults "Finish"
 *   accentColor        — tailwind colour (default "[#082c59]")
 *
 * Stepper sits on the LEFT, step content on the RIGHT. Footer holds Back / Next / Finish.
 */
export default function SetupWizard({
  open,
  onOpenChange,
  title,
  subtitle,
  steps = [],
  data,
  setData,
  onFinish,
  finishLabel = 'Finish',
  accentColor = '#082c59',
}) {
  const [activeStep, setActiveStep] = React.useState(0);
  const [errors, setErrors] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setActiveStep(0);
      setErrors({});
    }
  }, [open]);

  if (!steps.length) return null;
  const step = steps[activeStep];
  const isLast = activeStep === steps.length - 1;
  const isFirst = activeStep === 0;

  const runValidation = () => {
    const out = step?.validate ? step.validate(data) : null;
    if (out && (Array.isArray(out) ? out.length : Object.keys(out || {}).length)) {
      setErrors(Array.isArray(out) ? { _: out } : out);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (!runValidation()) return;
    setActiveStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));

  const handleFinish = async () => {
    if (!runValidation()) return;
    setSubmitting(true);
    try {
      await onFinish?.(data);
    } finally {
      setSubmitting(false);
    }
  };

  const updateData = (partial) => {
    if (typeof partial === 'function') setData(partial);
    else setData((p) => ({ ...p, ...partial }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white max-w-4xl w-[94vw] p-0 overflow-hidden"
        data-testid="setup-wizard"
      >
        <div className="grid grid-cols-12 min-h-[540px]">
          {/* LEFT RAIL — stepper */}
          <div
            className="col-span-12 md:col-span-4 p-6 text-white"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold" data-testid="wizard-title">{title}</h2>
              <button
                onClick={() => onOpenChange?.(false)}
                className="text-white/70 hover:text-white md:hidden"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {subtitle && <p className="text-xs text-white/70 mb-6">{subtitle}</p>}

            <ol className="space-y-3" data-testid="wizard-stepper">
              {steps.map((s, i) => {
                const completed = i < activeStep;
                const current = i === activeStep;
                return (
                  <li key={s.id} className="flex items-start gap-3" data-testid={`wizard-step-indicator-${s.id}`}>
                    <div
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                        completed
                          ? 'bg-white text-[#082c59] border-white'
                          : current
                          ? 'bg-white/20 text-white border-white shadow'
                          : 'bg-transparent text-white/50 border-white/30'
                      }`}
                    >
                      {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <div className="pt-0.5">
                      <p className={`text-sm font-medium ${current ? 'text-white' : completed ? 'text-white/90' : 'text-white/60'}`}>
                        {s.title}
                      </p>
                      {s.description && (
                        <p className="text-[11px] text-white/50 leading-snug mt-0.5">{s.description}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* RIGHT — content */}
          <div className="col-span-12 md:col-span-8 flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto max-h-[60vh]">
              <h3 className="text-base font-semibold text-slate-900 mb-1" data-testid={`wizard-step-title-${step.id}`}>
                {step.title}
              </h3>
              {step.description && (
                <p className="text-xs text-slate-500 mb-4">{step.description}</p>
              )}
              {errors?._?.length > 0 && (
                <div className="mb-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
                  <ul className="list-disc ml-4">
                    {errors._.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div data-testid={`wizard-step-content-${step.id}`}>
                {step.render({ data, setData: updateData, errors })}
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isFirst || submitting}
                data-testid="wizard-back-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="text-xs text-slate-500">
                Step {activeStep + 1} of {steps.length}
              </div>
              {isLast ? (
                <Button
                  className="text-white"
                  style={{ backgroundColor: accentColor }}
                  onClick={handleFinish}
                  disabled={submitting}
                  data-testid="wizard-finish-btn"
                >
                  {submitting ? 'Working…' : finishLabel}
                </Button>
              ) : (
                <Button
                  className="text-white"
                  style={{ backgroundColor: accentColor }}
                  onClick={handleNext}
                  disabled={submitting}
                  data-testid="wizard-next-btn"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
