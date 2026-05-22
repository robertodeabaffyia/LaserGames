import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/dashboard/clientes", label: "Clientes", icon: "👥" },
  { href: "/dashboard/paquetes", label: "Paquetes", icon: "📦" },
  { href: "/dashboard/eventos", label: "Eventos", icon: "🎉" },
  { href: "/dashboard/empleados", label: "Empleados", icon: "👤" },
  { href: "/dashboard/caja",      label: "Caja",     icon: "💰" },
  { href: "/dashboard/reportes",  label: "Reportes", icon: "📊" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="text-white font-bold text-lg leading-tight">EventOS</p>
          <p className="text-gray-500 text-xs mt-0.5">Laser Tag Arena</p>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
