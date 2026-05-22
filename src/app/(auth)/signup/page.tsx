import Image from "next/image";
import Link from "next/link";
import { signUp } from "@/app/auth/actions";

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

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
      <h1 className="text-2xl font-bold text-white mb-2">Crear cuenta</h1>
      <p className="text-gray-400 text-sm mb-8">Regístrate en Laser Games</p>

      {params.error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {params.error}
        </div>
      )}

      <form action={signUp} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="tu@correo.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          Crear cuenta
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
