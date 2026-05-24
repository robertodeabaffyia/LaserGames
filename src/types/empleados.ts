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

/** Used for creating or updating a registro (hora_salida optional for partial entry). */
export type RegistroHorasInsert = {
  empleado_id: string;
  fecha: string;
  hora_entrada: string;
  hora_salida?: string | null;
  notas?: string | null;
  /** IDs of eventos worked during this registro (writes to registros_horas_eventos). */
  evento_ids?: string[];
};

export type RegistroHorasUpdate = {
  hora_entrada?: string;
  hora_salida?: string | null;
  notas?: string | null;
  evento_ids?: string[];
};

/** One row in the day-view dashboard: an employee + their registro for a specific date. */
export interface RegistroHorasDia {
  empleado: Pick<Empleado, "id" | "nombre" | "rol" | "tarifa_horaria">;
  registro: RegistroHoras | null;
  evento_ids: string[];
}

/** Full response shape for GET /api/registros-horas?fecha=YYYY-MM-DD */
export interface DiaDashboard {
  filas: RegistroHorasDia[];
  eventos: Array<{ id: string; nombre_festejado: string; hora_evento: string }>;
}
