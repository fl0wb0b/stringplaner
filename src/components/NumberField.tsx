import { useEffect, useState } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  stepper?: boolean; // show +/- buttons (useful on touch devices)
}

// Number input that stays editable: keeps a local draft while typing (so the
// field can be cleared), commits valid values immediately, supports arrow-key
// stepping and optional +/- buttons.
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  stepper = false,
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const clamp = (v: number) => {
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    // avoid float artifacts like 0.30000000000000004 when stepping
    return Number(v.toFixed(4));
  };

  const commit = (raw: string) => {
    const v = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(v)) onChange(clamp(v));
  };

  const nudge = (dir: 1 | -1) => {
    const next = clamp(value + dir * step);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">
        {label}
        {unit ? <span className="text-slate-500"> ({unit})</span> : null}
      </span>
      <div className="flex">
        {stepper && (
          <button
            type="button"
            aria-label={`${label} verringern`}
            onClick={() => nudge(-1)}
            className="rounded-l-lg border border-r-0 border-slate-600 bg-slate-800 px-3 text-lg text-slate-300 select-none hover:border-sky-500 hover:text-sky-400 active:bg-slate-700"
          >
            −
          </button>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => {
            setFocused(false);
            setDraft(String(value)); // discard invalid/empty draft
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              nudge(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              nudge(-1);
            } else if (e.key === "Enter") {
              commit(e.currentTarget.value);
              e.currentTarget.blur();
            }
          }}
          className={`w-full border border-slate-600 bg-slate-800 px-3 py-2 text-center tabular-nums text-slate-100 focus:border-sky-500 focus:outline-none ${
            stepper ? "rounded-none" : "rounded-lg"
          }`}
        />
        {stepper && (
          <button
            type="button"
            aria-label={`${label} erhöhen`}
            onClick={() => nudge(1)}
            className="rounded-r-lg border border-l-0 border-slate-600 bg-slate-800 px-3 text-lg text-slate-300 select-none hover:border-sky-500 hover:text-sky-400 active:bg-slate-700"
          >
            +
          </button>
        )}
      </div>
    </label>
  );
}
