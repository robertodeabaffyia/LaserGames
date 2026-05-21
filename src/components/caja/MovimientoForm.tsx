"use client";

import { useState } from "react";
import type { MovimientoTipo, MovimientoCategoria, FrecuenciaRepeticion } from "@/types/caja";
import { CATEGORIAS_MANUALES } from "@/types/caja";

interface MovimientoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export default function MovimientoForm({ onSuccess, onCancel }: MovimientoFormProps) {
  const [form, setForm] = useState({
    tipo: "egreso" as MovimientoTipo,
    categoria: "otros" as MovimientoCategoria,
    descripcion: "",
    monto: "",
    fecha: today(),
    es_repetible: false,
    frecuencia_repeticion: "" as FrecuenciaRepeticion | "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) {
      setError("Monto debe ser mayor a 0");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/movimientos-caja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: form.tipo,
        categoria: form.categoria,
        descripcion: form.descripcion,
        monto,
        fecha: form.fecha,
        es_repetible: form.es_repetible,
        frecuencia_repeticion: form.es_repetible && form.frecuencia_repeticion
          ? form.frecuencia_repeticion
          : null,
      }),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tipo *</label>
          <select
            className="input"
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value as MovimientoTipo)}
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </div>

        <div>
          <label className="label">Categoría *</label>
          <select
            className="input"
            value={form.categoria}
            onChange={(e) => set("categoria", e.target.value as MovimientoCategoria)}
          >
            {CATEGORIAS_MANUALES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Descripción *</label>
        <input
          type="text"
          className="input"
          required
          placeholder="Ej. Compra de insumos…"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Monto *</label>
          <input
            type="number"
            className="input"
            required
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.monto}
            onChange={(e) => set("monto", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Fecha *</label>
          <input
            type="date"
            className="input"
            required
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="es_repetible"
          type="checkbox"
          className="rounded border-gray-600"
          checked={form.es_repetible}
          onChange={(e) => set("es_repetible", e.target.checked)}
        />
        <label htmlFor="es_repetible" className="text-sm text-gray-300">
          Movimiento repetible
        </label>
      </div>

      {form.es_repetible && (
        <div>
          <label className="label">Frecuencia</label>
          <select
            className="input"
            value={form.frecuencia_repeticion}
            onChange={(e) => set("frecuencia_repeticion", e.target.value as FrecuenciaRepeticion | "")}
          >
            <option value="">Seleccionar…</option>
            <option value="mensual">Mensual</option>
            <option value="semanal">Semanal</option>
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {loading ? "Guardando…" : "Guardar movimiento"}
        </button>
      </div>
    </form>
  );
}
