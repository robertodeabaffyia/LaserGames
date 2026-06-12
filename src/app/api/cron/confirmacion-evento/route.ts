import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate, enviarEmail, enviarWhatsApp } from "@/lib/notificaciones";
import { formatFechaMes } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";
import { authorizeCron } from "@/lib/cron-auth";

/**
 * POST /api/cron/confirmacion-evento
 * Finds recently-confirmed events that haven't been notified yet and sends confirmation.
 */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: config, error: configError } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("tipo", "confirmacion_evento")
    .eq("habilitada", true)
    .single();

  if (configError || !config) {
    return NextResponse.json({ mensaje: "Configuración deshabilitada o no encontrada", enviados: 0 });
  }

  // Find events with estado='confirmado' not yet notified
  const { data: eventos, error: evError } = await supabase
    .from("eventos")
    .select("id, nombre_festejado, fecha_evento, precio_total, cliente:clientes(id, nombre, email, telefono)")
    .eq("estado", "confirmado");

  if (evError) {
    return NextResponse.json({ error: evError.message }, { status: 500 });
  }

  let enviados = 0;
  const errores: string[] = [];

  for (const ev of eventos ?? []) {
    const cliente = (ev.cliente as unknown) as { id: string; nombre: string; email: string | null; telefono: string | null } | null;
    if (!cliente) continue;

    // Check already notified
    const { data: yaNotificado } = await supabase
      .from("historial_notificaciones")
      .select("id")
      .eq("tipo_notificacion", "confirmacion_evento")
      .eq("entidad_id", ev.id)
      .limit(1);

    if (yaNotificado && yaNotificado.length > 0) continue;

    // Check unsubscribe
    const { data: desuscrito } = await supabase
      .from("cliente_desuscripciones")
      .select("desuscrito")
      .eq("cliente_id", cliente.id)
      .eq("tipo_notificacion", "confirmacion_evento")
      .single();

    if (desuscrito?.desuscrito) continue;

    // Fetch total paid for this event
    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto")
      .eq("evento_id", ev.id);

    const totalPagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
    const saldoPendiente = Math.max(0, Number(ev.precio_total) - totalPagado);

    const fechaEvento = new Date(ev.fecha_evento);
    const vars: Record<string, string> = {
      nombre_cliente: cliente.nombre,
      nombre_festejado: ev.nombre_festejado,
      fecha_evento: formatFechaMes(fechaEvento),
      monto_pagado: formatMoneda(totalPagado),
      saldo_pendiente: formatMoneda(saldoPendiente),
    };

    const contenido = renderTemplate(config.contenido_template, vars);

    if ((config.canal === "email" || config.canal === "ambos") && cliente.email) {
      const result = await enviarEmail(cliente.email, config.descripcion, contenido.replace(/\n/g, "<br>"));
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "confirmacion_evento",
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

    if ((config.canal === "whatsapp" || config.canal === "ambos") && cliente.telefono) {
      const result = await enviarWhatsApp(cliente.telefono, contenido);
      await supabase.from("historial_notificaciones").insert({
        notificacion_config_id: config.id,
        tipo_notificacion: "confirmacion_evento",
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

  return NextResponse.json({ enviados, errores });
}
