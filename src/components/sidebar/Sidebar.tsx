"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard",           label: "Inicio",     icon: "🏠" },
  { href: "/dashboard/clientes",  label: "Clientes",   icon: "👥" },
  { href: "/dashboard/paquetes",  label: "Paquetes",   icon: "📦" },
  { href: "/dashboard/eventos",   label: "Eventos",    icon: "🎉" },
  { href: "/dashboard/empleados", label: "Empleados",  icon: "👤" },
  { href: "/dashboard/caja",      label: "Caja",       icon: "💰" },
  { href: "/dashboard/reportes",  label: "Reportes",   icon: "📊" },
];

const SUPERVISOR_NAV = [
  { href: "/dashboard/registros-horas",          label: "Registros de Horas", icon: "⏱️" },
  { href: "/dashboard/campanias/cumpleanos",      label: "Campaña Cumpleaños", icon: "🎂" },
];

const ADMIN_NAV = [
  { href: "/admin/configuracion",  label: "Configuración",  icon: "⚙️" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "🔔" },
];

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-gray-800 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-800"
      }`}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [userRol, setUserRol] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();
      setUserRol(data?.rol ?? "general");
    });
  }, []);

  const isAdmin = userRol === "admin";
  const isSupervisorOrAbove = userRol === "admin" || userRol === "supervisor";

  return (
    <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
      <div className="px-4 py-4 border-b border-gray-800">
        <Image
          src="/images/laser-games-logo.svg"
          alt="Laser Games"
          width={176}
          height={64}
          priority
          className="w-full h-auto"
        />
        <p className="text-gray-500 text-xs mt-1.5 px-1">Laser Tag Arena</p>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {isSupervisorOrAbove && SUPERVISOR_NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
