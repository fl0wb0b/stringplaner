import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CalcResult, CheckStatus } from "../lib/calc";
import type { Inverter } from "../lib/types";
import { DEFAULT_YIELD, MONTH_LABELS, monthlyYield, yieldForPlz } from "../lib/plzYield";
import { TRACKER_DOT } from "../lib/trackerColors";
import {
  geizhalsSearchUrl,
  idealoSearchUrl,
  noCombinerNote,
  weidmuellerBoxFor,
} from "../lib/accessories";

interface Props {
  device: Inverter;
  results: Array<{
    label: string;
    result: CalcResult;
    colorIndex: number;
    stringsParallel: number;
  }>;
  plz: string;
  onPlzChange: (v: string) => void;
}

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  warnung: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  fehler: "bg-red-500/15 text-red-400 border-red-500/40",
};


const fmt = (v: number, digits = 0) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: digits });

// Step 4: total installed power over all active trackers, per-tracker share,
// DC/AC ratio with oversizing warning, and a simple annual-yield estimate.
export function TotalSummary({ device, results, plz, onPlzChange }: Props) {
  if (!results.length) return null;

  const totalWp = results.reduce((a, r) => a + r.result.powerTotal, 0);
  const acW = device.ac_power_nominal_w;
  const dcAcRatio = acW ? totalWp / acW : null;
  const oversized = dcAcRatio != null && dcAcRatio > 1.3;

  const worst: CheckStatus = results.some((r) => r.result.overallStatus === "fehler")
    ? "fehler"
    : oversized || results.some((r) => r.result.overallStatus === "warnung")
      ? "warnung"
      : "ok";

  const text =
    worst === "fehler"
      ? "NICHT zulässig – mindestens ein Tracker verletzt eine Grenze"
      : oversized
        ? `Zulässig, mit Warnung – Überdimensionierung ${Math.round(
            dcAcRatio! * 100,
          )} % der AC-Nennleistung (> 130 % empfohlen)`
        : worst === "warnung"
          ? "Zulässig, mit Warnung"
          : "Konfiguration zulässig";

  const deviceQuery = `${device.manufacturer} ${device.model_name}`;
  const combinerRecommendations = results
    .map((r) => ({ label: r.label, box: weidmuellerBoxFor(r.stringsParallel) }))
    .filter((r): r is { label: string; box: NonNullable<ReturnType<typeof weidmuellerBoxFor>> } =>
      r.box !== null,
    );
  const noCombinerNotes = results
    .map((r) => ({ label: r.label, note: noCombinerNote(r.stringsParallel) }))
    .filter((r): r is { label: string; note: string } => r.note !== null);

  const plzYield = yieldForPlz(plz);
  const specificYield = plzYield?.value ?? DEFAULT_YIELD;
  const annualKwh = (totalWp / 1000) * specificYield;
  const monthlyData = monthlyYield(annualKwh).map((kwh, i) => ({
    monat: MONTH_LABELS[i],
    kwh: Math.round(kwh),
  }));

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${STATUS_STYLE[worst]}`}>
        {text}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm text-slate-400">Gesamt-PV-Leistung</span>
          <span className="text-lg font-semibold tabular-nums text-slate-100">
            {fmt(totalWp)} Wp
          </span>
        </div>
        {results.length > 1 && (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
              {results.map((r) => (
                <div
                  key={r.label}
                  className={TRACKER_DOT[r.colorIndex % TRACKER_DOT.length]}
                  style={{ width: `${(r.result.powerTotal / totalWp) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              {results.map((r) => (
                <span key={r.label} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${TRACKER_DOT[r.colorIndex % TRACKER_DOT.length]}`}
                  />
                  {r.label}: {fmt(r.result.powerTotal)} Wp
                </span>
              ))}
            </div>
          </>
        )}
        {dcAcRatio != null && (
          <p className="mt-2 text-sm text-slate-400">
            DC/AC-Verhältnis{" "}
            <span className="tabular-nums text-slate-200">
              {dcAcRatio.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
            </span>{" "}
            bei {fmt(acW!)} W AC-Nennleistung
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <label className="block">
          <span className="field-label">Postleitzahl (Standort)</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={plz}
            onChange={(e) => onPlzChange(e.target.value.replace(/\D/g, ""))}
            placeholder="z.B. 80331"
            className="field text-center tabular-nums"
          />
        </label>
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-center">
          <div className="text-xs text-slate-400">Jahresertrag (überschlägig)</div>
          <div className="text-lg font-semibold tabular-nums text-slate-100">
            {fmt(annualKwh)} kWh
          </div>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-300">
          Ertragsverlauf über das Jahr
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="monat" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                width={44}
                label={{ value: "kWh", position: "insideTopLeft", fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(250,204,21,0.08)" }}
                contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number) => [`${fmt(v)} kWh`, "Ertrag"]}
              />
              <Bar dataKey="kwh" fill="#facc15" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {plzYield
          ? `Region ${plzYield.region}: ca. ${fmt(plzYield.value)} kWh/kWp·a`
          : `Ohne gültige PLZ: Deutschland-Mittel ${fmt(DEFAULT_YIELD)} kWh/kWp·a`}
        {" – Überschlag für Südausrichtung ~30° Neigung mit typischer Monatsverteilung, keine Simulation."}
      </p>

      <div className="border-t border-slate-800 pt-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Einkaufshilfe</h3>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-slate-400">
              {device.manufacturer} {device.model_name}:
            </span>
            <a
              href={idealoSearchUrl(deviceQuery)}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              bei Idealo vergleichen ↗
            </a>
            <span className="text-slate-600">·</span>
            <a
              href={geizhalsSearchUrl(deviceQuery)}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              bei Geizhals vergleichen ↗
            </a>
          </div>
          {combinerRecommendations.map(({ label, box }) => (
            <div key={label} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-slate-400">{label} – Überspannungsschutz/Kombinierer:</span>
              <a
                href={box.url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
              >
                {box.name} ↗
              </a>
              <span className="text-xs text-slate-600">({box.note})</span>
            </div>
          ))}
          {noCombinerNotes.map(({ label, note }) => (
            <p key={label} className="text-xs text-slate-500">
              {label}: {note}
            </p>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Provisionsfreie Links zu Preisvergleichsportalen – keine Kaufempfehlung, Angaben ohne
          Gewähr.
        </p>
      </div>
    </div>
  );
}
