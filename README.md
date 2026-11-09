# TEAMACRO SERVICES LTD — Internal Banking & Operations Platform

## Data & Rendering Rules

To guarantee zero table flickering, zero fetch loops, and zero Cumulative Layout Shift (CLS) across all Super Admin, Admin, and Staff portals:

1. **Single Authoritative Owner per Collection**:
   - Each list or directory state (`staffDirectory`, `staffList`, `backendInvitations`, `customers`) has one authoritative owner (`/api/auth/accounts` synced via `authService.getAccountsList()` -> `ledgerEngine.syncStaffDirectoryFromServer()`).
   - Never overwrite an already-hydrated React state array with a partial local-only baseline before an async fetch resolves. Keep existing rows visible while refreshing.

2. **Decouple Storage Listeners from Network Fetches**:
   - `ledgerEngine.subscribe()` must only refresh synchronous local ledger slices (`transactions`, `transfers`, `audits`, `oversightLogs`).
   - Background server hydration (`syncCustomersFromServer()`, `syncStaffDirectoryFromServer()`) must write to `localStorage` with `silent = true` and diff-check serialized JSON in `saveToStorage()` so background hydration never triggers recursive `STORAGE_UPDATED` notifications.

3. **Request Cancellation & Race Protection**:
   - Every `useEffect` that fetches data must create an `AbortController`, pass `controller.signal` into `safeApiFetch` / `authService`, and call `controller.abort()` in its cleanup function.
   - Guard state updates with a monotonic `requestIdRef` (`const reqId = ++requestIdRef.current`) so stale or overlapping responses are ignored.

4. **Deterministic Ordering & Stable Keys**:
   - Backend directory endpoints (`/api/auth/accounts`, `/api/auth/access/invitations`) must return `Cache-Control: no-store, no-cache, must-revalidate` and sort records deterministically (`LIFETIME_SUPER_ADMIN` root row always at index `0`, followed by `createdAt` and `id`).
   - Always key rendered rows by a unique, immutable identifier (`staff.id`, `inv.id || inv.code`, `cust.id`) — never by array index.

5. **Fixed Table Geometry & Layout Containment**:
   - Data tables must use `table-fixed` (`table-layout: fixed`) with explicit `<colgroup>` column width percentages, wrapped in containers with reserved `min-height` and `[contain:layout]` so adjacent sections never jump vertically.
