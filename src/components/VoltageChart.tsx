import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { stringVmpAtTemp, stringVocAtTemp } from "../lib/calc";
import type { MpptTracker, PVModule } from "../lib/types";

interface Props {
  module: PVModule;
  modulesInSeries: number;
  tracker: MpptTracker;
  tempMin: number;
  tempMax: number;
  // MPPT-Laderegler: Batterie-Float-Spannung, falls gesetzt als zusätzliche
  // Untergrenze eingezeichnet (siehe calc.ts vmpMinEffective).
  batteryFloatVoltage?: number;
}

// Voc/Vmp string voltage over temperature with the tracker limits as
// reference lines — the visual counterpart to the table (TASKS.md 4b).
export function VoltageChart({
  module: m,
  modulesInSeries,
  tracker,
  tempMin,
  tempMax,
  batteryFloatVoltage,
}: Props) {
  const from = Math.min(-30, Math.floor(tempMin / 5) * 5 - 5);
  const to = Math.max(85, Math.ceil(tempMax / 5) * 5 + 5);
  const data = [];
  for (let t = from; t <= to; t += 5) {
    data.push({
      t,
      voc: Number(stringVocAtTemp(m, modulesInSeries, t).toFixed(1)),
      vmp: Number(stringVmpAtTemp(m, modulesInSeries, t).toFixed(1)),
    });
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
          {/* Grid als solide Haarlinie eine Stufe über dem Surface — gestrichelt
              bleibt den echten Grenzlinien vorbehalten (dataviz-Regel). */}
          <CartesianGrid stroke="#1e293b" />
          <XAxis
            dataKey="t"
            stroke="#334155"
            interval={2}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            label={{ value: "Temperatur (°C)", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            stroke="#334155"
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            width={44}
            label={{ value: "V", position: "insideTopLeft", fill: "#94a3b8", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(t) => `${t} °C`}
          />
          {/* Legendentext in Text-Ink, Farbe trägt nur der Marker (dataviz-Regel) */}
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => <span style={{ color: "#94a3b8" }}>{value}</span>}
          />
          <ReferenceLine
            y={tracker.v_max_absolute}
            stroke="#ef4444"
            strokeDasharray="6 3"
            label={{ value: `max. ${tracker.v_max_absolute} V`, fill: "#ef4444", fontSize: 11, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={tracker.v_mppt_min}
            stroke="#94a3b8"
            strokeDasharray="6 3"
            label={{ value: `MPPT min. ${tracker.v_mppt_min} V`, fill: "#94a3b8", fontSize: 11, position: "insideBottomRight" }}
          />
          {batteryFloatVoltage != null && (
            <ReferenceLine
              y={batteryFloatVoltage}
              stroke="#c98500"
              strokeDasharray="6 3"
              label={{
                value: `Batterie-Float ${batteryFloatVoltage} V`,
                fill: "#c98500",
                fontSize: 11,
                position: "insideBottomLeft",
              }}
            />
          )}
          <ReferenceLine x={tempMin} stroke="#64748b" strokeDasharray="2 4" />
          <ReferenceLine x={tempMax} stroke="#64748b" strokeDasharray="2 4" />
          {/* Blau/Orange: CVD-validiertes Paar (ΔE 26,8 protan auf #0f172a) —
              das frühere Amber/Grün kollabierte bei Rot-Grün-Blindheit (ΔE 5,7). */}
          <Line type="monotone" dataKey="voc" name="Voc (String)" stroke="#3987e5" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="vmp" name="Vmp (String)" stroke="#d95926" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
