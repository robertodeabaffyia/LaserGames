import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRol, hasMinRole, forbiddenResponse } from "@/lib/auth-helpers";
import type { PagoUpdate } from "@/types/pagos";
import { recalcularEstadoEvento } from "@/lib/pagos";

type Params = { params: Promise<{ id: string }> };

const FORBIDDEN_MSG =
  "Solo supervisores o administradores pueden modificar pagos registrados";

// ── PUT /api/pagos/[id] ───────────────────────────────────────────────────────
// Allows editing: notas, quien_recibio, fecha_pago, monto, metodo.
// If monto changes, monto_final is recomputed from existing discount settings.
// evento.estado is always recalculated after any successful update.

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  let body: PagoUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Fetch existing pago ───────────────────────────────────────────────────

  const { data: existing, error: fetchError } = await supabase
    .from("pagos")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  // ── Build update payload ──────────────────────────────────────────────────

  const updates: Record<string, unknown> = {};

  if (body.notas !== undefined) updates.notas = body.notas;
  if (body.quien_recibio !== undefined) updates.quien_recibio = body.quien_recibio;
  if (body.fecha_pago !== undefined) updates.fecha_pago = body.fecha_pago;
  if (body.metodo !== undefined) updates.metodo = body.metodo;

  // recargo_pct can only be changed by an admin
  if (body.recargo_pct !== undefined) {
    if (!hasMinRole(rol, "admin")) {
      return forbiddenResponse("Solo administradores pueden modificar el recargo");
    }
    if (typeof body.recargo_pct !== "number" || body.recargo_pct < 0) {
      return NextResponse.json(
        { error: "recargo_pct must be a non-negative number" },
        { status: 400 }
      );
    }
    updates.recargo_pct = body.recargo_pct;
  }

  if (body.monto !== undefined) {
    if (body.monto <= 0) {
      return NextResponse.json({ error: "monto must be > 0" }, { status: 400 });
    }
    updates.monto = body.monto;

    // Recompute monto_final if discount exists
    if (existing.tiene_descuento && existing.tipo_descuento && existing.valor_descuento) {
      const descuento =
        existing.tipo_descuento === "porcentaje"
          ? body.monto * (existing.valor_descuento / 100)
          : existing.valor_descuento;
      const newFinal = body.monto - descuento;
      if (newFinal <= 0) {
        return NextResponse.json(
          { error: "monto_final must be > 0 after applying the existing discount" },
          { status: 400 }
        );
      }
      updates.monto_final = newFinal;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  // ── Persist update ────────────────────────────────────────────────────────

  const { data: updated, error: updateError } = await supabase
    .from("pagos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    const status = updateError.code === "PGRST116" ? 404 : 400;
    return NextResponse.json({ error: updateError.message }, { status });
  }

  // ── Recalculate evento estado ─────────────────────────────────────────────

  await recalcularEstadoEvento(supabase, existing.evento_id, user.id);

  // ── Sync movimiento_caja when cash-relevant fields change ─────────────────
  // 0-row updates (old rows without pago_id) are not treated as errors.

  const movUpdates: Record<string, unknown> = {};
  if ("monto" in updates) {
    movUpdates.monto =
      (updates.monto_final as number | undefined) ?? (updates.monto as number);
  }
  if ("fecha_pago" in updates) {
    movUpdates.fecha = (updates.fecha_pago as string).slice(0, 10);
  }
  if (Object.keys(movUpdates).length > 0) {
    const { error: movUpdateErr } = await supabase
      .from("movimientos_caja")
      .update(movUpdates)
      .eq("pago_id", id);
    if (movUpdateErr) {
      console.error("movimiento_caja sync failed for pago", id, movUpdateErr.message);
    }
  }

  return NextResponse.json(updated);
}

// ── DELETE /api/pagos/[id] ────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  // Verify pago exists before deleting
  const { data: pago, error: fetchError } = await supabase
    .from("pagos")
    .select("id, evento_id")
    .eq("id", id)
    .single();

  if (fetchError || !pago) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  // ── Delete paired movimiento_caja first (exact match by pago_id) ──────────
  // No-op for old rows that predate the pago_id migration (0 rows deleted = OK).

  const { error: movErr } = await supabase
    .from("movimientos_caja")
    .delete()
    .eq("pago_id", id);

  if (movErr) {
    return NextResponse.json(
      { error: "Error al eliminar movimiento de caja" },
      { status: 500 }
    );
  }

  // ── Delete pago ───────────────────────────────────────────────────────────

  const { error } = await supabase.from("pagos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recalcularEstadoEvento(supabase, pago.evento_id, user.id);

  return new NextResponse(null, { status: 204 });
}
