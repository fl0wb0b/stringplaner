import { useEffect, useMemo, useState } from "react";
import { calculate } from "./lib/calc";
import { inverterSlug, loadInverters, loadModules, moduleSlug } from "./lib/data";
import type { Inverter, PVModule } from "./lib/types";
import { loadInitialConfig, persistConfig, type ConfigState } from "./lib/urlState";
import { DeviceSelect } from "./components/DeviceSelect";
import { ModuleSearch } from "./components/ModuleSearch";
import { NumberField } from "./components/NumberField";
import { ResultPanel } from "./components/ResultPanel";
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

  useEffect(() => {
    persistConfig(config);
  }, [config]);

  const moduleBySlug = useMemo(() => {
    const map = new Map<string, PVModule>();
    for (const m of modules ?? []) map.set(moduleSlug(m), m);
    return map;
  }, [modules]);

  const selectedModule = config.moduleSlug ? (moduleBySlug.get(config.moduleSlug) ?? null) : null;
  const selectedDevice =
    (inverters ?? []).find((i) => inverterSlug(i) === config.deviceSlug) ?? null;
  const selectedTracker =
    selectedDevice?.trackers[
      Math.min(config.trackerIndex, (selectedDevice?.trackers.length ?? 1) - 1)
    ] ?? null;

  const result =
    selectedModule && selectedTracker
      ? calculate({
          module: selectedModule,
          modulesInSeries: config.modulesInSeries,
          stringsParallel: config.stringsParallel,
          tracker: selectedTracker,
          tempMin: config.tempMin,
          tempMax: config.tempMax,
          cableLength: config.cableLength,
          crossSection: config.crossSection,
        })
      : null;

  const update = (patch: Partial<ConfigState>) => setConfig((c) => ({ ...c, ...patch }));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. iOS without user gesture context) — URL bar still works
    }
  };

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Stringplaner</h1>
            <p className="text-sm text-slate-400">
              PV-String-Rechner für MPPT-Laderegler &amp; Wechselrichter
            </p>
          </div>
          <button
            type="button"
            onClick={share}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-sky-500"
          >
            {copied ? "Link kopiert ✓" : "Teilen"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {loadError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-400">
            Daten konnten nicht geladen werden: {loadError}
          </div>
        )}

        {!modules || !inverters ? (
          !loadError && <p className="text-slate-400">Lade Modul- und Gerätedaten …</p>
        ) : (
          <>
            <section className="space-y-4">
              <ModuleSearch
                modules={modules}
                selected={selectedModule}
                onSelect={(m) => update({ moduleSlug: moduleSlug(m) })}
              />
              <DeviceSelect
                inverters={inverters}
                selectedSlug={config.deviceSlug}
                trackerIndex={config.trackerIndex}
                onSelectDevice={(slug) => update({ deviceSlug: slug, trackerIndex: 0 })}
                onSelectTracker={(i) => update({ trackerIndex: i })}
              />
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField
                label="Module in Serie"
                value={config.modulesInSeries}
                min={1}
                onChange={(v) => update({ modulesInSeries: Math.max(1, Math.trunc(v)) })}
              />
              <NumberField
                label="Strings parallel"
                value={config.stringsParallel}
                min={1}
                onChange={(v) => update({ stringsParallel: Math.max(1, Math.trunc(v)) })}
              />
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
            </section>

            {result && selectedTracker ? (
              <>
                <ResultPanel result={result} tracker={selectedTracker} />
                {selectedModule && (
                  <section>
                    <h2 className="mb-2 text-sm font-medium text-slate-300">
                      String-Spannung über Temperatur
                    </h2>
                    <VoltageChart
                      module={selectedModule}
                      modulesInSeries={config.modulesInSeries}
                      tracker={selectedTracker}
                      tempMin={config.tempMin}
                      tempMax={config.tempMax}
                    />
                  </section>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Modul und Gerät wählen, um die Prüfung zu starten.
              </p>
            )}
          </>
        )}

        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          Moduldaten: CEC (California Energy Commission / NREL SAM). Gerätedaten manuell aus
          Herstellerangaben – vor Installation immer das Original-Datenblatt prüfen. Alle
          Angaben ohne Gewähr.
        </footer>
      </main>
    </div>
  );
}

export default App;
