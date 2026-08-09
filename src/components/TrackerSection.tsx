import type { CalcResult } from "../lib/calc";
import type { MpptTracker, PVModule } from "../lib/types";
import type { TrackerConfig } from "../lib/urlState";
import { NumberField } from "./NumberField";
import { ResultPanel } from "./ResultPanel";
import { VoltageChart } from "./VoltageChart";

interface Props {
  tracker: MpptTracker;
  config: TrackerConfig;
  module: PVModule | null; // global module from step 2
  result: CalcResult | null;
  tempMin: number;
  tempMax: number;
  onChange: (patch: Partial<TrackerConfig>) => void;
}

// One independent MPPT input: enable toggle, series/parallel layout, own
// result table and voltage/temperature chart. The module comes from step 2.
export function TrackerSection({
  tracker,
  config,
  module: mod,
  result,
  tempMin,
  tempMax,
  onChange,
}: Props) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        config.enabled
          ? "border-sky-500/40 bg-slate-900/70 shadow-lg shadow-black/20"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-5 w-5 rounded accent-sky-500"
        />
        <span className="font-semibold text-slate-100">{tracker.tracker_label}</span>
        <span className="text-sm text-slate-400">
          {tracker.v_mppt_min}–{tracker.v_mppt_max} V · max. {tracker.v_max_absolute} V ·{" "}
          {tracker.i_max} A
        </span>
      </label>

      {config.enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Module in Serie"
              value={config.modulesInSeries}
              min={1}
              stepper
              onChange={(v) => onChange({ modulesInSeries: Math.max(1, Math.trunc(v)) })}
            />
            <NumberField
              label="Strings parallel"
              value={config.stringsParallel}
              min={1}
              stepper
              onChange={(v) => onChange({ stringsParallel: Math.max(1, Math.trunc(v)) })}
            />
          </div>
          {result && <ResultPanel result={result} tracker={tracker} />}
          {mod && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">
                Spannungs-/Temperatur-Graph
              </h3>
              <VoltageChart
                module={mod}
                modulesInSeries={config.modulesInSeries}
                tracker={tracker}
                tempMin={tempMin}
                tempMax={tempMax}
              />
            </div>
          )}
          {!mod && (
            <p className="text-sm text-slate-500">Modul in Schritt 2 wählen.</p>
          )}
        </div>
      )}
    </div>
  );
}
