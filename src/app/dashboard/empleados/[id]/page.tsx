"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import EmpleadoForm from "@/components/empleados/EmpleadoForm";
import EmpleadoPerfil from "@/components/empleados/EmpleadoPerfil";
import type { Empleado, RegistroHoras, UsuarioRol } from "@/types/empleados";
import { createClient } from "@/lib/supabase/client";

type EmpleadoConHoras = Empleado & { registros_horas: RegistroHoras[] };

const ROL_BADGE: Record<string, string> = {
  administrador: "text-amber-300",
  supervisor: "text-blue-300",
  general: "text-gray-400",
};

export default function EmpleadoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [empleado, setEmpleado] = useState<EmpleadoConHoras | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/empleados/${id}`);
    if (!res.ok) { router.push("/dashboard/empleados"); return; }
    setEmpleado(await res.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading || !empleado) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Cargando empleado…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
      >
        ← Empleados
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        {editMode ? (
          <>
            <h2 className="text-base font-semibold text-white mb-4">Editar empleado</h2>
            <EmpleadoForm
              empleado={empleado}
              onSuccess={() => { setEditMode(false); load(); }}
              onCancel={() => setEditMode(false)}
              currentUserRole={currentUserRole}
            />
          </>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{empleado.nombre}</h1>
              <p className={`text-sm font-medium capitalize mt-0.5 ${ROL_BADGE[empleado.rol] ?? "text-gray-400"}`}>
                {empleado.rol}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-400">
                {empleado.dni && <span>DNI: {empleado.dni}</span>}
                {empleado.telefono && <span>Tel: {empleado.telefono}</span>}
                {empleado.email && <span>{empleado.email}</span>}
                {empleado.tarifa_horaria != null && (
                  <span>Tarifa: ${empleado.tarifa_horaria}/h</span>
                )}
                {empleado.fecha_contratacion && (
                  <span>
                    Desde:{" "}
                    {new Date(empleado.fecha_contratacion).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium ${
                  empleado.es_activo ? "text-green-400" : "text-gray-500"
                }`}
              >
                {empleado.es_activo ? "Activo" : "Inactivo"}
              </span>
              <button
                onClick={() => setEditMode(true)}
                className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Perfil con historial */}
      {!editMode && (
        <EmpleadoPerfil empleado={empleado} onRefresh={load} />
      )}
    </div>
  );
}
