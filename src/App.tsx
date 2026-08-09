import { useEffect, useMemo, useState } from "react";
import { calculate, type CalcResult } from "./lib/calc";
import { inverterSlug, loadInverters, loadModules, moduleSlug } from "./lib/data";
import type { Inverter, PVModule } from "./lib/types";
import {
  CUSTOM_MODULE_SLUG,
  DEFAULT_CONFIG,
  DEFAULT_CUSTOM_MODULE,
  DEFAULT_TRACKER_CONFIG,
  clearStoredConfig,
  loadInitialConfig,
  persistConfig,
  type ConfigState,
  type CustomModuleValues,
  type TrackerConfig,
} from "./lib/urlState";
import { DeviceSelect } from "./components/DeviceSelect";
import { ModulePicker } from "./components/ModulePicker";
import { NumberField } from "./components/NumberField";
import { ResultPanel } from "./components/ResultPanel";
import { TotalSummary } from "./components/TotalSummary";
import { TrackerSection } from "./components/TrackerSection";
import { VoltageChart } from "./components/VoltageChart";

function App() {
  const [modules, setModules] = useState<PVModule[] | null>(null);
  const [inverters, setInverters] = useState<Inverter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigState>(loadInitialConfig);
  const [copied, setCopied] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    loadModules().then(setModules).catch((e: Error) => setLoadError(e.message));
    loadInverters().then(setInverters).catch((e: Error) => setLoadError(e.message));
  }, []);

  const moduleBySlug = useMemo(() => {
    const map = new Map<string, PVModule>();
    for (const m of modules ?? []) map.set(moduleSlug(m), m);
    if (config.custom) {
      const c = config.custom;
      map.set(CUSTOM_MODULE_SLUG, {
        manufacturer: "Eigene Werte",
        model_name: `${c.power_stc} Wp`,
        power_stc: c.power_stc,
        voc: c.voc,
        vmp: c.vmp,
        isc: c.isc,
        imp: c.imp,
        temp_coeff_voc: c.temp_coeff_voc,
        temp_coeff_pmax: -0.3,
        temp_coeff_isc: (c.temp_coeff_isc_pct * c.isc) / 100,
        source: "manual",
      });
    }
    return map;
  }, [modules, config.custom]);

  const selectedDevice =
    (inverters ?? []).find((i) => inverterSlug(i) === config.deviceSlug) ?? null;
  // "variants" must be declared explicitly; anything else means independent trackers
  const isIndependent = selectedDevice != null && selectedDevice.tracker_mode !== "variants";

  useEffect(() => {
    persistConfig(config, isIndependent ? "independent" : "variants");
  }, [config, isIndependent]);

  const update = (patch: Partial<ConfigState>) => setConfig((c) => ({ ...c, ...patch }));

  const selectedModule = config.moduleSlug
    ? (moduleBySlug.get(config.moduleSlug) ?? null)
    : null;

  // Keep the per-tracker config array aligned with the selected device.
  const trackerConfigs: TrackerConfig[] = useMemo(() => {
    if (!selectedDevice || !isIndependent) return [];
    return selectedDevice.trackers.map(
      (_, i) => config.trackers[i] ?? { ...DEFAULT_TRACKER_CONFIG, enabled: i === 0 },
    );
  }, [selectedDevice, isIndependent, config.trackers]);

  const updateTracker = (index: number, patch: Partial<TrackerConfig>) => {
    setConfig((c) => ({
      ...c,
      trackers: trackerConfigs.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  };

  const selectDevice = (slug: string) => {
    setConfig((c) => ({ ...c, deviceSlug: slug, trackerIndex: 0, trackers: [] }));
  };

  // per-tracker module override (e.g. Anlagen-Erweiterung); null slug = Modul aus Schritt 2
  const moduleForTracker = (tc: TrackerConfig): PVModule | null =>
    tc.moduleSlug ? (moduleBySlug.get(tc.moduleSlug) ?? null) : selectedModule;

  const calcFor = (
    tracker: Inverter["trackers"][number],
    series: number,
    parallel: number,
    mod: PVModule | null = selectedModule,
  ) =>
    mod
      ? calculate({
          module: mod,
          modulesInSeries: series,
          stringsParallel: parallel,
          tracker,
          tempMin: config.tempMin,
          tempMax: config.tempMax,
          cableLength: config.cableLength,
          crossSection: config.crossSection,
        })
      : null;

  // variants devices (e.g. Victron battery-voltage variants): one input
  const variantTracker =
    !isIndependent && selectedDevice
      ? (selectedDevice.trackers[
          Math.min(config.trackerIndex, selectedDevice.trackers.length - 1)
        ] ?? null)
      : null;
  const variantResult = variantTracker
    ? calcFor(variantTracker, config.modulesInSeries, config.stringsParallel)
    : null;

  // independent devices: one result per enabled tracker
  const trackerResults: Array<CalcResult | null> = isIndependent
    ? trackerConfigs.map((tc, i) =>
        tc.enabled
          ? calcFor(
              selectedDevice!.trackers[i],
              tc.modulesInSeries,
              tc.stringsParallel,
              moduleForTracker(tc),
            )
          : null,
      )
    : [];
  const completeResults = isIndependent
    ? trackerResults
        .map((result, i) =>
          result
            ? { label: selectedDevice!.trackers[i].tracker_label, result, colorIndex: i }
            : null,
        )
        .filter(
          (r): r is { label: string; result: CalcResult; colorIndex: number } => r !== null,
        )
    : variantResult && variantTracker
      ? [{ label: variantTracker.tracker_label, result: variantResult, colorIndex: 0 }]
      : [];

  // Selecting the custom module for the first time seeds it with defaults.
  const pickModule = (slug: string): Partial<ConfigState> =>
    slug === CUSTOM_MODULE_SLUG && !config.custom
      ? { moduleSlug: slug, custom: DEFAULT_CUSTOM_MODULE }
      : { moduleSlug: slug };

  const updateCustom = (patch: Partial<CustomModuleValues>) =>
    setConfig((c) => ({ ...c, custom: { ...(c.custom ?? DEFAULT_CUSTOM_MODULE), ...patch } }));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — URL bar still works
    }
  };

  const resetAll = () => {
    clearStoredConfig();
    setConfig(DEFAULT_CONFIG);
    setResetDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setResetDone(false), 2000);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 px-4 pt-3 pb-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt=""
              className="h-9 w-9 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-semibold">Stringplaner</h1>
              <p className="text-sm text-slate-400">
                PV-String-Rechner für MPPT-Laderegler &amp; Wechselrichter
              </p>
              <span className="powered-by">
                <span className="powered-by__text">powered by fl0wb0b</span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              title="Konfiguration zurücksetzen"
              className="min-w-[146px] rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
            >
              {resetDone ? "Zurückgesetzt ✓" : "Zurücksetzen"}
            </button>
            <button
              type="button"
              onClick={share}
              className="min-w-[164px] rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 active:bg-sky-600"
            >
              {copied ? "Link kopiert ✓" : "Konfiguration speichern"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {loadError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-400">
            Daten konnten nicht geladen werden: {loadError}
          </div>
        )}

        {!modules || !inverters ? (
          !loadError && <p className="text-slate-400">Lade Modul- und Gerätedaten …</p>
        ) : (
          <>
            {/* 1 — Gerät */}
            <section className="card">
              <h2 className="card-title">Wechselrichter / MPPT</h2>
              <DeviceSelect
                inverters={inverters}
                selectedSlug={config.deviceSlug}
                trackerIndex={config.trackerIndex}
                onSelectDevice={selectDevice}
                onSelectTracker={(i) => update({ trackerIndex: i })}
              />
            </section>

            {/* 2 — Modul + Randbedingungen */}
            <section className="card">
              <h2 className="card-title">Modul</h2>
              <div className="space-y-4">
                <ModulePicker
                  modules={modules}
                  selectedSlug={config.moduleSlug}
                  selectedModule={selectedModule}
                  custom={config.custom}
                  onSelect={(slug) => update(pickModule(slug))}
                  onCustomChange={updateCustom}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumberField
                    label="Min. Temperatur"
                    unit="°C"
                    value={config.tempMin}
                    onChange={(v) => update({ tempMin: v })}
                  />
                  <NumberField
                    label="Max. Temperatur"
                    unit="°C"
                    value={config.tempMax}
                    onChange={(v) => update({ tempMax: v })}
                  />
                  <NumberField
                    label="Kabellänge einfach"
                    unit="m"
                    value={config.cableLength}
                    min={0}
                    step={0.5}
                    onChange={(v) => update({ cableLength: Math.max(0, v) })}
                  />
                  <NumberField
                    label="Kabelquerschnitt"
                    unit="mm²"
                    value={config.crossSection}
                    min={0.5}
                    step={0.5}
                    onChange={(v) => update({ crossSection: Math.max(0.5, v) })}
                  />
                </div>
              </div>
            </section>

            {/* 3 — Tracker / Strings */}
            {selectedDevice ? (
              isIndependent ? (
                <section className="space-y-4">
                  {selectedDevice.trackers.map((tracker, i) => (
                    <TrackerSection
                      key={tracker.tracker_label}
                      tracker={tracker}
                      index={i}
                      config={trackerConfigs[i]}
                      module={selectedModule}
                      modules={modules}
                      overrideModule={
                        trackerConfigs[i].moduleSlug
                          ? (moduleBySlug.get(trackerConfigs[i].moduleSlug!) ?? null)
                          : null
                      }
                      result={trackerResults[i]}
                      tempMin={config.tempMin}
                      tempMax={config.tempMax}
                      onChange={(patch) => updateTracker(i, patch)}
                    />
                  ))}
                </section>
              ) : (
                <section className="card">
                  <h2 className="card-title">String</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField
                        label="Module in Serie"
                        value={config.modulesInSeries}
                        min={1}
                        stepper
                        onChange={(v) =>
                          update({ modulesInSeries: Math.max(1, Math.trunc(v)) })
                        }
                      />
                      <NumberField
                        label="Strings parallel"
                        value={config.stringsParallel}
                        min={1}
                        stepper
                        onChange={(v) =>
                          update({ stringsParallel: Math.max(1, Math.trunc(v)) })
                        }
                      />
                    </div>
                    {variantResult && variantTracker ? (
                      <>
                        <ResultPanel result={variantResult} tracker={variantTracker} />
                        {selectedModule && (
                          <div>
                            <h3 className="mb-2 text-sm font-medium text-slate-300">
                              Spannungs-/Temperatur-Graph
                            </h3>
                            <VoltageChart
                              module={selectedModule}
                              modulesInSeries={config.modulesInSeries}
                              tracker={variantTracker}
                              tempMin={config.tempMin}
                              tempMax={config.tempMax}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Modul in Schritt 2 wählen.</p>
                    )}
                  </div>
                </section>
              )
            ) : (
              <p className="text-sm text-slate-500">
                Gerät und Modul wählen, um die Prüfung zu starten.
              </p>
            )}

            {/* 4 — Gesamtleistung */}
            {selectedDevice && completeResults.length > 0 && (
              <section className="card">
                <h2 className="card-title">Gesamtleistung</h2>
                <TotalSummary
                  device={selectedDevice}
                  results={completeResults}
                  plz={config.plz}
                  onPlzChange={(v) => update({ plz: v })}
                />
              </section>
            )}
          </>
        )}

        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          Alle Angaben ohne Gewähr – vor Installation Original-Datenblätter prüfen.{" "}
          <a
            href="https://github.com/fl0wb0b/stringplaner"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-sky-400 hover:underline"
          >
            Quellcode &amp; Datenquellen
          </a>
        </footer>
      </main>
    </div>
  );
}

export default App;
