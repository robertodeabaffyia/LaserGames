"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/types/items";
import ItemForm from "./ItemForm";

const CATEGORIA_LABELS: Record<string, string> = {
  actividad:   "Actividad",
  comida:      "Comida",
  bebida:      "Bebida",
  decoracion:  "Decoración",
  general:     "General",
};

export default function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Error al cargar items");
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este item?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      alert("No se pudo eliminar el item.");
    }
  }

  function handleFormClose(saved: boolean) {
    setShowForm(false);
    setEditing(null);
    if (saved) fetchItems();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Items</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          + Nuevo item
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Cargando items…</p>}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500 text-sm">No hay items registrados. Crea el primero.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{item.nombre}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {CATEGORIA_LABELS[item.categoria] ?? item.categoria}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{item.unidad}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {item.descripcion ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.es_activo
                        ? "bg-green-900/40 text-green-400 border border-green-800"
                        : "bg-gray-800 text-gray-500 border border-gray-700"
                    }`}>
                      {item.es_activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setEditing(item); setShowForm(true); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg">
            <ItemForm item={editing} onClose={handleFormClose} />
          </div>
        </div>
      )}
    </div>
  );
}
