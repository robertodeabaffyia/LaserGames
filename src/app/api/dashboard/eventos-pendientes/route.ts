import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eventos")
    .select(
      `id, fecha_evento, estado, nombre_festejado, precio_total,
       cliente:clientes(id, nombre, telefono),
       paquete:paquetes(nombre)`
    )
    .in("estado", ["cotizacion", "confirmado"])
    .order("fecha_evento", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    total: (data ?? []).length,
    eventos: data ?? [],
  });
}
