"use client";

import { useState } from "react";
import type { EventoConRelaciones } from "@/types/eventos";
import { formatFecha, formatHora } from "@/lib/fecha";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00–21:00

interface CalendarioSemanaProps {
  eventos: EventoConRelaciones[];
  onSelectEvento?: (evento: EventoConRelaciones) => void;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarioSemana({ eventos, onSelectEvento }: CalendarioSemanaProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function prevWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function nextWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  const weekLabel = `${formatFecha(days[0])} – ${formatFecha(days[6])}`;
  const today = new Date();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <button
          onClick={prevWeek}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-white">{weekLabel}</span>
        <button
          onClick={nextWeek}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ›
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-800">
            <div />
            {days.map((d, i) => (
              <div
                key={i}
                className={`py-2 text-center text-xs font-medium border-l border-gray-800 ${
                  isSameDay(d, today) ? "text-indigo-400" : "text-gray-400"
                }`}
              >
                <div>{DIAS[d.getDay()]}</div>
                <div
                  className={`text-sm ${
                    isSameDay(d, today)
                      ? "bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto mt-0.5"
                      : "text-gray-200"
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-800/50 h-14">
              <div className="text-right pr-2 text-[10px] text-gray-600 pt-1">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((d, di) => {
                const cellEvents = eventos.filter((ev) => {
                  const start = new Date(ev.fecha_evento);
                  return isSameDay(start, d) && start.getHours() === hour;
                });
                return (
                  <div
                    key={di}
                    className="border-l border-gray-800/60 relative px-0.5"
                  >
                    {cellEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvento?.(ev)}
                        className="w-full text-left rounded bg-indigo-600/70 hover:bg-indigo-500/80 px-1.5 py-0.5 text-[10px] text-white truncate transition-colors"
                        title={ev.nombre_festejado}
                      >
                        {formatHora(ev.fecha_evento)}{" "}
                        {ev.nombre_festejado}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
