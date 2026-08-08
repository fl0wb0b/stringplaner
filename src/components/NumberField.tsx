interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function NumberField({ label, value, onChange, min, max, step = 1, unit }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">
        {label}
        {unit ? <span className="text-slate-500"> ({unit})</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 tabular-nums text-slate-100 focus:border-sky-500 focus:outline-none"
      />
    </label>
  );
}
