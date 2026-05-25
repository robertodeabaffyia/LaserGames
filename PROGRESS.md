# EventOS - Laser Games
## Estado del Proyecto: 651/651 tests pasando

### Stack
- Frontend: Next.js 15, React, TypeScript, Tailwind CSS
- Backend: Next.js API Routes, Node.js
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- External: Resend (email), Vonage (WhatsApp), jsPDF, SheetJS

### Repositorio
- Local: C:\Users\rabaffy\ClaudeCodeRepo\LaserGames
- Supabase: https://nyxpygxkduxllyzvcumm.supabase.co
- Master branch: 645/645 tests passing

### Features Implementadas ✅

1. **Autenticación + Roles** (admin/supervisor/general) — Supabase Auth, login/signup pages, middleware edge-level
2. **Configuración global** — monto seña, precios adicionales (niño/adulto), recargos por tarjeta/cuotas, `notificaciones_config`
3. **Paquetes + Items** — CRUD fusionado en tabs en `/dashboard/paquetes`; `cantidad_ninos_incluidos`, `cantidad_adultos_incluidos`, duración (horas + minutos), `PackageCard`, `PackageForm`, `DurationInput`
4. **Eventos CRUD** — asignación de paquete, fecha + hora separados (timezone-safe), cálculo automático de precio, estado lifecycle (`cotizacion → confirmado → en_curso → completado`), conflicto de horario (`hayConflicto`)
5. **Evento Detail Page** — tabs "Información" / "Pagos", historial de pagos integrado, modal para agregar pago
6. **Clientes / CRM** — CRUD, hijos (nombre, edad, colegio), historial de eventos por cliente
7. **Pagos** — registro por evento, métodos (efectivo/transferencia/tarjeta), seña, descuentos (porcentaje/monto fijo), recargo por tarjeta/cuotas, `monto_final`, auditoría (`pagos_auditoria`), auto-update estado evento
8. **Empleados** — CRUD con roles (admin/supervisor/general), registro de horas, reporte individual y global, cálculo de salario/nominación
9. **Registro de Horas v2** — tabla inline día-a-día con navegación por fecha, vinculación a eventos (junction table `registros_horas_eventos`), soporte de entrada parcial (hora_salida nullable)
10. **Caja / Cash Flow** — `movimientos_caja` (ingresos/egresos), auto-ingreso al registrar pago, categorías, resumen dashboard
11. **Bonos** — CRUD de bonos para empleados
12. **Dashboard** — resumen de cumpleaños próximos, eventos pendientes, resumen de pagos
13. **Reportes** — PDF/Excel export (`/api/reportes/[tipo]`), restringido a admins
14. **Notificaciones** — configuración por evento, historial, cron de recordatorio y confirmación
15. **Desuscripciones** — opt-out de notificaciones por cliente
16. **Security Hardening** — middleware edge-level, auth guards en todas las rutas, role checks, RLS, ILIKE escaping (ver sección abajo)

### Security Hardening ✅

- **`src/middleware.ts`** — protege `/dashboard/*`, `/admin/*`, `/api/*` a nivel edge; retorna 401 para API no autenticadas, redirige a `/login` para páginas
- **`src/lib/auth-helpers.ts`** — `getUserRol`, `hasMinRole`, `unauthorizedResponse`, `forbiddenResponse`; sistema de pesos `admin(3) > supervisor(2) > general(1)`
- **Auth guards** — `getUser()` + 401 añadido a TODAS las rutas API previamente desprotegidas
- **Role checks**:
  - Admin-only: `PUT /api/empleados/[id]` (cuando cambia `rol`), `GET /api/reportes/[tipo]`
  - Supervisor+: `GET/POST /api/bonos`, `GET/POST/DELETE /api/movimientos-caja`, `POST /api/salarios/procesar-nomina`, `GET/POST/PUT/DELETE /api/notificaciones-config`, `POST /api/registros-horas`
