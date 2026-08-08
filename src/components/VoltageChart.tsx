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
}

// Voc/Vmp string voltage over temperature with the tracker limits as
// reference lines — the visual counterpart to the table (TASKS.md 4b).
export function VoltageChart({ module: m, modulesInSeries, tracker, tempMin, tempMax }: Props) {
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
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            label={{ value: "Temperatur (°C)", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            width={44}
            label={{ value: "V", position: "insideTopLeft", fill: "#94a3b8", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(t) => `${t} °C`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            y={tracker.v_max_absolute}
            stroke="#ef4444"
            strokeDasharray="6 3"
            label={{ value: `max. ${tracker.v_max_absolute} V`, fill: "#ef4444", fontSize: 11, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={tracker.v_mppt_min}
            stroke="#38bdf8"
            strokeDasharray="6 3"
            label={{ value: `MPPT min. ${tracker.v_mppt_min} V`, fill: "#38bdf8", fontSize: 11, position: "insideBottomRight" }}
          />
          <ReferenceLine x={tempMin} stroke="#64748b" strokeDasharray="2 4" />
          <ReferenceLine x={tempMax} stroke="#64748b" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="voc" name="Voc (String)" stroke="#f59e0b" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="vmp" name="Vmp (String)" stroke="#22c55e" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
