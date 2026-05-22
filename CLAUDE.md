@AGENTS.md

# CLAUDE.md

## Project
**EventOS** — Web app for managing children's birthday party events.
Laser tag arena business: packages, clients, payments, employees, 
cash flow, promotions, reports, and automated reminders.

## Core Principles
- ALWAYS follow SOLID design principles
- TypeScript strict mode, no `any` types
- Propose approach in 2-3 sentences before coding non-trivial features

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **State**: Zustand (client), Supabase Realtime (server)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Integrations**: Twilio (WhatsApp), Resend (Email)
- **Reports**: jsPDF, SheetJS (xlsx)

## Development Workflow
1. Create feature branch: `feature/[brief-description]`
2. Follow file organization strictly
3. Compile and verify before committing
4. Write clear commit messages with rationale
5. Commit to feature branch, never directly to main

## File Organization
- Components: `/src/components/[feature]/[ComponentName].tsx`
- Pages: `/src/app/[route]/page.tsx` (App Router)
- API: `/src/app/api/[resource]/route.ts`
- Utilities: `/src/lib/[category]/[utility].ts`
- Types: `/src/types/[domain].ts`
- Store: `/src/store/[domain]Store.ts`
- Supabase: `/src/lib/supabase/client.ts`

## Code Standards
- TypeScript for ALL code, strict checking
- Tailwind utilities only, custom CSS as last resort
- API routes follow RESTful conventions
- Supabase for all DB operations
- Components: small, single-responsibility

## Quality Gates (progressive)
- Phase 1: Code compiles clean. ESLint + Prettier pass.
- Phase 2+: Unit tests for business logic. Target 60%+ coverage.

## Build Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Format: `npx prettier --write .`

## Core Features
1. Packages (CRUD party packages)
2. Events (create, assign package, track status)
3. Clients/CRM (info, birthdays, history)
4. Payments (partial, reminders, status)
5. Employees (assign to events, track hours)
6. Cash Flow (income/expenses, profit)
7. Promotions (discounts, campaigns)
8. Alerts (payment reminders, birthday triggers)
9. Reports (PDF/Excel export)
10. Automations (WhatsApp/Email)
