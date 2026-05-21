import Link from "next/link";
import ClienteProfile from "@/components/clientes/ClienteProfile";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClienteProfilePage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/dashboard/clientes"
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Volver a clientes
      </Link>
      <ClienteProfile clienteId={id} />
    </div>
  );
}
