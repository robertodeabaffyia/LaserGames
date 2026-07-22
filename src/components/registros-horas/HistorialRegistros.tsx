"use client";

import { useEffect, useState } from "react";
import type { Empleado, RegistroHorasConEmpleado } from "@/types/empleados";
import { formatearHoras } from "@/lib/registros-horas";
import { paginate, totalPages, PAGE_SIZE } from "@/lib/pagination";
import { formatFecha } from "@/lib/fecha";

interface Props {
  empleado: Empleado;
}

export default function HistorialRegistros({ empleado }: Props) {
  const [registros, setRegistros] = useState<RegistroHorasConEmpleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/registros-horas?empleado_id=${empleado.id}`)
      .then((r) => r.json())
      .then((data: RegistroHorasConEmpleado[]) => {
        if (!active) return;
        setRegistros(Array.isArray(data) ? data : []);
        setPage(1);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [empleado.id]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/registros-horas/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRegistros((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">Cargando registros…</p>;
  }

  if (registros.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        Sin registros de horas para este empleado.
      </p>
    );
  }

  const pages = totalPages(registros.length, PAGE_SIZE);
  const pageItems = paginate(registros, page, PAGE_SIZE);
  const totalHoras = registros.reduce((sum, r) => sum + r.horas_trabajadas, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {registros.length} registro{registros.length !== 1 ? "s" : ""}
        </span>
        <span className="text-gray-300">
          Total: <span className="text-white font-semibold">{formatearHoras(totalHoras)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Entrada</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Salida</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Horas</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Notas</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pageItems.map((r) => (
              <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3 text-gray-300">
                  {formatFecha(r.fecha)}
                </td>
                <td className="px-4 py-3 text-gray-300">{r.hora_entrada}</td>
                <td className="px-4 py-3 text-gray-300">{r.hora_salida}</td>
                <td className="px-4 py-3 text-white font-medium">
                  {formatearHoras(r.horas_trabajadas)}
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                  {r.notas ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-gray-500">
            Página {page} de {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
