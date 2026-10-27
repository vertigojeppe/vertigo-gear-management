# Modules

One folder per domain. Every module has the same layout:

```
src/modules/<name>/
  index.ts        public interface for server code (services, queries, schemas, logic); no components
  schema.ts       zod schemas (form validation, REST bodies, OpenAPI)
  service.ts      business logic; takes the db and an actor, returns plain data
  actions.ts      "use server" actions: auth check → service call → revalidate
  queries.ts      read models for pages (joins shaped for the UI)
  components/     React components owned by this module
  __tests__/      vitest tests (unit + integration against the dev database)
```

Rules:

- Pages in `src/app/` compose modules. They contain no business logic.
- Modules never import another module's internals. Import from
  `@/modules/<name>` (its `index.ts`), `@/modules/<name>/actions`, or one
  component file, `@/modules/<name>/components/<file>`. ESLint enforces this.
- The barrel never re-exports components. Next ships every client component
  the server code can reach, so a page that only needs a query would carry
  the module's dialogs too. Pages import each component from its file.
- Client components (`"use client"`) import server actions from
  `@/modules/<name>/actions`, never from the barrel: the barrel also exports
  services that touch the database and the browser bundle cannot load them.
- Prisma models for a module live in `prisma/models/<name>.prisma`.
- Every mutation goes through a service function that receives the actor,
  so permission checks and activity logging happen in one place.

Modules: `users`, `inventory`, `projects`, `rentals`, `packing`, `plans`,
`files`, `calendar`.
