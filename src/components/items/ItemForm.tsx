"use client";

import { useState } from "react";
import type { Item, ItemInsert } from "@/types/items";
import { ITEM_CATEGORIAS } from "@/types/items";

type Categoria = (typeof ITEM_CATEGORIAS)[number];

interface ItemFormProps {
  item?: Item | null;
  onClose: (saved: boolean) => void;
}

export default function ItemForm({ item, onClose }: ItemFormProps) {
  const isEdit = !!item;

  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [categoria, setCategoria] = useState<Categoria>(item?.categoria ?? "general");
  const [unidad, setUnidad] = useState(item?.unidad ?? "unidad");
  const [esActivo, setEsActivo] = useState(item?.es_activo ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorias = ITEM_CATEGORIAS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: ItemInsert = {
      nombre,
      descripcion: descripcion || null,
      categoria,
      unidad,
      es_activo: esActivo,
    };

    try {
      const url = isEdit ? `/api/items/${item.id}` : "/api/items";
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
      className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          {isEdit ? "Editar item" : "Nuevo item"}
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

      <div>
        <label className="label">Nombre</label>
        <input
          required
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Categoría</label>
          <select
            className="input"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Unidad</label>
          <input
            required
            className="input"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            placeholder="unidad, hora, porción…"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="item_activo"
          type="checkbox"
          className="h-4 w-4 accent-indigo-500"
          checked={esActivo}
          onChange={(e) => setEsActivo(e.target.checked)}
        />
        <label htmlFor="item_activo" className="text-sm text-gray-300">
          Activo
        </label>
      </div>

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
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear item"}
        </button>
      </div>
    </form>
  );
}
