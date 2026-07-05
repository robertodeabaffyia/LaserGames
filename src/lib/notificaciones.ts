import { Resend } from "resend";
import { Vonage } from "@vonage/server-sdk";
import { WhatsAppText } from "@vonage/messages";
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
 * Send a WhatsApp message via Vonage Messages API.
 * `to` should be an E.164 phone number, e.g. "+5491112345678".
 *
 * VONAGE_API_HOST is an optional override used to point at the Messages API
 * Sandbox (https://messages-sandbox.nexmo.com) during testing — the SDK
 * defaults to the production host otherwise, so leaving this unset never
 * changes existing production behavior.
 */
export async function enviarWhatsApp(
  to: string,
  message: string
): Promise<EnvioResult> {
  try {
    const apiHost = process.env.VONAGE_API_HOST;
    const vonage = new Vonage(
      {
        apiKey: process.env.VONAGE_API_KEY ?? "",
        apiSecret: process.env.VONAGE_API_SECRET ?? "",
      },
      apiHost ? { apiHost } : undefined
    );
    const from = process.env.VONAGE_WHATSAPP_FROM ?? "14157386170";
    await vonage.messages.send(
      new WhatsAppText({ to, from, text: message })
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error sending WhatsApp",
    };
  }
}
