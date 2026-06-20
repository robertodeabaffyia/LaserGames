/**
 * Birthday proximity helpers for dashboard widgets and the cumpleanos cron:
 * days-until-next-birthday math and week/month bucketing.
 */
export interface BirthdayEntry {
  id: string;
  nombre: string;
  fecha: string; // ISO date of birth/birthday
  tipo: "cliente" | "hijo";
  cliente_id: string;
  cliente_nombre?: string; // populated for children
  dias_restantes: number;
}

/**
 * Returns the number of days until the next occurrence of a birthday.
 * Returns 0 if today is the birthday.
 */
export function diasHastaProximo(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const parts = fecha.split("-").map(Number);
  const mes = parts[1] - 1; // 0-indexed
  const dia = parts[2];

  let proxCumple = new Date(hoy.getFullYear(), mes, dia);
  if (proxCumple < hoy) {
    proxCumple = new Date(hoy.getFullYear() + 1, mes, dia);
  }

  return Math.round((proxCumple.getTime() - hoy.getTime()) / 86_400_000);
}

/** True if birthday falls within the next 7 days (inclusive of today). */
export function isEstasSemana(diasRestantes: number): boolean {
  return diasRestantes >= 0 && diasRestantes <= 7;
}

/**
 * True if birthday's month matches the NEXT calendar month (and it is NOT
 * already within this week — this keeps the two buckets mutually exclusive).
 */
export function isProximoMes(fecha: string, diasRestantes: number): boolean {
  if (isEstasSemana(diasRestantes)) return false;

  const hoy = new Date();
  const nextMonthIndex = (hoy.getMonth() + 1) % 12;
  const mesNacimiento = parseInt(fecha.split("-")[1], 10) - 1; // 0-indexed

  return mesNacimiento === nextMonthIndex;
}

/** Sorts a list of birthday entries by days remaining, ascending. */
export function sortByDias(entries: BirthdayEntry[]): BirthdayEntry[] {
  return [...entries].sort((a, b) => a.dias_restantes - b.dias_restantes);
}

/**
 * Returns only clients that have at least one hijo whose birthday month
 * matches `mes` (1-12). Returns all clients unchanged when mes is "".
 */
export function filtrarClientesPorMesHijo<T extends { hijos: { fecha_nacimiento: string }[] }>(
  clientes: T[],
  mes: number | ""
): T[] {
  if (mes === "") return clientes;
  return clientes.filter((c) =>
    c.hijos.some((h) => parseInt(h.fecha_nacimiento.split("-")[1], 10) === mes)
  );
}

/**
 * Returns the children whose birthday month matches `mes` (1-12), formatted
 * as `{ nombre, dia }` where `dia` is "dd/mm". Returns [] when mes is "".
 */
export function hijosEnMes<T extends { fecha_nacimiento: string; nombre: string }>(
  hijos: T[],
  mes: number | ""
): { nombre: string; dia: string }[] {
  if (mes === "") return [];
  return hijos
    .filter((h) => parseInt(h.fecha_nacimiento.split("-")[1], 10) === mes)
    .map((h) => {
      const [, mm, dd] = h.fecha_nacimiento.split("-");
      return { nombre: h.nombre, dia: `${dd}/${mm}` };
    });
}
