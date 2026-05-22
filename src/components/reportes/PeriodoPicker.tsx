"use client";

export type Periodo = "dia" | "semana" | "mes" | "anio" | "custom";

interface Rango { desde: string; hasta: string }

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function rangoFromPeriodo(periodo: Periodo, customRango?: Rango): Rango {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (periodo === "dia") {
    const d = isoDate(today);
    return { desde: d, hasta: d };
  }
  if (periodo === "semana") {
    const dow = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { desde: isoDate(monday), hasta: isoDate(sunday) };
  }
  if (periodo === "mes") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return {
      desde: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      hasta: `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    };
  }
  if (periodo === "anio") {
    const y = today.getFullYear();
    return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
  }
  return customRango ?? { desde: isoDate(today), hasta: isoDate(today) };
}

const OPCIONES: { key: Periodo; label: string }[] = [
  { key: "dia",    label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "mes",    label: "Mes" },
  { key: "anio",   label: "Año" },
  { key: "custom", label: "Personalizado" },
];

interface Props {
  value: Periodo;
  onChange: (p: Periodo) => void;
  customRango: Rango;
  onCustomRango: (r: Rango) => void;
}

export default function PeriodoPicker({ value, onChange, customRango, onCustomRango }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 p-0.5">
        {OPCIONES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              value === key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="date"
            className="input max-w-[140px]"
            value={customRango.desde}
            onChange={(e) => onCustomRango({ ...customRango, desde: e.target.value })}
          />
          <span>—</span>
          <input
            type="date"
            className="input max-w-[140px]"
            value={customRango.hasta}
            onChange={(e) => onCustomRango({ ...customRango, hasta: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
