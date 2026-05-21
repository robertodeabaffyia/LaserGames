"use client";

import { useState } from "react";
import type { EventoConRelaciones } from "@/types/eventos";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface CalendarioMesProps {
  eventos: EventoConRelaciones[];
  onSelectDay?: (date: Date) => void;
}

export default function CalendarioMes({ eventos, onSelectDay }: CalendarioMesProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0 = Sunday

  // Build calendar grid
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }

  // Map events to local date keys "YYYY-MM-DD"
  const eventsByDate = new Map<string, EventoConRelaciones[]>();
  for (const ev of eventos) {
    const d = new Date(ev.fecha_evento);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h2 className="text-sm font-semibold text-white">
          {MESES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-800">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className="h-20 border-b border-r border-gray-800/60" />;
          }
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const dayEventos = eventsByDate.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              onClick={() => onSelectDay?.(date)}
              className={`h-20 border-b border-r border-gray-800/60 p-1.5 cursor-pointer hover:bg-gray-800/40 transition-colors ${
                isToday ? "bg-indigo-950/30" : ""
              }`}
            >
              <span
                className={`text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday
                    ? "bg-indigo-500 text-white"
                    : "text-gray-400"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEventos.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className="truncate rounded bg-indigo-600/60 px-1 py-0.5 text-[10px] text-white leading-tight"
                    title={`${ev.nombre_festejado} — ${new Date(ev.fecha_evento).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
                  >
                    {ev.nombre_festejado}
                  </div>
                ))}
                {dayEventos.length > 2 && (
                  <div className="text-[10px] text-gray-500 pl-1">
                    +{dayEventos.length - 2} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
