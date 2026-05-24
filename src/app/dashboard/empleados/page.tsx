"use client";

import { useState, useEffect } from "react";
import EmpleadoForm from "@/components/empleados/EmpleadoForm";
import EmpleadoList from "@/components/empleados/EmpleadoList";
import ReporteHorasEmpleados from "@/components/empleados/ReporteHorasEmpleados";
import type { Empleado, UsuarioRol } from "@/types/empleados";
import { createClient } from "@/lib/supabase/client";

type Tab = "lista" | "reporte";

export default function EmpleadosPage() {
  const [tab, setTab] = useState<Tab>("lista");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserRole, setCurrentUserRole] = useState<UsuarioRol>("general");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();
      if (data?.rol) setCurrentUserRole(data.rol as UsuarioRol);
    });
  }, []);

  function handleSuccess() {
    setShowForm(false);
    setEditando(null);
    setRefreshKey((k) => k + 1);
  }

  function handleEdit(emp: Empleado) {
    setEditando(emp);
    setShowForm(true);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("¿Desactivar este empleado?")) return;
    await fetch(`/api/empleados/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Empleados</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestión de personal y horas trabajadas</p>
        </div>
        {!showForm && tab === "lista" && (
          <button
            onClick={() => { setEditando(null); setShowForm(true); }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Nuevo empleado
          </button>
        )}
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">
            {editando ? "Editar empleado" : "Nuevo empleado"}
          </h2>
          <EmpleadoForm
            empleado={editando ?? undefined}
            onSuccess={handleSuccess}
            onCancel={() => { setShowForm(false); setEditando(null); }}
            currentUserRole={currentUserRole}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {(["lista", "reporte"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "lista" ? "Lista" : "Reporte mensual"}
          </button>
        ))}
      </div>

      {tab === "lista" ? (
        <EmpleadoList
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          refreshKey={refreshKey}
        />
      ) : (
        <ReporteHorasEmpleados />
      )}
    </div>
  );
}
