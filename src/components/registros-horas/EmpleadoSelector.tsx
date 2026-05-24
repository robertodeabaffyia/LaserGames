"use client";

import { useEffect, useState } from "react";
import type { Empleado } from "@/types/empleados";

interface Props {
  value: Empleado | null;
  onChange: (emp: Empleado | null) => void;
}

export default function EmpleadoSelector({ value, onChange }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/empleados?activo=true")
      .then((r) => r.json())
      .then((data: Empleado[]) => {
        setEmpleados(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter
    ? empleados.filter((e) =>
        e.nombre.toLowerCase().includes(filter.toLowerCase())
      )
    : empleados;

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    onChange(empleados.find((emp) => emp.id === id) ?? null);
    setFilter("");
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Cargando empleados…</p>;
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Buscar empleado…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
      />
      <select
        value={value?.id ?? ""}
        onChange={handleSelect}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
      >
        <option value="">— Seleccionar empleado —</option>
        {filtered.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.nombre} — {emp.rol}
          </option>
        ))}
      </select>
    </div>
  );
}
