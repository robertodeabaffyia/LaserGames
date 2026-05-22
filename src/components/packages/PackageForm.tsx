"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/types/items";
import type { PaqueteWithItems, ItemInput } from "@/types/paquetes";

interface PackageFormProps {
  paquete?: PaqueteWithItems | null;
  onClose: (saved: boolean) => void;
}

interface FormState {
  nombre: string;
  descripcion: string;
  precio: string;
  duracion_horas: string;
  cantidad_ninos_max: string;
  cantidad_adultos_max: string;
  es_activo: boolean;
}

interface SelectedItem {
  item_id: string;
  cantidad: number;
}

export default function PackageForm({ paquete, onClose }: PackageFormProps) {
  const isEdit = !!paquete;

  const [form, setForm] = useState<FormState>({
    nombre: paquete?.nombre ?? "",
    descripcion: paquete?.descripcion ?? "",
    precio: paquete?.precio?.toString() ?? "",
    duracion_horas: paquete?.duracion_horas?.toString() ?? "2",
    cantidad_ninos_max: paquete?.cantidad_ninos_max?.toString() ?? "20",
    cantidad_adultos_max: paquete?.cantidad_adultos_max?.toString() ?? "5",
    es_activo: paquete?.es_activo ?? true,
  });

  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(
    paquete?.paquete_items.map((pi) => ({
      item_id: pi.item_id,
      cantidad: pi.cantidad,
    })) ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((data: Item[]) => setAvailableItems(data))
      .catch(() => setAvailableItems([]));
  }, []);

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => {
      const exists = prev.find((si) => si.item_id === itemId);
      if (exists) return prev.filter((si) => si.item_id !== itemId);
      return [...prev, { item_id: itemId, cantidad: 1 }];
    });
  }

  function updateCantidad(itemId: string, cantidad: number) {
    setSelectedItems((prev) =>
      prev.map((si) =>
        si.item_id === itemId ? { ...si, cantidad: Math.max(1, cantidad) } : si
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: parseFloat(form.precio),
      duracion_horas: parseInt(form.duracion_horas, 10),
      cantidad_ninos_max: parseInt(form.cantidad_ninos_max, 10),
      cantidad_adultos_max: parseInt(form.cantidad_adultos_max, 10),
      es_activo: form.es_activo,
      items: selectedItems satisfies ItemInput[],
    };

    try {
      const url = isEdit ? `/api/paquetes/${paquete.id}` : "/api/paquetes";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body: { error?: string } = await res.json();
        throw new Error(body.error ?? "Error al guardar");
      }

      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          {isEdit ? "Editar paquete" : "Nuevo paquete"}
        </h2>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="text-gray-500 hover:text-gray-300 text-xl leading-none"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nombre</label>
          <input
            required
            className="input"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>

        <div className="col-span-2">
          <label className="label">Descripción</label>
          <textarea
            rows={2}
            className="input resize-none"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Precio (MXN)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.precio}
            onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Duración (horas)</label>
          <input
            required
            type="number"
            min="1"
            className="input"
            value={form.duracion_horas}
            onChange={(e) => setForm((f) => ({ ...f, duracion_horas: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Máx. niños</label>
          <input
            required
            type="number"
            min="0"
            className="input"
            value={form.cantidad_ninos_max}
            onChange={(e) => setForm((f) => ({ ...f, cantidad_ninos_max: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Máx. adultos</label>
          <input
            required
            type="number"
            min="0"
            className="input"
            value={form.cantidad_adultos_max}
            onChange={(e) => setForm((f) => ({ ...f, cantidad_adultos_max: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2 self-end pb-1">
          <input
            id="es_activo"
            type="checkbox"
            className="h-4 w-4 accent-indigo-500"
            checked={form.es_activo}
            onChange={(e) => setForm((f) => ({ ...f, es_activo: e.target.checked }))}
          />
          <label htmlFor="es_activo" className="text-sm text-gray-300">
            Activo
          </label>
        </div>
      </div>

      {availableItems.length > 0 && (
        <div>
          <p className="label mb-2">Incluye items</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {availableItems.map((item) => {
              const selected = selectedItems.find((si) => si.item_id === item.id);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    className="h-4 w-4 accent-indigo-500"
                    checked={!!selected}
                    onChange={() => toggleItem(item.id)}
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className="flex-1 text-sm text-gray-300"
                  >
                    {item.nombre}
                    <span className="text-gray-500 ml-1 text-xs">
                      ({item.categoria})
                    </span>
                  </label>
                  {selected && (
                    <input
                      type="number"
                      min="1"
                      className="w-16 input py-1 text-center text-sm"
                      value={selected.cantidad}
                      onChange={(e) =>
                        updateCantidad(item.id, parseInt(e.target.value, 10))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex-1 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 py-2.5 text-sm transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear paquete"}
        </button>
      </div>
    </form>
  );
}
