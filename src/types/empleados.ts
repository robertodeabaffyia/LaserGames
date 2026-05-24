export type EmpleadoRol = "administrador" | "supervisor" | "general";

/** Role stored in the `usuarios` table (auth/permissions layer). */
export type UsuarioRol = "admin" | "supervisor" | "general";

export const EMPLEADO_ROLES: EmpleadoRol[] = [
  "administrador",
  "supervisor",
  "general",
];

/**
 * Returns the subset of EMPLEADO_ROLES the current user is allowed to assign.
 * Admins can assign any role; supervisors and below cannot assign "administrador".
 */
export function getRolesDisponibles(currentUserRole: UsuarioRol): EmpleadoRol[] {
  if (currentUserRole === "admin") return EMPLEADO_ROLES;
  return EMPLEADO_ROLES.filter((r) => r !== "administrador");
}

export interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  rol: EmpleadoRol;
  tarifa_horaria: number | null;
  fecha_contratacion: string | null; // YYYY-MM-DD
  es_activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistroHoras {
  id: string;
  empleado_id: string;
  fecha: string; // YYYY-MM-DD
  hora_entrada: string; // HH:MM
  hora_salida: string; // HH:MM
  horas_trabajadas: number;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
}

export interface RegistroHorasConEmpleado extends RegistroHoras {
  empleado: { id: string; nombre: string; rol: EmpleadoRol; tarifa_horaria: number | null };
}

export interface ResumenHorasEmpleado {
  empleado_id: string;
  nombre: string;
  rol: EmpleadoRol;
  total_horas: number;
  total_dias: number;
  total_costo: number;
}

export type EmpleadoInsert = Omit<Empleado, "id" | "created_at" | "updated_at">;
export type EmpleadoUpdate = Partial<EmpleadoInsert>;

export type RegistroHorasInsert = {
  empleado_id: string;
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
  notas?: string | null;
};
