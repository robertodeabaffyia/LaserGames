import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  diasHastaProximo,
  isEstasSemana,
  isProximoMes,
  sortByDias,
  type BirthdayEntry,
} from "@/lib/birthday";

export async function GET() {
  const supabase = await createClient();

  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, nombre, fecha_cumpleanos, hijos(id, nombre, fecha_nacimiento)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const esta_semana: BirthdayEntry[] = [];
  const proximo_mes: BirthdayEntry[] = [];

  for (const c of clientes ?? []) {
    // Client's own birthday
    if (c.fecha_cumpleanos) {
      const dias = diasHastaProximo(c.fecha_cumpleanos);
      const entry: BirthdayEntry = {
        id: c.id,
        nombre: c.nombre,
        fecha: c.fecha_cumpleanos,
        tipo: "cliente",
        cliente_id: c.id,
        dias_restantes: dias,
      };
      if (isEstasSemana(dias)) esta_semana.push(entry);
      else if (isProximoMes(c.fecha_cumpleanos, dias)) proximo_mes.push(entry);
    }

    // Children's birthdays
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
