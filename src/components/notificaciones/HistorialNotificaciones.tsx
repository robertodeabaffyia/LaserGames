"use client";

import { useState, useEffect, useCallback } from "react";
import type { HistorialNotificacion, NotificacionTipo, NotificacionStatus } from "@/types/notificaciones";
import { NOTIFICACION_TIPOS, NOTIFICACION_TIPO_LABELS } from "@/types/notificaciones";

export default function HistorialNotificaciones() {
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [mes, setMes] = useState(defaultMes);
  const [tipoFiltro, setTipoFiltro] = useState<NotificacionTipo | "">("");
  const [statusFiltro, setStatusFiltro] = useState<NotificacionStatus | "">("");
  const [historial, setHistorial] = useState<HistorialNotificacion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mes) {
      const [year, month] = mes.split("-").map(Number);
      params.set("desde", `${mes}-01`);
      const lastDay = new Date(year, month, 0).getDate();
      params.set("hasta", `${mes}-${String(lastDay).padStart(2, "0")}`);
    }
    if (tipoFiltro) params.set("tipo", tipoFiltro);
    if (statusFiltro) params.set("status", statusFiltro);

    const res = await fetch(`/api/historial-notificaciones?${params}`);
    const data = await res.json();
    setHistorial(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [mes, tipoFiltro, statusFiltro]);

  useEffect(() => { load(); }, [load]);

  const enviados = historial.filter((h) => h.status === "enviado").length;
  const fallidos = historial.filter((h) => h.status === "fallido").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="label">Mes</label>
          <input
            type="month"
            className="input max-w-[170px]"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select
            className="input max-w-[200px]"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as NotificacionTipo | "")}
          >
            <option value="">Todos</option>
            {NOTIFICACION_TIPOS.map((t) => (
              <option key={t} value={t}>{NOTIFICACION_TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select
            className="input max-w-[140px]"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as NotificacionStatus | "")}
          >
            <option value="">Todos</option>
            <option value="enviado">Enviado</option>
            <option value="fallido">Fallido</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      {historial.length > 0 && (
        <div className="flex gap-3 text-xs">
          <span className="rounded-full bg-green-900/30 border border-green-800 px-3 py-1 text-green-400">
            ✓ {enviados} enviados
          </span>
          <span className="rounded-full bg-red-900/30 border border-red-800 px-3 py-1 text-red-400">
            ✗ {fallidos} fallidos
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando historial…</div>
      ) : historial.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          Sin registros en el período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Destinatario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {historial.map((h) => (
                <tr key={h.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-xs">
                    {new Date(h.fecha_envio).toLocaleString("es-MX", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {NOTIFICACION_TIPO_LABELS[h.tipo_notificacion]}
                  </td>
                  <td className="px-4 py-3 text-gray-400 capitalize text-xs">{h.canal}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{h.destinatario}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        h.status === "enviado"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                    {h.error_detalle ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historial.length > 0 && (
        <p className="text-xs text-gray-500 text-right">{historial.length} registros</p>
      )}
    </div>
  );
}
