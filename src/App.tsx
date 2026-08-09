import { useEffect, useMemo, useState } from "react";
import { calculate, type CalcResult } from "./lib/calc";
import { inverterSlug, loadInverters, loadModules, moduleSlug } from "./lib/data";
import type { Inverter, PVModule } from "./lib/types";
import {
  CUSTOM_MODULE_SLUG,
  DEFAULT_CUSTOM_MODULE,
  DEFAULT_TRACKER_CONFIG,
  loadInitialConfig,
  persistConfig,
  type ConfigState,
  type CustomModuleValues,
  type TrackerConfig,
} from "./lib/urlState";
import { DeviceFinder } from "./components/DeviceFinder";
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

  // Keep the per-tracker config array aligned with the selected device.
  const trackerConfigs: TrackerConfig[] = useMemo(() => {
    if (!selectedDevice || !isIndependent) return [];
    return selectedDevice.trackers.map(
      (_, i) =>
        config.trackers[i] ?? {
          ...DEFAULT_TRACKER_CONFIG,
          enabled: i === 0,
          // carry over a module chosen before switching devices
          moduleSlug: i === 0 ? (config.trackers[0]?.moduleSlug ?? config.moduleSlug) : null,
        },
    );
  }, [selectedDevice, isIndependent, config.trackers, config.moduleSlug]);

  const updateTracker = (index: number, patch: Partial<TrackerConfig>) => {
    setConfig((c) => {
      const next = trackerConfigs.map((t, i) => (i === index ? { ...t, ...patch } : t));
      // When a tracker is switched on without a module yet, preset the module
      // from the nearest already configured tracker (usually the one above).
      if (patch.enabled && !next[index].moduleSlug) {
        const donor =
          [...next.slice(0, index)].reverse().find((t) => t.moduleSlug) ??
          next.find((t, i) => i !== index && t.moduleSlug);
        if (donor) next[index] = { ...next[index], moduleSlug: donor.moduleSlug };
      }
      return { ...c, trackers: next };
    });
  };

  const selectDevice = (slug: string) => {
    setConfig((c) => ({ ...c, deviceSlug: slug, trackerIndex: 0, trackers: [] }));
  };

  // --- variants mode (single input, e.g. Victron battery-voltage variants) ---
  const selectedModule = config.moduleSlug ? (moduleBySlug.get(config.moduleSlug) ?? null) : null;
  const variantTracker =
    !isIndependent && selectedDevice
      ? (selectedDevice.trackers[
          Math.min(config.trackerIndex, selectedDevice.trackers.length - 1)
        ] ?? null)
      : null;
  const variantResult =
    selectedModule && variantTracker
      ? calculate({
          module: selectedModule,
          modulesInSeries: config.modulesInSeries,
          stringsParallel: config.stringsParallel,
          tracker: variantTracker,
          tempMin: config.tempMin,
          tempMax: config.tempMax,
          cableLength: config.cableLength,
          crossSection: config.crossSection,
        })
      : null;

  // --- independent mode: one result per enabled tracker ---
  const trackerResults: Array<{
    label: string;
    module: PVModule | null;
    result: CalcResult | null;
  }> = isIndependent
    ? trackerConfigs.map((tc, i) => {
        const tracker = selectedDevice!.trackers[i];
        const mod = tc.enabled && tc.moduleSlug ? (moduleBySlug.get(tc.moduleSlug) ?? null) : null;
        const result =
          tc.enabled && mod
            ? calculate({
                module: mod,
                modulesInSeries: tc.modulesInSeries,
                stringsParallel: tc.stringsParallel,
                tracker,
                tempMin: config.tempMin,
                tempMax: config.tempMax,
                cableLength: config.cableLength,
                crossSection: config.crossSection,
              })
            : null;
        return { label: tracker.tracker_label, module: mod, result };
      })
    : [];
  const completeResults = trackerResults
    .filter((r) => r.result)
    .map((r) => ({ label: r.label, result: r.result! }));

  // Rarely changed inputs live in a collapsed card; the summary line shows the active values.
  const conditionsCard = (
    <details className="card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="card-title" style={{ marginBottom: 0 }}>
          Standort &amp; Verkabelung
        </span>
        <span className="text-sm tabular-nums text-slate-500">
          {config.tempMin} bis {config.tempMax} °C · {config.cableLength} m ·{" "}
          {config.crossSection} mm²
        </span>
      </summary>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          label="Min. Temperatur"
          unit="°C"
          value={config.tempMin}
          onChange={(v) => update({ tempMin: v })}
        />
        <NumberField
          label="Max. Modultemperatur"
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
    </details>
  );

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

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
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
            </div>
          </div>
          <button
            type="button"
            onClick={share}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 active:bg-sky-600"
          >
            {copied ? "Link kopiert ✓" : "Teilen"}
          </button>
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
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="card-title" style={{ marginBottom: 0 }}>
                  Gerät
                </h2>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 text-sm">
                  <button
                    type="button"
                    onClick={() => update({ mode: "check" })}
                    className={`px-3 py-1.5 transition-colors ${
                      config.mode !== "finder"
                        ? "bg-sky-500 font-semibold text-slate-950"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Prüfen
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ mode: "finder" })}
                    className={`px-3 py-1.5 transition-colors ${
                      config.mode === "finder"
                        ? "bg-sky-500 font-semibold text-slate-950"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Finden
                  </button>
                </div>
              </div>
              {config.mode === "finder" ? (
                <p className="text-sm text-slate-400">
                  Verschaltung unten festlegen – alle Geräte werden automatisch bewertet.
                </p>
              ) : (
                <DeviceSelect
                  inverters={inverters}
                  selectedSlug={config.deviceSlug}
                  trackerIndex={config.trackerIndex}
                  onSelectDevice={selectDevice}
                  onSelectTracker={(i) => update({ trackerIndex: i })}
                />
              )}
            </section>

            {config.mode === "finder" ? (
              <section className="space-y-4">
                <div className="card">
                  <h2 className="card-title">String-Konfiguration</h2>
                  <div className="space-y-4">
                    <ModulePicker
                      modules={modules}
                      selectedSlug={config.moduleSlug}
                      selectedModule={selectedModule}
                      custom={config.custom}
                      onSelect={(slug) => update(pickModule(slug))}
                      onCustomChange={updateCustom}
                    />
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
                  </div>
                </div>
                {conditionsCard}
                {selectedModule ? (
                  <section className="card">
                    <h2 className="card-title">Geeignete Geräte</h2>
                    <DeviceFinder
                      inverters={inverters}
                      module={selectedModule}
                      modulesInSeries={config.modulesInSeries}
                      stringsParallel={config.stringsParallel}
                      tempMin={config.tempMin}
                      tempMax={config.tempMax}
                      cableLength={config.cableLength}
                      crossSection={config.crossSection}
                      onPick={(slug, trackerIndex) => {
                        const device = inverters.find((i) => inverterSlug(i) === slug);
                        const independent = device?.tracker_mode !== "variants";
                        setConfig((c) => ({
                          ...c,
                          mode: "check",
                          deviceSlug: slug,
                          trackerIndex,
                          trackers: independent
                            ? (device?.trackers.map((_, i) => ({
                                enabled: i === trackerIndex,
                                moduleSlug: c.moduleSlug,
                                modulesInSeries: c.modulesInSeries,
                                stringsParallel: c.stringsParallel,
                              })) ?? [])
                            : [],
                        }));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  </section>
                ) : (
                  <p className="text-sm text-slate-500">Modul wählen, um Geräte zu bewerten.</p>
                )}
              </section>
            ) : isIndependent && selectedDevice ? (
              <section className="space-y-4">
                {selectedDevice.trackers.map((tracker, i) => (
                  <TrackerSection
                    key={tracker.tracker_label}
                    tracker={tracker}
                    config={trackerConfigs[i]}
                    modules={modules}
                    selectedModule={trackerResults[i]?.module ?? null}
                    result={trackerResults[i]?.result ?? null}
                    tempMin={config.tempMin}
                    tempMax={config.tempMax}
                    custom={config.custom}
                    onChange={(patch) => updateTracker(i, patch)}
                    onSelectModule={(slug) => {
                      if (slug === CUSTOM_MODULE_SLUG && !config.custom)
                        setConfig((c) => ({ ...c, custom: DEFAULT_CUSTOM_MODULE }));
                      updateTracker(i, { moduleSlug: slug });
                    }}
                    onCustomChange={updateCustom}
                  />
                ))}
                {conditionsCard}
                {completeResults.length > 0 ? (
                  <TotalSummary device={selectedDevice} results={completeResults} />
                ) : (
                  <p className="text-sm text-slate-500">
                    Mindestens einen Tracker aktivieren und ein Modul wählen.
                  </p>
                )}
              </section>
            ) : (
              <section className="space-y-4">
                <div className="card">
                  <h2 className="card-title">
                    String-Konfiguration
                  </h2>
                  <div className="space-y-4">
                    <ModulePicker
                      modules={modules}
                      selectedSlug={config.moduleSlug}
                      selectedModule={selectedModule}
                      custom={config.custom}
                      onSelect={(slug) => update(pickModule(slug))}
                      onCustomChange={updateCustom}
                    />
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
                  </div>
                </div>
                {conditionsCard}
                {variantResult && variantTracker ? (
                  <section className="card">
                    <h2 className="card-title">Ergebnis</h2>
                    <ResultPanel result={variantResult} tracker={variantTracker} />
                    {selectedModule && (
                      <div className="mt-4">
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
                  </section>
                ) : (
                  <p className="text-sm text-slate-500">
                    Modul und Gerät wählen, um die Prüfung zu starten.
                  </p>
                )}
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
