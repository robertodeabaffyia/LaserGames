"use client";

import { useState } from "react";
import { EMPLEADO_ROLES, type Empleado, type EmpleadoRol } from "@/types/empleados";

interface EmpleadoFormProps {
  empleado?: Empleado;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EmpleadoForm({ empleado, onSuccess, onCancel }: EmpleadoFormProps) {
  const isEditing = !!empleado;

  const [form, setForm] = useState({
    nombre: empleado?.nombre ?? "",
    dni: empleado?.dni ?? "",
    telefono: empleado?.telefono ?? "",
    email: empleado?.email ?? "",
    rol: (empleado?.rol ?? "general") as EmpleadoRol,
    tarifa_horaria: empleado?.tarifa_horaria?.toString() ?? "",
    fecha_contratacion: empleado?.fecha_contratacion ?? "",
    es_activo: empleado?.es_activo ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      dni: form.dni.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      rol: form.rol,
      tarifa_horaria: form.tarifa_horaria ? Number(form.tarifa_horaria) : null,
      fecha_contratacion: form.fecha_contratacion || null,
      es_activo: form.es_activo,
    };

    const url = isEditing ? `/api/empleados/${empleado!.id}` : "/api/empleados";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      setLoading(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nombre completo *</label>
          <input
            type="text"
            className="input"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">DNI</label>
          <input
            type="text"
            className="input"
            placeholder="12345678"
            value={form.dni}
            onChange={(e) => set("dni", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Rol *</label>
          <select
            className="input"
            value={form.rol}
            onChange={(e) => set("rol", e.target.value)}
            required
          >
            {EMPLEADO_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Teléfono</label>
          <input
            type="tel"
            className="input"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Tarifa horaria ($)</label>
          <input
            type="number"
            className="input"
            min={0}
            step="0.01"
            value={form.tarifa_horaria}
            onChange={(e) => set("tarifa_horaria", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Fecha de contratación</label>
          <input
            type="date"
            className="input"
            value={form.fecha_contratacion}
            onChange={(e) => set("fecha_contratacion", e.target.value)}
          />
        </div>

        {isEditing && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              id="es_activo"
              checked={form.es_activo}
              onChange={(e) => set("es_activo", e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500"
            />
            <label htmlFor="es_activo" className="text-sm text-gray-300">
              Empleado activo
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {loading ? "Guardando…" : isEditing ? "Actualizar" : "Crear empleado"}
        </button>
      </div>
    </form>
  );
}
