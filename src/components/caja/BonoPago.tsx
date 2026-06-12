"use client";

import { useState, useEffect } from "react";
import type { Empleado } from "@/types/empleados";
import type { BonoEmpleado } from "@/types/caja";
import { formatMoneda } from "@/lib/moneda";

interface BonoPagoProps {
  onBonoPagado?: () => void;
}

export default function BonoPago({ onBonoPagado }: BonoPagoProps) {
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [bonos, setBonos] = useState<(BonoEmpleado & { empleado?: { nombre: string } })[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    empleado_id: "",
    mes: defaultMes,
    monto_bono: "",
    descripcion: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mesFiltro, setMesFiltro] = useState(defaultMes);

  useEffect(() => {
    fetch("/api/empleados?activo=true")
      .then((r) => r.json())
      .then((data) => setEmpleados(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetch(`/api/bonos?mes=${mesFiltro}`)
      .then((r) => r.json())
      .then((data) => setBonos(Array.isArray(data) ? data : []));
  }, [mesFiltro]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const monto_bono = parseFloat(form.monto_bono);
    if (isNaN(monto_bono) || monto_bono <= 0) {
      setError("Monto debe ser mayor a 0");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/bonos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empleado_id: form.empleado_id,
        mes: form.mes,
        monto_bono,
        descripcion: form.descripcion || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar bono");
      setLoading(false);
      return;
    }

    setForm({ empleado_id: "", mes: defaultMes, monto_bono: "", descripcion: "" });
    setShowForm(false);

    // Refresh list
    const r2 = await fetch(`/api/bonos?mes=${mesFiltro}`);
    const data2 = await r2.json();
    setBonos(Array.isArray(data2) ? data2 : []);
    onBonoPagado?.();
    setLoading(false);
  }

  const totalBonos = bonos.reduce((s, b) => s + Number(b.monto_bono), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="input max-w-[170px]"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
          />
          {bonos.length > 0 && (
            <span className="text-xs text-yellow-400 font-medium">
              Total bonos: {formatMoneda(totalBonos)}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-yellow-600 hover:bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          + Asignar bono
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Asignar bono</h3>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Empleado *</label>
              <select
                className="input"
                required
                value={form.empleado_id}
                onChange={(e) => setForm((f) => ({ ...f, empleado_id: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Mes *</label>
              <input
                type="month"
                className="input"
                required
                value={form.mes}
                onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Monto bono *</label>
              <input
                type="number"
                className="input"
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.monto_bono}
                onChange={(e) => setForm((f) => ({ ...f, monto_bono: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Descripción</label>
              <input
                type="text"
                className="input"
                placeholder="Motivo del bono…"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
            >
              {loading ? "Guardando…" : "Asignar"}
            </button>
          </div>
        </form>
      )}

      {bonos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-8 text-center text-sm text-gray-500">
          Sin bonos registrados para {mesFiltro}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Mes</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {bonos.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">
                    {b.empleado?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{b.mes}</td>
                  <td className="px-4 py-3 text-gray-400">{b.descripcion ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-semibold">
                    {formatMoneda(Number(b.monto_bono))}
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
