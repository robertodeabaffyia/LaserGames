import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, unauthorizedResponse } from "@/lib/auth-helpers";

/** GET — upcoming (today onward) non-cancelled escape reservations for the dashboard widget. */
export async function GET() {
  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("escape_reservas")
    .select(
      `id, fecha, hora_inicio, estado, cantidad_personas, precio_total,
       sala:salas_escape(nombre),
       contacto:escape_contactos(nombre, telefono)`
    )
    .not("estado", "eq", "cancelada")
    .gte("fecha", hoy)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    total: (data ?? []).length,
    reservas: data ?? [],
  });
}
