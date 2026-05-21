import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Admin sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="text-white font-bold text-lg leading-tight">EventOS</p>
          <p className="text-amber-400 text-xs mt-0.5 font-medium">Administración</p>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          <Link
            href="/admin/configuracion"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span>⚙️</span>
            Configuración
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span>🏠</span>
            Ir al Dashboard
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
