import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, unauthorizedResponse } from "@/lib/auth-helpers";
import {
  diasHastaProximo,
  isEstasSemana,
  isProximoMes,
  sortByDias,
  type BirthdayEntry,
} from "@/lib/birthday";

export async function GET() {
  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, nombre, fecha_cumpleanos, hijos(id, nombre, fecha_nacimiento)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const esta_semana: BirthdayEntry[] = [];
  const proximo_mes: BirthdayEntry[] = [];

  for (const c of clientes ?? []) {
    for (const h of c.hijos ?? []) {
      const dias = diasHastaProximo(h.fecha_nacimiento);
      const entry: BirthdayEntry = {
        id: h.id,
        nombre: h.nombre,
        fecha: h.fecha_nacimiento,
        tipo: "hijo",
        cliente_id: c.id,
        cliente_nombre: c.nombre,
        dias_restantes: dias,
      };
      if (isEstasSemana(dias)) esta_semana.push(entry);
      else if (isProximoMes(h.fecha_nacimiento, dias)) proximo_mes.push(entry);
    }
  }

  return NextResponse.json({
    esta_semana: sortByDias(esta_semana),
    proximo_mes: sortByDias(proximo_mes),
  });
}
