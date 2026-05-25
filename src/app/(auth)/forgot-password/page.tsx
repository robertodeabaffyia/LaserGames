"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 shadow-xl text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-xl font-bold text-white mb-2">Revisá tu correo</h1>
        <p className="text-gray-400 text-sm mb-6">
          Te enviamos un link para resetear tu contraseña a <strong className="text-white">{email}</strong>.
        </p>
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 text-sm">
          ← Volver al login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-8 shadow-xl">
      <div className="flex justify-center mb-6">
        <Image
          src="/images/laser-games-logo.svg"
          alt="Laser Games"
          width={180}
          height={66}
          priority
        />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Recuperar contraseña</h1>
      <p className="text-gray-400 text-sm mb-8">
        Ingresá tu email y te mandamos un link para resetearla.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="tu@correo.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {loading ? "Enviando…" : "Enviar link de recuperación"}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-400">
          ← Volver al login
        </Link>
      </p>
    </div>
  );
}
