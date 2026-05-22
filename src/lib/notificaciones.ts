import { Resend } from "resend";
import twilio from "twilio";
import type { EnvioResult } from "@/types/notificaciones";

/**
 * Replace {{variable}} placeholders in a template string.
 * Unknown variables are left as-is.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`
  );
}

/**
 * Send an email via Resend.
 */
export async function enviarEmail(
  to: string,
  subject: string,
  html: string
): Promise<EnvioResult> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.EMAIL_FROM ?? "EventOS <noreply@eventoslaser.com>";
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error sending email",
    };
  }
}

/**
 * Send a WhatsApp message via Twilio.
 * `to` should be an E.164 phone number, e.g. "+5491112345678".
 */
export async function enviarWhatsApp(
  to: string,
  message: string
): Promise<EnvioResult> {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const from =
      process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
    await client.messages.create({
      from,
      to: `whatsapp:${to}`,
      body: message,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error sending WhatsApp",
    };
  }
}
