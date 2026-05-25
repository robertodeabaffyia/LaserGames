import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate, enviarEmail, enviarWhatsApp } from "@/lib/notificaciones";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow all
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * POST /api/cron/solicitud-resena
 *
 * Finds events that completed `dias_anticipacion` days ago (based on fecha_evento)
 * and sends a review request via WhatsApp / email if:
 *   - A `notificaciones_config` row of type `solicitud_resena` is enabled
 *   - No review request was already sent for that event
 *   - The client hasn't unsubscribed from `solicitud_resena`
 *
 * The template supports:
 *   {{nombre_cliente}}, {{nombre_festejado}}, {{link_resena}}
 *
 * `link_resena` comes from `configuraciones.google_maps_url`.
 * If not configured, the placeholder stays as-is (harmless — admin should configure it).
 *
 * dias_anticipacion in notificaciones_config represents "days after the event".
 * Typical value: 2 (send 2 days after the party).
 */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // ── Load notification config ────────────────────────────────────────────────
  const { data: config, error: configError } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("tipo", "solicitud_resena")
    .eq("habilitada", true)
    .single();

  if (configError || !config) {
    return NextResponse.json({ mensaje: "Configuración deshabilitada o no encontrada", enviados: 0 });
  }

  // ── Load Google Maps URL from configuraciones ───────────────────────────────
  // We fetch any configuracion row (the app uses one per user/tenant).
  const { data: configuracion } = await supabase
    .from("configuraciones")
    .select("google_maps_url")
    .limit(1)
    .single();

  const googleMapsUrl = configuracion?.google_maps_url ?? "";

  // ── Target date: events whose fecha_evento was N days ago ───────────────────
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - config.dias_anticipacion);
  const targetStr = targetDate.toISOString().split("T")[0];

  const { data: eventos, error: evError } = await supabase
    .from("eventos")
    .select("id, nombre_festejado, fecha_evento, cliente:clientes(id, nombre, email, telefono)")
    .eq("estado", "completado")
    .gte("fecha_evento", `${targetStr}T00:00:00`)
    .lte("fecha_evento", `${targetStr}T23:59:59`);

  if (evError) {
    return NextResponse.json({ error: evError.message }, { status: 500 });
  }

  let enviados = 0;
  const errores: string[] = [];

  for (const ev of eventos ?? []) {
    const cliente = (ev.cliente as unknown) as {
      id: string;
      nombre: string;
      email: string | null;
      telefono: string | null;
    } | null;
    if (!cliente) continue;

    // Idempotency: skip if already sent for this event
    const { data: yaEnviado } = await supabase
      .from("historial_notificaciones")
      .select("id")
      .eq("tipo_notificacion", "solicitud_resena")
      .eq("entidad_id", ev.id)
      .limit(1);

    if (yaEnviado && yaEnviado.length > 0) continue;

    // Unsubscribe check
    const { data: desuscrito } = await supabase
      .from("cliente_desuscripciones")
      .select("desuscrito")
      .eq("cliente_id", cliente.id)
      .eq("tipo_notificacion", "solicitud_resena")
      .maybeSingle();

    if (desuscrito?.desuscrito) continue;

    const vars: Record<string, string> = {
      nombre_cliente:   cliente.nombre,
      nombre_festejado: ev.nombre_festejado,
      link_resena:      googleMapsUrl,
    };

    const contenido = renderTemplate(config.contenido_template, vars);

    // ── Send Email ────────────────────────────────────────────────────────────
    if ((config.canal === "email" || config.canal === "ambos") && cliente.email) {
      const res = await enviarEmail(
        cliente.email,
        config.descripcion,
        contenido.replace(/\n/g, "<br>")
      );
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "solicitud_resena",
        entidad_id: ev.id,
        destinatario: cliente.email,
        canal: "email",
        contenido_enviado: contenido,
        status: res.ok ? "enviado" : "fallido",
        error_detalle: res.error ?? null,
      });
      if (res.ok) enviados++;
      else errores.push(`Email ${cliente.email}: ${res.error}`);
    }

    // ── Send WhatsApp ─────────────────────────────────────────────────────────
    if ((config.canal === "whatsapp" || config.canal === "ambos") && cliente.telefono) {
      const res = await enviarWhatsApp(cliente.telefono, contenido);
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "solicitud_resena",
        entidad_id: ev.id,
        destinatario: cliente.telefono,
        canal: "whatsapp",
        contenido_enviado: contenido,
        status: res.ok ? "enviado" : "fallido",
        error_detalle: res.error ?? null,
      });
      if (res.ok) enviados++;
      else errores.push(`WhatsApp ${cliente.telefono}: ${res.error}`);
    }
  }

  return NextResponse.json({
    enviados,
    errores,
    fecha_objetivo: targetStr,
  });
}
