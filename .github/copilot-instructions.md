----
description: 'Targeted instructions for AI agents working in ng-bills'
applyTo: '**/*'
---

# ng-bills – AI Agent Instructions

Focused guidance for contributing productively to ng-bills (Angular 21, Tailwind, Signals). Follow these project-specific conventions and workflows.

## Architecture & Routing
- App uses standalone components with lazy-loaded routes in [src/app/app.routes.ts](../src/app/app.routes.ts) (`/dashboard`, `/calendar`, `/manage`, `/sync`).
- Global providers configured in [src/app/app.config.ts](../src/app/app.config.ts) with `provideZonelessChangeDetection()` and `provideBrowserGlobalErrorListeners()`.
- Root shell is [src/app/app.component.ts](../src/app/app.component.ts) with reusable UI from [src/app/shared/components](../src/app/shared/components).
- Core services live in [src/app/core/services](../src/app/core/services) and are re-exported via the barrel [src/app/core/services/index.ts](../src/app/core/services/index.ts).

## State & Data Model
- Prefer Angular Signals for app/UI state. Example: `AppStateService` in [src/app/core/services/app-state.service.ts](../src/app/core/services/app-state.service.ts) exposes `viewDate`, `multiProfileMode`, and modal state via `signal()`/`computed()`.
- Domain types are defined in [src/app/shared/types.ts](../src/app/shared/types.ts) (`Profile`, `CreditCard`, `Statement`, `Installment`, `CashInstallment`, `BankBalance`). Keep new data structures aligned with these interfaces and ids as strings.
- Date logic relies on date-fns (e.g., `UtilsService` in [src/app/core/services/utils.service.ts](../src/app/core/services/utils.service.ts)). Reuse helpers instead of ad hoc math.

## Storage & Sync

- Local persistence goes through IndexedDB via
  `IndexedDBService` ([src/app/core/services/indexeddb.service.ts](../src/app/core/services/indexeddb.service.ts)) which
  wraps a minimal generic IndexedDB class.
- Storage abstraction lives in [src/app/core/storage/indexeddb.ts](../src/app/core/storage/indexeddb.ts): Generic
  `IndexedDB` class with CRUD operations (`getAll<T>`, `get<T>`, `put`, `putAll`, `delete`, `clear`) and `STORES`
  constant for type-safe store names.
- Each feature service (Profile, Card, Statement, Installment, CashInstallment, BankBalance) accesses IndexedDB directly
  using `idb.getDB()` with generic operations instead of feature-specific methods.
- Cloud sync: `FirebaseAuthService` ([src/app/core/services/firebase-auth.service.ts](../src/app/core/services/firebase-auth.service.ts)) + `FirebaseSyncService` ([src/app/core/services/firebase-sync.service.ts](../src/app/core/services/firebase-sync.service.ts)). Sync status uses signals; upload/download cover all collections and settings.
- Manual/local sync and encrypted backups handled by
  `SyncService` ([src/app/core/services/sync.service.ts](../src/app/core/services/sync.service.ts)). Uses
  IndexedDBService for export/import.

## Conventions
- Path aliases are required (see [tsconfig.app.json](../tsconfig.app.json)): `@services`, `@components`, `@shared`, `@core`, `@features`, `@environments`. Example: `import { AppStateService } from '@services';` or `from '@components/card-form-modal.component'`.
- Use the barrel exports in [src/app/core/services/index.ts](../src/app/core/services/index.ts) and [src/app/shared/components/index.ts](../src/app/shared/components/index.ts) to avoid deep relative imports.
- Keep components standalone with `imports` arrays; wire feature pages via route-level `loadComponent` for lazy loading (see [src/app/app.routes.ts](../src/app/app.routes.ts)).
- UI styling uses Tailwind (see [src/styles.css](../src/styles.css)); prefer utility classes over custom CSS.

## Environment & Build
- Env variables are injected via `@ngx-env/builder` (see [angular.json](../angular.json)), prefix `NG_APP_`. Firebase config is read in [src/environments/firebase.ts](../src/environments/firebase.ts).
- Required keys for Firebase Cloud Sync: `NG_APP_FIREBASE_API_KEY`, `NG_APP_FIREBASE_AUTH_DOMAIN`, `NG_APP_FIREBASE_PROJECT_ID`, `NG_APP_FIREBASE_STORAGE_BUCKET`, `NG_APP_FIREBASE_MESSAGING_SENDER_ID`, `NG_APP_FIREBASE_APP_ID`.
- Commands: start `npm start`, build `npm run build`, test `npm test`. Dev build uses Vite via Angular CLI.

## Developer Workflows
- Convert inline templates to external HTML with [scripts/extract-templates.js](../scripts/extract-templates.js) (`node scripts/extract-templates.js`).
- Normalize imports to path aliases with [scripts/update-imports.js](../scripts/update-imports.js) (`npm run update-imports`).
- When adding data features: Define type in [src/app/shared/types.ts](../src/app/shared/types.ts), add store name to
  `STORES` constant in [src/app/core/storage/indexeddb.ts](../src/app/core/storage/indexeddb.ts), create service
  in [src/app/core/services](../src/app/core/services) using generic IndexedDB operations (`getAll`, `putAll`, `get`,
  `put`), and export from barrel [src/app/core/services/index.ts](../src/app/core/services/index.ts).

## Examples
- Importing a service: `import { AppStateService, ProfileService } from '@services';`
- Lazy feature route: `{ path: 'dashboard', loadComponent: () => import('@features/dashboard/dashboard.component').then(m => m.DashboardComponent) }`
- Reading data: `const profiles = await idb.getDB().getAll<Profile>(STORES.PROFILES);`
- Saving data: `await idb.getDB().putAll(STORES.PROFILES, profiles);`
- Settings pattern: Store as `{key: string, value: T}` objects, e.g.,
  `await idb.getDB().put(STORES.SETTINGS, {key: 'activeProfileId', value: profileId})`
- Cloud sync settings live under `users/{uid}/settings/app` in Firestore via `FirebaseSyncService`.

## Testing & Quality
- Unit tests run with Karma/Jasmine (`npm test`). Keep signal-based logic in services with small pure helpers (e.g., `UtilsService`) to ease testing.
- Prettier config lives in [package.json](../package.json). Format with `npx prettier --write .`.

If any conventions here are unclear or you need deeper context (e.g., storage migration paths or sync edge cases), tell me which section to expand and I’ll update this doc.

Don't create summary documents.