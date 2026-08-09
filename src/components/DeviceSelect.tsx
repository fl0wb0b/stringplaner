import type { Inverter, MpptTracker } from "../lib/types";
import { inverterSlug } from "../lib/data";
import { DeviceSearch } from "./DeviceSearch";

interface Props {
  inverters: Inverter[];
  selectedSlug: string | null;
  trackerIndex: number;
  onSelectDevice: (slug: string) => void;
  onSelectTracker: (index: number) => void;
}

export function DeviceSelect({
  inverters,
  selectedSlug,
  trackerIndex,
  onSelectDevice,
  onSelectTracker,
}: Props) {
  const device = inverters.find((i) => inverterSlug(i) === selectedSlug) ?? null;
  const tracker: MpptTracker | null = device?.trackers[trackerIndex] ?? null;

  return (
    <div className="space-y-3">
      <DeviceSearch
        inverters={inverters}
        selected={device}
        onSelect={(i) => onSelectDevice(inverterSlug(i))}
      />

      {device && device.tracker_mode === "variants" && (
        <div>
          <label className="field-label">
            {device.trackers.length > 1 && device.trackers[0].tracker_label.includes("Batterie")
              ? "Batteriespannung"
              : "Tracker / Eingang"}
          </label>
          <select
            value={trackerIndex}
            onChange={(e) => onSelectTracker(Number(e.target.value))}
            className="field"
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
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            {device.trackers.length} MPPT-Eingäng{device.trackers.length === 1 ? "" : "e"}
          </span>
          <a
            href={device.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline"
          >
            Datenblatt ↗
          </a>
        </div>
      )}

      {device && device.tracker_mode === "variants" && tracker && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 text-sm text-slate-400">
          <div>
            MPPT-Fenster {tracker.v_mppt_min}–{tracker.v_mppt_max} V · max.{" "}
            {tracker.v_max_absolute} V absolut
          </div>
          <div className="flex items-center justify-between">
            <span>
              max. {tracker.i_max} A · max. {tracker.max_strings_parallel} String
              {tracker.max_strings_parallel !== 1 ? "s" : ""} parallel
              {tracker.p_max_w ? ` · ${tracker.p_max_w} W PV` : ""}
            </span>
            <a
              href={device.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              Datenblatt ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
