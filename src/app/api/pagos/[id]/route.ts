import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PagoUpdate } from "@/types/pagos";
import type { TarjetaRecargos } from "@/types/configuracion";

type Params = { params: Promise<{ id: string }> };

// ── PUT /api/pagos/[id] ───────────────────────────────────────────────────────
// Allows editing: notas, quien_recibio, fecha_pago, monto, metodo.
// If monto changes, monto_final is recomputed from existing discount settings
// and the evento estado is re-evaluated.

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // ── Re-evaluate evento estado if monto changed ────────────────────────────

  if (body.monto !== undefined) {
    const { data: evento } = await supabase
      .from("eventos")
      .select("id, precio_total, estado")
      .eq("id", existing.evento_id)
      .single();

    const { data: allPagos } = await supabase
      .from("pagos")
      .select("monto, monto_final")
      .eq("evento_id", existing.evento_id);

    if (evento && allPagos) {
      const totalPagado = allPagos.reduce(
        (sum, p) => sum + Number((p as { monto_final?: number | null; monto: number }).monto_final ?? p.monto),
        0
      );

      const { data: configRaw } = await supabase
        .from("configuraciones")
        .select("monto_seña, tarjeta_recargos")
        .eq("usuario_id", user.id)
        .single();

      const config = configRaw as { monto_seña?: number; tarjeta_recargos?: TarjetaRecargos } | null;
      const montoSena = config?.monto_seña ?? 0;

      let nuevoEstado: string | null = null;
      if (totalPagado >= evento.precio_total) {
        nuevoEstado = "completado";
      } else if (montoSena > 0 && totalPagado >= montoSena) {
        nuevoEstado = "confirmado";
      }

      if (nuevoEstado && nuevoEstado !== evento.estado) {
        await supabase
          .from("eventos")
          .update({ estado: nuevoEstado })
          .eq("id", existing.evento_id);
      }
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

  // Verify pago exists before deleting
  const { data: pago, error: fetchError } = await supabase
    .from("pagos")
    .select("id, evento_id")
    .eq("id", id)
    .single();

  if (fetchError || !pago) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  const { error } = await supabase.from("pagos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
