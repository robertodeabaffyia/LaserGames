import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularPrecioTotal, hayConflicto } from "@/lib/eventos";
import { ADMIN_ONLY_ESTADOS, type EventoUpdate } from "@/types/eventos";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eventos")
    .select(
      `*,
      cliente:clientes(id, nombre, telefono, email),
      paquete:paquetes(id, nombre, precio, duracion_horas),
      pagos(id, monto, metodo, fecha_pago)`
    )
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  let body: EventoUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Admin-only estado guard
  if (body.estado && ADMIN_ONLY_ESTADOS.includes(body.estado)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!usuario || usuario.rol !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden cambiar a este estado" },
        { status: 403 }
      );
    }
  }

  // Fetch current evento (with paquete for base price)
  const { data: current, error: currentError } = await supabase
    .from("eventos")
    .select("*, paquete:paquetes(precio, duracion_horas)")
    .eq("id", id)
    .single();

  if (currentError) {
    const status = currentError.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: currentError.message }, { status });
  }

  // Re-validate overlap if fecha_evento is changing
  if (body.fecha_evento) {
    const { data: existingEventos } = await supabase
      .from("eventos")
      .select("id, fecha_evento, duracion_horas")
      .not("estado", "eq", "cancelado");

    if (
      hayConflicto(
        { fecha_evento: body.fecha_evento, duracion_horas: current.duracion_horas },
        existingEventos ?? [],
        id // exclude self
      )
    ) {
      return NextResponse.json(
        { error: "El horario se traslapa con otro evento existente" },
        { status: 409 }
      );
    }
  }

  // Recalculate precio_total if any pricing field is changing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { ...body };
  const pricingChanged =
    body.descuento !== undefined ||
    body.num_ninos_extra !== undefined ||
    body.num_adultos !== undefined ||
    body.precio_nino_extra !== undefined ||
    body.precio_adulto !== undefined;

  if (pricingChanged) {
    const paquete = current.paquete as { precio: number } | null;
    updates.precio_total = calcularPrecioTotal({
      precioPaquete: paquete?.precio ?? 0,
      numNinosExtra: body.num_ninos_extra ?? current.num_ninos_extra,
      precioNinoExtra: body.precio_nino_extra ?? current.precio_nino_extra,
      numAdultos: body.num_adultos ?? current.num_adultos,
      precioAdulto: body.precio_adulto ?? current.precio_adulto,
      descuento: body.descuento ?? current.descuento,
    });
  }

  const { data, error } = await supabase
    .from("eventos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("eventos").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
