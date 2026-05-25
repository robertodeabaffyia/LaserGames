import CampaniaCumpleanos from "@/components/campanias/CampaniaCumpleanos";

export const metadata = { title: "Campaña cumpleaños — EventOS" };

export default function CampaniaCumpleanosPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Campaña cumpleaños próximos</h1>
        <p className="text-sm text-gray-400 mt-1">
          Identificá clientes con cumpleaños próximos que aún no tienen evento reservado y enviá un
          mensaje personalizado para ofrecerles una fecha.
        </p>
      </div>
      <CampaniaCumpleanos />
    </div>
  );
}