- **RLS** — habilitado en `registros_horas_eventos` (estaba sin RLS)
- **ILIKE metacharacters** — `%`, `_`, `\` escapados en búsquedas de clientes y empleados
- **Migrations**:
  - `usuarios_rol_check` — constraint corregido de `('admin','staff')` → `('admin','supervisor','general')`
  - `hora_salida` nullable — permite entradas parciales; `horas_trabajadas CHECK >= 0`

### Migraciones Supabase (16)
| # | Descripción |
|---|---|
| 001 | Schema inicial (paquetes, eventos, clientes, pagos) |
| 002 | Hijos de clientes |
| 003 | Extensión de eventos (estado, notas, invitados) |
| 004 | Configuración de pagos (seña, recargos tarjeta) |
| 005 | Extensión de empleados (salario, tipo) |
| 006 | Hijos con colegio |
| 007 | Movimientos de caja |
| 008 | Notificaciones |
| 009 | Descuentos en pagos |
| 010 | Mejoras eventos (duracion_minutos, num_invitados) |
| 011 | Auditoría de pagos |
| 012 | Refactor invitados (ninos/adultos incluidos + precios adicionales) |
| 013 | Simplify paquetes (drop max columns) |
| 014 | RLS en registros_horas_eventos |
| 015 | Fix usuarios_rol_check constraint (admin/supervisor/general) |
| 016 | registros_horas.hora_salida nullable + horas_trabajadas >= 0 |

### Utilidades Lib
| Archivo | Exports |
|---|---|
| `src/lib/duration.ts` | `formatDuration`, `parseHoras`, `parseMinutos`, `trimLeadingZeros`, `MAX_HORAS`, `MAX_MINUTOS` |
| `src/lib/eventos.ts` | `calcularPrecioTotal`, `fechaEventoToISO`, `combineFechaHora`, `eventoFechaToLocal`, `hayConflicto` |
| `src/lib/auth-helpers.ts` | `getUserRol`, `hasMinRole`, `unauthorizedResponse`, `forbiddenResponse`, `UsuarioRol` |

### API Endpoints
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET/POST | `/api/paquetes` | ✅ | Lista / crea paquetes |
| GET/PUT/DELETE | `/api/paquetes/[id]` | ✅ | Paquete individual |
| GET/POST | `/api/eventos` | ✅ | Lista / crea eventos |
| GET/PUT/DELETE | `/api/eventos/[id]` | ✅ | Evento individual (admin para completado/cancelado) |
| GET/POST | `/api/clientes` | ✅ | Lista / crea clientes |
| GET/PUT/DELETE | `/api/clientes/[id]` | ✅ | Cliente individual |
| GET/POST | `/api/hijos` | ✅ | Lista / crea hijos |
| GET/PUT/DELETE | `/api/hijos/[id]` | ✅ | Hijo individual |
| GET/POST | `/api/pagos` | ✅ | Lista (filtro `?evento_id`) / crea pago |
| GET/PUT/DELETE | `/api/pagos/[id]` | ✅ | Pago individual |
| GET | `/api/pagos/[id]/auditoria` | ✅ | Historial de cambios de pago |
| GET/PUT | `/api/configuracion` | ✅ | Configuración global del usuario |
| GET/POST | `/api/empleados` | ✅ | Lista / crea empleados |
| GET/PUT/DELETE | `/api/empleados/[id]` | ✅ | Empleado individual (admin para cambio de rol) |
| GET | `/api/empleados/reporte` | ✅ | Reporte global de empleados |
| GET | `/api/empleados/[id]/reporte` | ✅ | Reporte individual |
| GET/POST | `/api/registros-horas` | ✅ | Horas trabajadas (POST requiere supervisor+) |
| GET/PUT/DELETE | `/api/registros-horas/[id]` | ✅ | Registro individual |
| POST | `/api/salarios/procesar-nomina` | ✅ supervisor+ | Procesa nómina del período |
| GET/POST | `/api/movimientos-caja` | ✅ supervisor+ | Movimientos de caja |
| GET/PUT/DELETE | `/api/movimientos-caja/[id]` | ✅ supervisor+ | Movimiento individual |
| GET/POST | `/api/items` | ✅ | Ítems del negocio |
| GET/PUT/DELETE | `/api/items/[id]` | ✅ | Ítem individual |
| GET/POST | `/api/bonos` | ✅ supervisor+ | Bonos de empleados |
| GET/POST | `/api/notificaciones-config` | ✅ supervisor+ | Config de notificaciones |
| GET/PUT/DELETE | `/api/notificaciones-config/[id]` | ✅ supervisor+ | Config individual |
| GET | `/api/historial-notificaciones` | ✅ | Log de notificaciones enviadas |
| POST | `/api/desuscripciones` | público | Opt-out de cliente |
| GET | `/api/reportes/[tipo]` | ✅ admin | Exporta reporte PDF/Excel |
| GET | `/api/dashboard/cumpleanos` | ✅ | Cumpleaños próximos |
| GET | `/api/dashboard/eventos-pendientes` | ✅ | Eventos sin confirmar |
| GET | `/api/dashboard/pagos-resumen` | ✅ | Resumen financiero |
| POST | `/api/cron/confirmacion-evento` | cron | Confirma eventos con seña |
| POST | `/api/cron/evento-recordatorio` | cron | Recordatorio de evento |
| POST | `/api/cron/cumpleanos` | cron | Felicitaciones de cumpleaños |

### Issues Conocidos
- **Pagos no visible en EventDetailPage** — La sección de pagos no aparece en la página de detalle de evento (CRÍTICO, bloqueante para el flujo de cobro)
- **Formato fecha dd/mm/yyyy** — Pendiente implementación consistente en toda la UI (actualmente muestra ISO o formato en inglés en algunos componentes)
- **EmpleadoForm UI** — API corregida (admin requerido para cambiar `rol`), pero el formulario UI no oculta la opción de cambiar rol a usuarios no-admin

### Pendiente / Próximas Features (prioridad)
1. **Pagos en EventDetailPage** _(CRÍTICO — bloqueante)_ — Investigar por qué no renderiza la sección de pagos
2. **Formato fecha dd/mm/yyyy** — Implementar helper de formateo y aplicar en todos los componentes de UI
3. **EmpleadoForm UI** — Ocultar/deshabilitar campo `rol` para usuarios no-admin (ya protegido en API)
4. **Feature PROMOCIONES** — CRUD de promociones y campañas de descuento
5. **Rate limiting** — Añadir limitación de tasa a endpoints públicos y de autenticación _(backlog)_

### Fixes Recientes (feature/precio-adicionales-config)
- **EventoForm precio sync** — Fix: edit mode ya no sobreescribe precios de config con precios obsoletos almacenados en el evento; siempre usa los precios actuales de `/api/configuracion`
- **3 nuevos tests** en `EventoForm.test.tsx`: new mode carga config prices, edit mode ignora stale prices, breakdown muestra precio correcto
