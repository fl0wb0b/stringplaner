import type { CalcResult } from "../lib/calc";
import type { MpptTracker, PVModule } from "../lib/types";
import type { CustomModuleValues, TrackerConfig } from "../lib/urlState";
import { ModulePicker } from "./ModulePicker";
import { NumberField } from "./NumberField";
import { ResultPanel } from "./ResultPanel";
import { VoltageChart } from "./VoltageChart";

interface Props {
  tracker: MpptTracker;
  config: TrackerConfig;
  modules: PVModule[];
  selectedModule: PVModule | null;
  result: CalcResult | null;
  tempMin: number;
  tempMax: number;
  custom: CustomModuleValues | null;
  onChange: (patch: Partial<TrackerConfig>) => void;
  onSelectModule: (slug: string) => void;
  onCustomChange: (patch: Partial<CustomModuleValues>) => void;
}

// One independent MPPT input: enable toggle, its own module + string layout,
// and its own result block. Used only for tracker_mode "independent" devices.
export function TrackerSection({
  tracker,
  config,
  modules,
  selectedModule,
  result,
  tempMin,
  tempMax,
  custom,
  onChange,
  onSelectModule,
  onCustomChange,
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
          <ModulePicker
            modules={modules}
            selectedSlug={config.moduleSlug}
            selectedModule={selectedModule}
            custom={custom}
            onSelect={onSelectModule}
            onCustomChange={onCustomChange}
          />
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
          {selectedModule && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">
                Spannungs-/Temperatur-Graph
              </h3>
              <VoltageChart
                module={selectedModule}
                modulesInSeries={config.modulesInSeries}
                tracker={tracker}
                tempMin={tempMin}
                tempMax={tempMax}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
