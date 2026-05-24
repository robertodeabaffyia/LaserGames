import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import { validarHorario, calcularHorasTrabajadas } from "@/lib/registros-horas";
import type { RegistroHorasUpdate } from "@/types/empleados";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  let body: RegistroHorasUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Verify registro exists
  const { data: existing, error: fetchErr } = await supabase
    .from("registros_horas")
    .select("id, hora_entrada, hora_salida")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Registro not found" }, { status: 404 });
  }

  const hora_entrada = body.hora_entrada ?? existing.hora_entrada;
  const hora_salida = body.hora_salida !== undefined ? body.hora_salida : existing.hora_salida;

  // Validate hora_salida when both are present
  if (hora_salida && !validarHorario(hora_entrada, hora_salida)) {
    return NextResponse.json(
      { error: "hora_salida debe ser posterior a hora_entrada" },
      { status: 422 }
    );
  }

  const horas_trabajadas =
    hora_salida ? calcularHorasTrabajadas(hora_entrada, hora_salida) : 0;

  const updatePayload: Record<string, unknown> = { hora_entrada, hora_salida, horas_trabajadas };
  if (body.notas !== undefined) updatePayload.notas = body.notas;

  const { data: updated, error: updateErr } = await supabase
    .from("registros_horas")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // Sync evento links when evento_ids is explicitly provided
  if (body.evento_ids !== undefined) {
    await supabase.from("registros_horas_eventos").delete().eq("registro_id", id);

    if (body.evento_ids.length > 0) {
      const links = body.evento_ids.map((eid) => ({
        registro_id: id,
        evento_id: eid,
      }));
      const { error: linkErr } = await supabase
        .from("registros_horas_eventos")
        .insert(links);
      if (linkErr) {
        console.error("[registros-horas PUT] Failed to sync eventos:", linkErr.message);
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  // Verify exists first
  const { data: registro, error: fetchError } = await supabase
    .from("registros_horas")
    .select("id")
    .eq("id", id)
    .single();

  if (fetchError || !registro) {
    return NextResponse.json({ error: "Registro not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("registros_horas")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
