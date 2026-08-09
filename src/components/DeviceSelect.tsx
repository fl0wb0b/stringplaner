import type { Inverter, MpptTracker } from "../lib/types";
import { inverterSlug } from "../lib/data";

interface Props {
  inverters: Inverter[];
  selectedSlug: string | null;
  trackerIndex: number;
  onSelectDevice: (slug: string) => void;
  onSelectTracker: (index: number) => void;
}

const DEVICE_TYPE_LABEL: Record<Inverter["device_type"], string> = {
  mppt_charger: "MPPT-Laderegler",
  string_inverter: "Wechselrichter",
  hybrid: "Hybrid",
};

export function DeviceSelect({
  inverters,
  selectedSlug,
  trackerIndex,
  onSelectDevice,
  onSelectTracker,
}: Props) {
  const device = inverters.find((i) => inverterSlug(i) === selectedSlug) ?? null;
  const tracker: MpptTracker | null = device?.trackers[trackerIndex] ?? null;

  const manufacturers = [...new Set(inverters.map((i) => i.manufacturer))];

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">
          Laderegler / Wechselrichter
        </label>
        <select
          value={selectedSlug ?? ""}
          onChange={(e) => onSelectDevice(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none"
        >
          <option value="" disabled>
            Gerät wählen …
          </option>
          {manufacturers.map((man) => (
            <optgroup key={man} label={man}>
              {inverters
                .filter((i) => i.manufacturer === man)
                .map((i) => (
                  <option key={inverterSlug(i)} value={inverterSlug(i)}>
                    {i.model_name} ({DEVICE_TYPE_LABEL[i.device_type]})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      {device && device.tracker_mode === "variants" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            {device.trackers.length > 1 && device.trackers[0].tracker_label.includes("Batterie")
              ? "Batteriespannung"
              : "Tracker / Eingang"}
          </label>
          <select
            value={trackerIndex}
            onChange={(e) => onSelectTracker(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {device.trackers.map((t, i) => (
              <option key={t.tracker_label} value={i}>
                {t.tracker_label}
              </option>
            ))}
          </select>
        </div>
      )}

      {device && device.tracker_mode !== "variants" && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
          <div>
            {device.trackers.length} unabhängige MPPT-Eingänge – unten einzeln konfigurierbar
          </div>
          <a
            href={device.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline"
          >
            Datenblatt / Quelle
          </a>
        </div>
      )}

      {device && device.tracker_mode === "variants" && tracker && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
          <div>
            MPPT-Fenster {tracker.v_mppt_min}–{tracker.v_mppt_max} V · max.{" "}
            {tracker.v_max_absolute} V absolut
          </div>
          <div>
            max. {tracker.i_max} A · max. {tracker.max_strings_parallel} String
            {tracker.max_strings_parallel !== 1 ? "s" : ""} parallel
            {tracker.p_max_w ? ` · ${tracker.p_max_w} W PV` : ""}
          </div>
          <a
            href={device.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline"
          >
            Datenblatt / Quelle
          </a>
        </div>
      )}
    </div>
  );
}
