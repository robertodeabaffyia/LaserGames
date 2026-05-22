"use client";

import { useEffect, useState } from "react";
import type { PaqueteWithItems } from "@/types/paquetes";
import PackageCard from "./PackageCard";
import PackageForm from "./PackageForm";

export default function PackageList() {
  const [paquetes, setPaquetes] = useState<PaqueteWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaqueteWithItems | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function fetchPaquetes() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/paquetes");
      if (!res.ok) throw new Error("Error al cargar paquetes");
      const data: PaqueteWithItems[] = await res.json();
      setPaquetes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPaquetes();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este paquete?")) return;
    const res = await fetch(`/api/paquetes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPaquetes((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert("No se pudo eliminar el paquete.");
    }
  }

  function handleEdit(paquete: PaqueteWithItems) {
    setEditing(paquete);
    setShowForm(true);
  }

  function handleNew() {
    setEditing(null);
    setShowForm(true);
  }

  function handleFormClose(saved: boolean) {
    setShowForm(false);
    setEditing(null);
    if (saved) fetchPaquetes();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Paquetes</h2>
        <button
          onClick={handleNew}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          + Nuevo paquete
        </button>
      </div>

      {loading && (
        <p className="text-gray-400 text-sm">Cargando paquetes…</p>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && paquetes.length === 0 && (
        <p className="text-gray-500 text-sm">
          No hay paquetes registrados. Crea el primero.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paquetes.map((p) => (
          <PackageCard
            key={p.id}
            paquete={p}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg">
            <PackageForm paquete={editing} onClose={handleFormClose} />
          </div>
        </div>
      )}
    </div>
  );
}
