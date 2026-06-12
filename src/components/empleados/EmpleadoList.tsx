"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Empleado } from "@/types/empleados";
import { formatMoneda } from "@/lib/moneda";

interface EmpleadoListProps {
  onEdit: (empleado: Empleado) => void;
  onDeactivate: (id: string) => void;
  refreshKey?: number;
}

const ROL_COLORS: Record<string, string> = {
  administrador: "text-amber-300 border-amber-700 bg-amber-900/30",
  supervisor: "text-blue-300 border-blue-700 bg-blue-900/30",
  general: "text-gray-300 border-gray-700 bg-gray-800/40",
};

export default function EmpleadoList({ onEdit, onDeactivate, refreshKey }: EmpleadoListProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activoFilter, setActivoFilter] = useState<"todos" | "activos" | "inactivos">("activos");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (activoFilter === "activos") params.set("activo", "true");
    if (activoFilter === "inactivos") params.set("activo", "false");

    const res = await fetch(`/api/empleados?${params}`);
    const data = await res.json();
    setEmpleados(data ?? []);
    setLoading(false);
  }, [q, activoFilter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          className="input max-w-[260px]"
          placeholder="Buscar por nombre, DNI o teléfono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 p-0.5 gap-0.5">
          {(["activos", "todos", "inactivos"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setActivoFilter(opt)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activoFilter === opt
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando…</div>
      ) : empleados.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          No se encontraron empleados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3 text-right">Tarifa/h</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {empleados.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/empleados/${emp.id}`}
                      className="font-medium text-white hover:text-indigo-400 transition-colors"
                    >
                      {emp.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{emp.dni ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ROL_COLORS[emp.rol] ?? ""}`}
                    >
                      {emp.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{emp.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {emp.tarifa_horaria != null
                      ? formatMoneda(emp.tarifa_horaria)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        emp.es_activo ? "bg-green-500" : "bg-gray-600"
                      }`}
                      title={emp.es_activo ? "Activo" : "Inactivo"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onEdit(emp)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
                      >
                        Editar
                      </button>
                      {emp.es_activo && (
                        <button
                          onClick={() => onDeactivate(emp.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
