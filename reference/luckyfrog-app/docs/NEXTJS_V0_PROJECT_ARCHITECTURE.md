# Next.js v0 Project Architecture

> Converted from `NEXTJS_V0_PROJECT_ARCHITECTURE.pdf`.  
> This is the canonical architecture reference for this project after migration.

---

## Purpose

This document defines the required architecture for all applications generated within this project. The architecture is designed specifically for:

- Next.js App Router
- v0 generated applications
- MongoDB with Mongoose
- Event-driven business logic
- AI-assisted development

The primary goal is to keep the codebase **maintainable**, **predictable**, **scalable**, easy to test, and easy for AI to generate consistently.

---

## Core Philosophy

This project does **NOT** use a Service Layer.

Instead, **Events represent application use-cases**:

- Register User
- Login User
- Create Product
- Create Order
- Cancel Order
- Upgrade Plan

Each business action lives inside an Event.

---

## Architecture Overview

```
Page
 ↓
Server Action / Route Handler
 ↓
Event
 ↓
Logic (optional)
 ↓
Repository
 ↓
Model
 ↓
MongoDB
```

**Worker runtime:**
```
Worker → Event → Repository → Model
```

**API runtime:**
```
API Server → Event → Repository → Model
```

All runtimes share the same application layer.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router, React, TypeScript |
| UI | TailwindCSS, shadcn/ui |
| Database | MongoDB, Mongoose |
| Testing | Vitest |
| Runtime | Node.js |

---

## Folder Structure

```
/app
├── api/
├── (dashboard)/
├── login/
├── register/
├── layout.tsx
└── page.tsx

/components
├── ui/
└── shared/

/lib
├── config/
│   ├── config.ts
│   └── database.ts
│
├── modules/
│   ├── players/
│   │   ├── model.server.ts
│   │   ├── repository.server.ts
│   │   ├── logic.ts
│   │   ├── types.ts
│   │   └── test.ts
│   │
│   ├── auth/
│   ├── quests/
│   ├── marketplace/
│   └── ...
│
├── events/
│   ├── login-player/
│   │   ├── action.ts
│   │   └── test.ts
│   │
│   ├── claim-username/
│   ├── start-quest/
│   └── ...
│
└── utils.ts

/server
├── worker/
│   ├── index.ts
│   ├── jobs/
│   └── scheduler/
│
└── aetheria-smart-contract/
    ├── index.ts
    ├── context.ts
    └── lib/
```

---

## Runtime Architecture

### Next.js Runtime

Responsibilities: Pages, Layouts, Components, Server Actions, Route Handlers.

```bash
# Dev
pnpm dev

# Production
pnpm start
```

### Worker Runtime

Used for: Background jobs, queue processing, scheduled tasks, data synchronization.

```bash
pnpm server:worker
```

### API / WebSocket Runtime

Used for: WebSocket servers, realtime game systems, long-running processes.

```bash
pnpm server:api
# or
pnpm server:start  # boots both worker + ws together
```

### Shared Application Layer

All runtimes use the same code. No runtime duplicates business logic.

```
Next.js  ──┐
Worker   ──┼──▶  /lib/config  /lib/modules  /lib/events
API      ──┘
```

---

## Configuration Layer

**Location:** `/lib/config`

### `config.ts`

- Loads and validates all environment variables
- Exports typed configuration object
- **Only `config.ts` may access `process.env`**

```ts
export const config = {
  mongoUri: process.env.MONGODB_URI!,
  jwtSecret: process.env.JWT_SECRET!,
  tokenContract: process.env.TOKEN_CONTRACT_ADDRESS!,
  tokenMinimum: Number(process.env.TOKEN_MINIMUM ?? 0),
};
```

### `database.ts`

- Manages Mongoose connection singleton
- Caches connections, prevents duplicates
- Must be imported by all repositories before queries

---

## Module Architecture

**Location:** `/lib/modules`

Each domain gets its own module folder.

### File Roles

| File | Purpose | Rules |
|---|---|---|
| `model.server.ts` | Mongoose schema + model | No queries, no logic |
| `repository.server.ts` | All DB reads/writes | Only layer that touches Mongoose |
| `logic.ts` | Pure business logic, calculations | No DB, no API calls, no side effects |
| `types.ts` | Interfaces, DTOs, input/output types | — |
| `test.ts` | Vitest tests | — |

### Repository Example

```ts
export async function findPlayerByWallet(wallet: string) {
  await connectDatabase();
  return PlayerModel.findOne({ wallet });
}
```

### Logic Example

```ts
export function calculateLevel(xp: number) {
  return Math.floor(xp / 100);
}
```

---

## Event Architecture

**Location:** `/lib/events`

Events are application use-cases. Each event folder contains:

```
/lib/events/login-player/
├── action.ts
└── test.ts
```

### `action.ts`

Coordinates repositories and modules to execute a workflow.

```ts
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";

export async function execute(input: LoginInput) {
  const player = await findPlayerByWallet(input.wallet);
  if (!player) return { status: "username-required" };
  // ... verify signature, issue JWT
  return { status: "ok", token, profile };
}
```

Rules:
- Calls repositories and logic functions only
- Never accesses models directly
- No `process.env` access — use `config`

---

## Server Action Rules

Server Actions must call Events. They must remain thin.

```ts
"use server";
import { execute } from "@/lib/events/login-player/action";

export async function loginAction(input: LoginInput) {
  return execute(input);
}
```

Rules:
- No business logic
- No database access
- No model access

---

## Route Handler Rules

Route Handlers must call Events.

```ts
// app/api/auth/login/route.ts
import { execute } from "@/lib/events/login-player/action";

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json(await execute(body));
}
```

Routes must remain thin.

---

## Worker Rules

```
Worker → Event → Repository → Model
```

Workers must call Events. Direct repository or model access from workers is **forbidden**.

---

## React Component Rules

- Default to **Server Components**
- Use `"use client"` only when required: forms, dialogs, browser APIs, WebSockets, interactive UI
- No database access in components
- No repository or model access in components

---

## Dependency Rules

| Allowed | Forbidden |
|---|---|
| Event → Repository | Component → Repository |
| Event → Logic | Component → Model |
| Repository → Model | Logic → Repository |
| Server Action → Event | Logic → Model |
| Route Handler → Event | Route → Repository |
| Worker → Event | Worker → Repository directly |

---

## Testing Standards

- Framework: **Vitest**
- Test: Events, Logic functions, Repositories (when needed)
- Every critical business workflow must have tests

---

## Package Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "server:worker": "tsx server/worker/index.ts",
    "server:api": "tsx server/aetheria-smart-contract/index.ts",
    "server:start": "tsx server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## AI Generation Rules

When generating code in this project:

1. Use App Router
2. Use TypeScript
3. Use TailwindCSS
4. Use shadcn/ui
5. Use MongoDB with Mongoose
6. Use Events as use-cases
7. **Do not** create `service.ts` files
8. **Do not** access MongoDB outside repositories
9. **Do not** access Mongoose models outside repositories
10. **Do not** access `process.env` outside `config.ts`
11. Keep Route Handlers thin
12. Keep Server Actions thin
13. Keep Workers thin
14. Use Vitest
15. Prefer Server Components
