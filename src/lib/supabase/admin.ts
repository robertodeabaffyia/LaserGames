import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-to-server webhooks (WhatsApp
 * inbound, Mercado Pago notifications) that run without a user session.
 *
 * RLS policies in this project are `TO authenticated`, so the anon-key
 * client would be rejected on these routes; the service-role key bypasses
 * RLS. NEVER import this from client components or expose the key — it is
 * only safe inside API route handlers, and those routes must do their own
 * authorization (see src/lib/webhook-auth.ts).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
