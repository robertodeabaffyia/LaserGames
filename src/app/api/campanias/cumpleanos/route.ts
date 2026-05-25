import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRol, hasMinRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";
import { diasHastaCumple, formatFechaCumple } from "@/lib/cumpleanos";
import { renderTemplate, enviarWhatsApp, enviarEmail } from "@/lib/notificaciones";
import type { CampaniaEnviarBody, CampaniaTarget } from "@/types/notificaciones";

const ESTADOS_ACTIVOS = ["pendiente", "cotizacion", "confirmado", "en_curso"];

// ── GET /api/campanias/cumpleanos?dias=60 ─────────────────────────────────────
// Returns the list of targets: clients with children whose birthday falls
// within the next `dias` days (default 60).
// Each target is flagged with `tiene_evento_futuro` so the UI can pre-deselect
// those who already have a booking.

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const dias = Math.min(Math.max(Number(searchParams.get("dias") ?? "60"), 1), 365);

  // Fetch all hijos with their cliente info
  const { data: hijos, error } = await supabase
    .from("hijos")
    .select("id, nombre, fecha_nacimiento, cliente_id, clientes(id, nombre, telefono, email)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch future events to know which clients already have bookings
  const hoy = new Date();
  const { data: eventosActivos } = await supabase
    .from("eventos")
    .select("cliente_id")
    .in("estado", ESTADOS_ACTIVOS)
    .gte("fecha_evento", hoy.toISOString());

  const clientesConEvento = new Set(
    (eventosActivos ?? []).map((e: { cliente_id: string }) => e.cliente_id)
  );

  const targets: CampaniaTarget[] = [];

  for (const hijo of hijos ?? []) {
    if (!hijo.fecha_nacimiento) continue;

    const dias_hasta = diasHastaCumple(hijo.fecha_nacimiento, hoy);
    if (dias_hasta > dias) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = hijo.clientes as any;
    if (!cliente) continue;

    targets.push({
      hijo_id: hijo.id,
      hijo_nombre: hijo.nombre,
      fecha_nacimiento: hijo.fecha_nacimiento,
      dias_hasta_cumple: dias_hasta,
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      cliente_telefono: cliente.telefono ?? null,
      cliente_email: cliente.email ?? null,
      tiene_evento_futuro: clientesConEvento.has(cliente.id),
    });
  }

  // Sort by days until birthday (most urgent first)
  targets.sort((a, b) => a.dias_hasta_cumple - b.dias_hasta_cumple);

  return NextResponse.json({ targets, total: targets.length });
}

// ── POST /api/campanias/cumpleanos ────────────────────────────────────────────
// Sends the campaign to the selected hijo_ids.
// Requires supervisor+ role.

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse();

  let body: CampaniaEnviarBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hijo_ids, template, canal } = body;

  if (!Array.isArray(hijo_ids) || hijo_ids.length === 0) {
    return NextResponse.json({ error: "hijo_ids must be a non-empty array" }, { status: 400 });
  }
  if (typeof template !== "string" || template.trim() === "") {
    return NextResponse.json({ error: "template is required" }, { status: 400 });
  }
  if (!["email", "whatsapp", "ambos"].includes(canal)) {
    return NextResponse.json({ error: "canal must be email | whatsapp | ambos" }, { status: 400 });
  }

  // Fetch the selected hijos with their cliente info
  const { data: hijos, error: hijosError } = await supabase
    .from("hijos")
    .select("id, nombre, fecha_nacimiento, clientes(id, nombre, telefono, email)")
    .in("id", hijo_ids);

  if (hijosError) return NextResponse.json({ error: hijosError.message }, { status: 500 });

  const hoy = new Date();
  let enviados = 0;
  let omitidos = 0;
  const errores: string[] = [];

  for (const hijo of hijos ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = hijo.clientes as any;
    if (!cliente) { omitidos++; continue; }

    // Respect unsubscribe for this campaign type
    const { data: desuscrito } = await supabase
      .from("cliente_desuscripciones")
      .select("desuscrito")
      .eq("cliente_id", cliente.id)
      .eq("tipo_notificacion", "campania_cumpleanos")
      .maybeSingle();

    if (desuscrito?.desuscrito) { omitidos++; continue; }

    const dias_hasta = diasHastaCumple(hijo.fecha_nacimiento, hoy);
    const vars: Record<string, string> = {
      nombre_cliente:    cliente.nombre,
      nombre_hijo:       hijo.nombre,
      fecha_cumple:      formatFechaCumple(hijo.fecha_nacimiento, hoy),
      dias_hasta_cumple: String(dias_hasta),
    };
    const contenido = renderTemplate(template, vars);

    // Send WhatsApp
    if ((canal === "whatsapp" || canal === "ambos") && cliente.telefono) {
      const res = await enviarWhatsApp(cliente.telefono, contenido);
      await supabase.from("historial_notificaciones").insert({
        tipo_notificacion: "campania_cumpleanos",
        entidad_id: hijo.id,
        destinatario: cliente.telefono,
        canal: "whatsapp",
        contenido_enviado: contenido,
        status: res.ok ? "enviado" : "fallido",
        error_detalle: res.error ?? null,
      });
      if (res.ok) enviados++;
      else errores.push(`WA ${cliente.telefono}: ${res.error}`);
    }

    // Send Email
    if ((canal === "email" || canal === "ambos") && cliente.email) {
      const subject = `¡El cumpleaños de ${hijo.nombre} se acerca!`;
      const res = await enviarEmail(
        cliente.email,
        subject,
        contenido.replace(/\n/g, "<br>")
      );
      await supabase.from("historial_notificaciones").insert({
        tipo_notificacion: "campania_cumpleanos",
        entidad_id: hijo.id,
        destinatario: cliente.email,
        canal: "email",
        contenido_enviado: contenido,
        status: res.ok ? "enviado" : "fallido",
        error_detalle: res.error ?? null,
      });
      if (res.ok) enviados++;
      else errores.push(`Email ${cliente.email}: ${res.error}`);
    }

    // No contact info at all
    if (!cliente.telefono && !cliente.email) omitidos++;
  }

  return NextResponse.json({ enviados, omitidos, errores });
}
