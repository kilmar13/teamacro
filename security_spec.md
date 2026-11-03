# Security Specification & Threat Model — Wanda Bank / TEAMACRO

## 1. Data Invariants & Access Control Policy
1. **Default Deny:** All unmapped paths and unrecognized write actions are unconditionally rejected.
2. **Identity Integrity:** Authenticated users may only read and modify resources linked to their own verified `request.auth.uid`. No user can tamper with another customer's balance or profile.
3. **Admin Hierarchy:** Administrative and managerial endpoints require verified authentication and membership in the `/admins` collection or matching the bootstrapped administrator email (`eromoseledavidson68@gmail.com`).
4. **Financial Immutability:** Ledger transactions are append-only. Once created with a valid reference, timestamp, and kobo amounts, transaction records cannot be updated or deleted by any client.
5. **Account Opening:** Digital account onboarding applications can be created by verified public applicants or anonymous onboarding guests, but cannot modify internal banking flags or approval status.

## 2. The "Dirty Dozen" Threat Payloads
1. **ID Injection Attack:** Attempting to create a user or account with a 2KB junk character ID string -> REJECTED by `isValidId`.
2. **Account Balance Tampering:** A standard customer sending an update payload altering their own `balanceKobo` -> REJECTED by `affectedKeys().hasOnly()`.
3. **Identity Spoofing:** A user attempting to set `userId: 'USR-VICTIM-999'` in a transaction -> REJECTED by `incoming().userId == request.auth.uid`.
4. **Role Escalation:** A customer updating their own document with `role: 'SUPER_ADMIN'` -> REJECTED by strict update rules forbidding role alterations.
5. **Blanket Query Scraping:** A client performing an unfiltered collection query without a specific `userId` filter -> REJECTED by `resource.data.userId == request.auth.uid`.
6. **Transaction Deletion:** A client attempting to send a `deleteDoc` on a processed transaction -> REJECTED by `allow delete: if false`.
7. **Negative Balance Poisoning:** Attempting to write a negative integer to `amountKobo` -> REJECTED by `data.amountKobo is number && data.amountKobo > 0`.
8. **Ghost Field Poisoning:** Adding hidden payload properties (e.g., `__adminOverride: true`) -> REJECTED by `keys().hasOnly()`.
9. **Dormant Account Revocation Bypass:** Attempting to initiate debit operations on a restricted or frozen account -> REJECTED by status validation.
10. **Admin Claim Fabrication:** Attempting to supply custom client JWT claims -> REJECTED; rules only verify database-backed `/admins/$(request.auth.uid)` or verified server admin token.
11. **Timestamp Forgery:** Submitting a client-forged past timestamp for a new transaction -> REJECTED by `incoming().createdAt == request.time`.
12. **Unauthenticated Read:** Attempting to read another user's banking ledger records while unauthenticated -> REJECTED by `isSignedIn()`.
