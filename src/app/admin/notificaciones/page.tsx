"use client";

import { useState } from "react";
import NotificacionesList from "@/components/notificaciones/NotificacionesList";
import HistorialNotificaciones from "@/components/notificaciones/HistorialNotificaciones";
import DesuscripcionesManager from "@/components/notificaciones/DesuscripcionesManager";

type Tab = "tipos" | "historial" | "desuscripciones";

export default function NotificacionesAdminPage() {
  const [tab, setTab] = useState<Tab>("tipos");
  const [cronStatus, setCronStatus] = useState<string | null>(null);
  const [cronLoading, setCronLoading] = useState<string | null>(null);

  async function runCron(tipo: "evento-recordatorio" | "cumpleanos" | "confirmacion-evento") {
    setCronLoading(tipo);
    setCronStatus(null);
    const res = await fetch(`/api/cron/${tipo}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setCronStatus(`${tipo}: ${data.enviados} notificaciones enviadas${data.errores?.length ? `, ${data.errores.length} errores` : ""}`);
    } else {
      setCronStatus(`Error en ${tipo}: ${data.error ?? "desconocido"}`);
    }
    setCronLoading(null);
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Configuración de recordatorios automáticos y canales de envío
        </p>
      </div>

      {/* Manual cron triggers */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Ejecutar jobs manualmente
        </h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "evento-recordatorio" as const, label: "Recordatorios de evento" },
              { key: "cumpleanos" as const, label: "Promos cumpleaños" },
              { key: "confirmacion-evento" as const, label: "Confirmaciones pendientes" },
            ]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => runCron(key)}
              disabled={cronLoading === key}
              className="rounded-lg border border-gray-700 hover:border-indigo-600 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white disabled:opacity-50 transition-colors"
            >
              {cronLoading === key ? "Ejecutando…" : `▶ ${label}`}
            </button>
          ))}
        </div>
        {cronStatus && (
          <p className="mt-2 text-xs text-gray-400">{cronStatus}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {(
          [
            { key: "tipos", label: "Tipos de notificación" },
            { key: "historial", label: "Historial" },
            { key: "desuscripciones", label: "Desuscripciones" },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tipos" && <NotificacionesList />}
      {tab === "historial" && <HistorialNotificaciones />}
      {tab === "desuscripciones" && <DesuscripcionesManager />}
    </div>
  );
}
