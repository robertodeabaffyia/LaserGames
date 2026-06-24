export const dynamic = "force-dynamic";

import EscapeConfigForm from "@/components/escapeRoom/EscapeConfigForm";

export default function EscapeConfiguracionPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Escape Room — Configuración</h1>
        <p className="text-sm text-gray-400 mt-1">
          Horario de reservas, duración del bloque, seña mínima y precios por persona.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <EscapeConfigForm />
      </div>
    </div>
  );
}
