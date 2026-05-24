"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EmpleadoSelector from "@/components/registros-horas/EmpleadoSelector";
import HistorialRegistros from "@/components/registros-horas/HistorialRegistros";
import RegistroHorasForm from "@/components/empleados/RegistroHorasForm";
import type { Empleado, UsuarioRol } from "@/types/empleados";

export default function RegistrosHorasPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();
      const rol = (data?.rol ?? "general") as UsuarioRol;
      if (rol !== "admin" && rol !== "supervisor") {
        router.replace("/dashboard");
        return;
      }
      setAuthChecked(true);
    });
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Verificando permisos…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Registros de Horas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Consulta y gestión de horas trabajadas por empleado
          </p>
        </div>
        {selectedEmpleado && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Registrar horas
          </button>
        )}
      </div>

      {/* Selector */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Seleccionar empleado</h2>
        <EmpleadoSelector
          value={selectedEmpleado}
          onChange={(emp) => { setSelectedEmpleado(emp); setShowForm(false); }}
        />
      </div>

      {selectedEmpleado && (
        <>
          {/* Nuevo registro form */}
          {showForm && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300">Registrar horas</h2>
              <RegistroHorasForm
                empleadoId={selectedEmpleado.id}
                onSuccess={() => { setShowForm(false); setRefreshKey((k) => k + 1); }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {/* Historial */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">
              Historial — {selectedEmpleado.nombre}
            </h2>
            <HistorialRegistros
              key={`${selectedEmpleado.id}-${refreshKey}`}
              empleado={selectedEmpleado}
            />
          </div>
        </>
      )}
    </div>
  );
}
