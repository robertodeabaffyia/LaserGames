"use client";

import { useEffect, useRef, useState } from "react";
import type { ClienteConHijos, Cliente } from "@/types/clientes";
import ClienteCard from "./ClienteCard";
import ClienteForm from "./ClienteForm";

export default function ClienteList() {
  const [clientes, setClientes] = useState<ClienteConHijos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchClientes(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/clientes${params}`);
      if (!res.ok) throw new Error("Error al cargar clientes");
      const data: ClienteConHijos[] = await res.json();
      setClientes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClientes();
  }, []);

  function handleSearch(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(value || undefined), 350);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cliente y todos sus datos?")) return;
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setClientes((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert("No se pudo eliminar el cliente.");
    }
  }

  function handleEdit(cliente: ClienteConHijos) {
    setEditing(cliente);
    setShowForm(true);
  }

  function handleNew() {
    setEditing(null);
    setShowForm(true);
  }

  function handleFormClose(saved: boolean) {
    setShowForm(false);
    setEditing(null);
    if (saved) fetchClientes(q || undefined);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-xl font-bold text-white">Clientes</h2>
        <div className="flex-1 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Buscar por nombre, teléfono o email…"
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button
            onClick={handleNew}
            className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 transition-colors"
          >
            + Nuevo
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando clientes…</p>}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && clientes.length === 0 && (
        <p className="text-sm text-gray-500">
          {q ? `Sin resultados para "${q}".` : "No hay clientes registrados."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clientes.map((c) => (
          <ClienteCard
            key={c.id}
            cliente={c}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <ClienteForm cliente={editing} onClose={handleFormClose} />
          </div>
        </div>
      )}
    </div>
  );
}
