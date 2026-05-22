"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface SparkPoint { v: number }

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: "green" | "red" | "blue" | "amber" | "default";
  spark?: SparkPoint[];
  icon?: string;
}

const colorMap = {
  green:   { badge: "text-green-400", border: "border-green-900/50", line: "#4ade80" },
  red:     { badge: "text-red-400",   border: "border-red-900/50",   line: "#f87171" },
  blue:    { badge: "text-indigo-400",border: "border-indigo-900/50",line: "#818cf8" },
  amber:   { badge: "text-amber-400", border: "border-amber-900/50", line: "#fbbf24" },
  default: { badge: "text-white",     border: "border-gray-800",     line: "#6b7280" },
};

export default function KPICard({ label, value, sub, color = "default", spark, icon }: Props) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border ${c.border} bg-gray-900/50 p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold ${c.badge}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
      {spark && spark.length > 1 && (
        <div className="h-10 w-full mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line type="monotone" dataKey="v" stroke={c.line} dot={false} strokeWidth={1.5} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "none", fontSize: 11 }}
                formatter={(v) => [v]}
                labelFormatter={() => ""}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
