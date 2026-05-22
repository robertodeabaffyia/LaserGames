import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/app/auth/actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
      <h1 className="text-2xl font-bold text-white mb-2">Bienvenido</h1>
      <p className="text-gray-400 text-sm mb-8">Inicia sesión en Laser Games</p>

      {params.error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {params.error}
        </div>
      )}

      {params.message && (
        <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          {params.message}
        </div>
      )}

      <form action={signIn} className="space-y-5">
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
            autoComplete="current-password"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          Iniciar sesión
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
