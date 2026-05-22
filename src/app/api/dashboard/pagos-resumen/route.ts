import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_ESTADOS = ["pendiente", "cotizacion", "confirmado", "en_curso"];

/** GET — summary of payment status across active events */
export async function GET() {
  const supabase = await createClient();

  // Fetch active eventos with their pagos
  const { data: eventos, error } = await supabase
    .from("eventos")
    .select("id, precio_total, estado, nombre_festejado, fecha_evento, pagos(monto)")
    .in("estado", ACTIVE_ESTADOS)
    .order("fecha_evento", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (eventos ?? []).map((ev) => {
    const total_pagado = (ev.pagos ?? []).reduce(
      (sum: number, p: { monto: number }) => sum + Number(p.monto),
      0
    );
    const saldo_pendiente = Math.max(0, ev.precio_total - total_pagado);
    return {
      id: ev.id,
      nombre_festejado: ev.nombre_festejado,
      fecha_evento: ev.fecha_evento,
      estado: ev.estado,
      precio_total: ev.precio_total,
      total_pagado,
      saldo_pendiente,
    };
  });

  const totales = {
    total_eventos: items.length,
    total_precio: items.reduce((s, i) => s + i.precio_total, 0),
    total_pagado: items.reduce((s, i) => s + i.total_pagado, 0),
    total_pendiente: items.reduce((s, i) => s + i.saldo_pendiente, 0),
  };

  return NextResponse.json({ totales, eventos: items });
}
