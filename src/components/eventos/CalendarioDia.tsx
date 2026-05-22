"use client";

import { useState } from "react";
import type { EventoConRelaciones } from "@/types/eventos";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00–21:00

interface CalendarioDiaProps {
  eventos: EventoConRelaciones[];
  initialDate?: Date;
  onSelectEvento?: (evento: EventoConRelaciones) => void;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarioDia({
  eventos,
  initialDate,
  onSelectEvento,
}: CalendarioDiaProps) {
  const [date, setDate] = useState(() => {
    const d = initialDate ?? new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  function prevDay() {
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }

  function nextDay() {
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }

  const dayLabel = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const dayEventos = eventos.filter((ev) => sameDay(new Date(ev.fecha_evento), date));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <button
          onClick={prevDay}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-white capitalize">{dayLabel}</span>
        <button
          onClick={nextDay}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ›
        </button>
      </div>

      {/* Time slots */}
      <div className="divide-y divide-gray-800/50">
        {HOURS.map((hour) => {
          const slotEvents = dayEventos.filter(
            (ev) => new Date(ev.fecha_evento).getHours() === hour
          );
          return (
            <div key={hour} className="flex min-h-[56px]">
              <div className="w-16 flex-shrink-0 text-right pr-3 text-xs text-gray-600 pt-2">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 border-l border-gray-800/60 px-2 py-1.5 space-y-1">
                {slotEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvento?.(ev)}
                    className="w-full text-left rounded-lg bg-indigo-600/70 hover:bg-indigo-500/80 px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {ev.nombre_festejado}
                      </span>
                      <span className="text-xs text-indigo-200">
                        {new Date(ev.fecha_evento).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" – "}
                        {new Date(
                          new Date(ev.fecha_evento).getTime() +
                            ev.duracion_horas * 3_600_000 +
                            (ev.duracion_minutos ?? 0) * 60_000
                        ).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {ev.cliente && (
                      <p className="text-xs text-indigo-300 mt-0.5">{ev.cliente.nombre}</p>
                    )}
                    <p className="text-xs text-indigo-200/70 mt-0.5">
                      {ev.paquete?.nombre} ·{" "}
                      <span
                        className={`capitalize ${
                          ev.estado === "confirmado"
                            ? "text-green-300"
                            : ev.estado === "cancelado"
                            ? "text-red-300"
                            : "text-indigo-300"
                        }`}
                      >
                        {ev.estado.replace("_", " ")}
                      </span>
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {dayEventos.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500">
          Sin eventos para este día.
        </div>
      )}
    </div>
  );
}
