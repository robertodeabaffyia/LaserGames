"use client";

import { useState, useEffect, useCallback } from "react";
import type { MovimientoCaja, MovimientoTipo, MovimientoCategoria } from "@/types/caja";
import { MOVIMIENTO_CATEGORIAS, CATEGORIA_LABELS } from "@/types/caja";
import { formatMoneda } from "@/lib/moneda";
import { formatFecha } from "@/lib/fecha";

interface MovimientosListProps {
  refreshKey?: number;
  onRefresh?: () => void;
}

type PeriodoFiltro = "mes" | "semana" | "dia" | "todo";

function getWeekRange(date: Date): { desde: string; hasta: string } {
  const day = date.getDay(); // 0=Sun
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: fmt(monday), hasta: fmt(sunday) };
}

const TIPO_COLORS: Record<MovimientoTipo, string> = {
  ingreso: "text-green-400",
  egreso: "text-red-400",
};

export default function MovimientosList({ refreshKey, onRefresh }: MovimientosListProps) {
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const defaultDia = today.toISOString().split("T")[0];

  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [mes, setMes] = useState(defaultMes);
  const [dia, setDia] = useState(defaultDia);
  const [tipoFiltro, setTipoFiltro] = useState<MovimientoTipo | "">("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<MovimientoCategoria | "">("");
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    if (periodo === "mes") params.set("mes", mes);
    else if (periodo === "dia") params.set("dia", dia);
    else if (periodo === "semana") {
      const { desde, hasta } = getWeekRange(today);
      params.set("desde", desde);
      params.set("hasta", hasta);
    }

    if (tipoFiltro) params.set("tipo", tipoFiltro);
    if (categoriaFiltro) params.set("categoria", categoriaFiltro);

    const res = await fetch(`/api/movimientos-caja?${params}`);
    const data = await res.json();
    setMovimientos(Array.isArray(data) ? data : []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, mes, dia, tipoFiltro, categoriaFiltro]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await fetch(`/api/movimientos-caja/${id}`, { method: "DELETE" });
    load();
    onRefresh?.();
  }

  const totalIngresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos  = movimientos.filter(m => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Period tabs */}
        <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
          {(["mes", "semana", "dia", "todo"] as PeriodoFiltro[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                periodo === p ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {p === "mes" ? "Mes" : p === "semana" ? "Semana" : p === "dia" ? "Día" : "Todo"}
            </button>
          ))}
        </div>

        {periodo === "mes" && (
          <div>
            <input
              type="month"
              className="input max-w-[170px]"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
        )}

        {periodo === "dia" && (
          <div>
            <input
              type="date"
              className="input max-w-[170px]"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </div>
        )}

        <div>
          <select
            className="input max-w-[130px]"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as MovimientoTipo | "")}
          >
            <option value="">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>

        <div>
          <select
            className="input max-w-[160px]"
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value as MovimientoCategoria | "")}
          >
            <option value="">Todas las cat.</option>
            {MOVIMIENTO_CATEGORIAS.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 text-xs">
        <span className="rounded-full bg-green-900/30 border border-green-800 px-3 py-1 text-green-400 font-medium">
          ↑ Ingresos: {formatMoneda(totalIngresos)}
        </span>
        <span className="rounded-full bg-red-900/30 border border-red-800 px-3 py-1 text-red-400 font-medium">
          ↓ Egresos: {formatMoneda(totalEgresos)}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando…</div>
      ) : movimientos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          Sin movimientos en el período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                  <td className={`px-4 py-3 font-medium capitalize ${TIPO_COLORS[m.tipo]}`}>
                    {m.tipo}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {CATEGORIA_LABELS[m.categoria]}
                    {m.es_repetible && (
                      <span className="ml-1.5 text-xs text-indigo-400">↺ {m.frecuencia_repeticion}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-200 max-w-[240px] truncate">
                    {m.categoria === "pago_evento" && m.evento?.nombre_festejado
                      ? `${m.evento.nombre_festejado}${m.evento.cliente ? ` — ${m.evento.cliente.nombre}` : ""}`
                      : m.descripcion}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${TIPO_COLORS[m.tipo]}`}>
                    {m.tipo === "egreso" ? "−" : "+"}{formatMoneda(Number(m.monto))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {movimientos.length > 0 && (
        <p className="text-xs text-gray-500 text-right">{movimientos.length} movimientos</p>
      )}
    </div>
  );
}
