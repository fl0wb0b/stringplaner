import { moduleSlug } from "../lib/data";
import type { CalcResult } from "../lib/calc";
import type { MpptTracker, PVModule } from "../lib/types";
import type { TrackerConfig } from "../lib/urlState";
import { TRACKER_BORDER, TRACKER_DOT } from "../lib/trackerColors";
import { ModuleSearch } from "./ModuleSearch";
import { NumberField } from "./NumberField";
import { ResultPanel } from "./ResultPanel";
import { VoltageChart } from "./VoltageChart";

interface Props {
  tracker: MpptTracker;
  index: number; // color index, matches the distribution bar in the total summary
  config: TrackerConfig;
  module: PVModule | null; // global module from step 2
  modules: PVModule[]; // full list for the per-tracker override search
  overrideModule: PVModule | null; // deviating module for this tracker only
  result: CalcResult | null;
  tempMin: number;
  tempMax: number;
  onChange: (patch: Partial<TrackerConfig>) => void;
}

// One independent MPPT input: enable toggle, series/parallel layout, own
// result table and voltage/temperature chart. The module comes from step 2,
// unless a deviating module is chosen for this tracker (e.g. plant extension
// where the original module is no longer available).
export function TrackerSection({
  tracker,
  index,
  config,
  module: mod,
  modules,
  overrideModule,
  result,
  tempMin,
  tempMax,
  onChange,
}: Props) {
  const effectiveModule = overrideModule ?? mod;
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        config.enabled
          ? `${TRACKER_BORDER[index % TRACKER_BORDER.length]} bg-slate-900/70 shadow-lg shadow-black/20`
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
        <span
          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${TRACKER_DOT[index % TRACKER_DOT.length]}`}
        />
        <span className="font-semibold text-slate-100">{tracker.tracker_label}</span>
        <span className="text-sm text-slate-400">
          {tracker.v_mppt_min}–{tracker.v_mppt_max} V · max. {tracker.v_max_absolute} V ·{" "}
          {tracker.i_max} A
        </span>
        {config.enabled && result && (
          <span className="ml-auto text-sm font-semibold tabular-nums text-slate-200">
            {result.powerTotal.toLocaleString("de-DE", { maximumFractionDigits: 0 })} Wp
          </span>
        )}
      </label>

      {config.enabled && (
        <div className="mt-4 space-y-4">
          <div>
            <ModuleSearch
              modules={modules}
              selected={overrideModule}
              onSelect={(m) => onChange({ moduleSlug: moduleSlug(m) })}
              label={
                overrideModule
                  ? "Abweichendes Modul für diesen Tracker"
                  : "Abweichendes Modul für diesen Tracker (Standard: Modul aus Schritt 2)"
              }
            />
            {overrideModule ? (
              <button
                type="button"
                onClick={() => onChange({ moduleSlug: null })}
                className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              >
                Wieder Modul aus Schritt 2 verwenden
              </button>
            ) : (
              mod && (
                <p className="mt-1.5 text-sm text-slate-500">
                  Verwendet: {mod.manufacturer} {mod.model_name}
                </p>
              )
            )}
          </div>
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
          {effectiveModule ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">
                Spannungs-/Temperatur-Graph
              </h3>
              <VoltageChart
                module={effectiveModule}
                modulesInSeries={config.modulesInSeries}
                tracker={tracker}
                tempMin={tempMin}
                tempMax={tempMax}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Modul in Schritt 2 wählen.</p>
          )}
        </div>
      )}
    </div>
  );
}
