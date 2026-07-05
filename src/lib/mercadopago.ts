/**
 * Mercado Pago integration for the Escape Room seña (deposit) flow.
 *
 * Uses the REST API directly via fetch — no SDK dependency. The
 * notification webhook NEVER trusts the notification payload: it always
 * re-fetches the payment from the MP API by id before acting on it.
 *
 * Env: MP_ACCESS_TOKEN (required), APP_BASE_URL (public URL for the
 * notification webhook), WEBHOOK_SECRET (appended to notification_url).
 */

const MP_API = "https://api.mercadopago.com";

export type CrearLinkPagoResult =
  | { ok: true; preferenceId: string; initPoint: string }
  | { ok: false; error: string };

export interface CrearLinkPagoSenaParams {
  /** escape_reservas.id — round-trips as external_reference on the payment. */
  reservaId: string;
  /** Line item title shown in the MP checkout, e.g. "Seña Escape Room — El Conjuro 12/07 19:30". */
  titulo: string;
  monto: number;
}

/** Creates a Checkout Pro preference and returns its payment link. */
export async function crearLinkPagoSena(
  params: CrearLinkPagoSenaParams
): Promise<CrearLinkPagoResult> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, error: "MP_ACCESS_TOKEN no configurado" };

  const baseUrl = process.env.APP_BASE_URL ?? "";
  const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: params.titulo,
            quantity: 1,
            unit_price: params.monto,
            currency_id: "ARS",
          },
        ],
        external_reference: params.reservaId,
        ...(baseUrl && {
          notification_url: `${baseUrl}/api/mercadopago/webhook?token=${webhookSecret}`,
        }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `MP preferences ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json();
    return { ok: true, preferenceId: data.id, initPoint: data.init_point };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error creando preferencia MP" };
  }
}

export type ObtenerPagoResult =
  | { ok: true; status: string; externalReference: string | null }
  | { ok: false; error: string };

/** Fetches a payment by id — the authoritative source for webhook handling. */
export async function obtenerPago(paymentId: string): Promise<ObtenerPagoResult> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, error: "MP_ACCESS_TOKEN no configurado" };

  try {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return { ok: false, error: `MP payments ${res.status}` };
    }

    const data = await res.json();
    return {
      ok: true,
      status: data.status ?? "unknown",
      externalReference: data.external_reference ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error consultando pago MP" };
  }
}
