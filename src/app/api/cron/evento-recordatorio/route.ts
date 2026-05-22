import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate, enviarEmail, enviarWhatsApp } from "@/lib/notificaciones";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow all
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/cron/evento-recordatorio
 * Finds events happening in `dias_anticipacion` days and sends reminders.
 * Called by an external scheduler (e.g. Vercel Cron) with CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch active config
  const { data: config, error: configError } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("tipo", "evento_recordatorio")
    .eq("habilitada", true)
    .single();

  if (configError || !config) {
    return NextResponse.json({ mensaje: "Configuración deshabilitada o no encontrada", enviados: 0 });
  }

  // Compute target date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + config.dias_anticipacion);
  const targetStr = targetDate.toISOString().split("T")[0];

  // Fetch events on target date (excluding cancelled)
  const { data: eventos, error: evError } = await supabase
    .from("eventos")
    .select("id, nombre_festejado, fecha_evento, cliente:clientes(id, nombre, email, telefono), paquete:paquetes(nombre)")
    .gte("fecha_evento", `${targetStr}T00:00:00`)
    .lte("fecha_evento", `${targetStr}T23:59:59`)
    .neq("estado", "cancelado");

  if (evError) {
    return NextResponse.json({ error: evError.message }, { status: 500 });
  }

  let enviados = 0;
  const errores: string[] = [];

  for (const ev of eventos ?? []) {
    const cliente = ev.cliente as { id: string; nombre: string; email: string | null; telefono: string | null } | null;
    if (!cliente) continue;

    // Check if already notified for this event + tipo
    const { data: yaNotificado } = await supabase
      .from("historial_notificaciones")
      .select("id")
      .eq("tipo_notificacion", "evento_recordatorio")
      .eq("entidad_id", ev.id)
      .limit(1);

    if (yaNotificado && yaNotificado.length > 0) continue;

    // Check unsubscribe
    const { data: desuscrito } = await supabase
      .from("cliente_desuscripciones")
      .select("desuscrito")
      .eq("cliente_id", cliente.id)
      .eq("tipo_notificacion", "evento_recordatorio")
      .single();

    if (desuscrito?.desuscrito) continue;

    const fechaEvento = new Date(ev.fecha_evento);
    const vars: Record<string, string> = {
      nombre_cliente: cliente.nombre,
      nombre_festejado: ev.nombre_festejado,
      fecha_evento: fechaEvento.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
      hora_evento: fechaEvento.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      nombre_paquete: (ev.paquete as { nombre?: string } | null)?.nombre ?? "—",
    };

    const contenido = renderTemplate(config.contenido_template, vars);

    // Send email
    if ((config.canal === "email" || config.canal === "ambos") && cliente.email) {
      const result = await enviarEmail(cliente.email, config.descripcion, contenido.replace(/\n/g, "<br>"));
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "evento_recordatorio",
        entidad_id: ev.id,
        destinatario: cliente.email,
        canal: "email",
        contenido_enviado: contenido,
        status: result.ok ? "enviado" : "fallido",
        error_detalle: result.error ?? null,
      });
      if (result.ok) enviados++;
      else errores.push(`Email ${cliente.email}: ${result.error}`);
    }

    // Send WhatsApp
    if ((config.canal === "whatsapp" || config.canal === "ambos") && cliente.telefono) {
      const result = await enviarWhatsApp(cliente.telefono, contenido);
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "evento_recordatorio",
        entidad_id: ev.id,
        destinatario: cliente.telefono,
        canal: "whatsapp",
        contenido_enviado: contenido,
        status: result.ok ? "enviado" : "fallido",
        error_detalle: result.error ?? null,
      });
      if (result.ok) enviados++;
      else errores.push(`WhatsApp ${cliente.telefono}: ${result.error}`);
    }
  }

  return NextResponse.json({ enviados, errores, fecha_objetivo: targetStr });
}
