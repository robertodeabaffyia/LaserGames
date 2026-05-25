export const dynamic = "force-dynamic";

import ConfiguracionForm from "@/components/configuracion/ConfiguracionForm";

export default function ConfiguracionPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configuración del sistema</h1>
        <p className="text-sm text-gray-400 mt-1">
          Establece la seña mínima y los recargos por tarjeta antes de operar.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <ConfiguracionForm />
      </div>
    </div>
  );
}
