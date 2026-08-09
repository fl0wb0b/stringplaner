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
import { stringCurrentAtTemp } from "../lib/calc";
import type { MpptTracker, PVModule } from "../lib/types";

interface Props {
  module: PVModule;
  stringsParallel: number;
  tracker: MpptTracker;
  tempMin: number;
  tempMax: number;
}

// Array-Strom über Temperatur mit der Tracker-Stromgrenze als Referenzlinie —
// das Strom-Gegenstück zum Spannungs-/Temperatur-Graph.
export function CurrentChart({ module: m, stringsParallel, tracker, tempMin, tempMax }: Props) {
  const from = Math.min(-30, Math.floor(tempMin / 5) * 5 - 5);
  const to = Math.max(85, Math.ceil(tempMax / 5) * 5 + 5);
  const data = [];
  for (let t = from; t <= to; t += 5) {
    data.push({
      t,
      i: Number(stringCurrentAtTemp(m, stringsParallel, t).toFixed(2)),
    });
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
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
            label={{ value: "A", position: "insideTopLeft", fill: "#94a3b8", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(t) => `${t} °C`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => <span style={{ color: "#94a3b8" }}>{value}</span>}
          />
          <ReferenceLine
            y={tracker.i_max}
            stroke="#ef4444"
            strokeDasharray="6 3"
            label={{ value: `max. ${tracker.i_max} A`, fill: "#ef4444", fontSize: 11, position: "insideTopRight" }}
          />
          <ReferenceLine x={tempMin} stroke="#64748b" strokeDasharray="2 4" />
          <ReferenceLine x={tempMax} stroke="#64748b" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="i" name="I (Array)" stroke="#3987e5" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
