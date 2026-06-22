# Project Charter — ChoreTracker

| | |
|---|---|
| **Client** | [Client — "Mom" / household admin] |
| **Prepared by** | Conner Sandberg (App Studio) |
| **Date** | 2026-06-21 |
| **Version** | 1.0 |
| **Status** | Draft |

---

## 1. Purpose & Business Case

A parent ("Mom") spends time and mental energy every day assigning chores to her children, chasing down what got done, and arguing about it. ChoreTracker is a Progressive Web App that lets Mom create and assign chores (one-off or recurring), gives each child a personal checklist on their own device, and turns completed chores into points the child can redeem for rewards Mom defines. It replaces nagging and whiteboards with a shared, real-time, motivating system that runs itself.

## 2. Objectives

- Give Mom one place to create, assign, and track chores so she stops re-explaining who-does-what every day.
- Give each child a clear, personal "what's mine to do today" checklist they can act on without asking.
- Drive chore completion through a points-and-rewards economy that children find motivating.
- Let Mom see completion status in real time, so she trusts the system instead of re-checking manually.

## 3. Scope

**In scope (what we WILL deliver):**
- A deployed Next.js PWA on Vercel, installable on each family member's device.
- Parent (admin) account and per-child accounts, each via email/password (Supabase Auth).
- Chore creation, assignment to a specific child, and recurrence (one-off, daily, or specific weekdays).
- Per-child personal checklist with check-off; automatic daily reset of recurring chores.
- Points awarded on completion; a Mom-defined reward catalog with a redemption flow.
- Mom's real-time dashboard showing each child's progress and pending approvals.
- Row-Level Security so each child sees only their own chores and points; Mom sees all children.

**Out of scope (what we will NOT deliver in v1):**
- Multiple families / multi-tenant sign-up (single family; schema designed to allow it later — see PRD).
- Multiple parents / co-admin accounts.
- Native iOS/Android app-store apps.
- Allowances or real-money payouts, bank/payment integrations.
- Web push notifications (deferred to v1.1).
- Photo proof of completion, chore comments/chat, recurring "monthly" schedules.
- Any AI/LLM features.

## 4. Key Deliverables

- A deployed, installable PWA at a Vercel URL (e.g., chore-tracker.vercel.app).
- Supabase project (Postgres + Auth + Realtime + RLS) provisioned on the free tier.
- A short how-to guide for Mom: creating accounts for kids, adding chores, defining rewards, approving redemptions.

## 5. Stakeholders & Roles

| Name | Role | Responsibility |
|------|------|----------------|
| Conner Sandberg | Developer / PM | Designs, builds, deploys, hands off |
| Client ("Mom") | Owner / Admin / Decision-maker | Approves scope, creates kid accounts, defines chores and rewards, approves completions/redemptions |
| Children | End users | Log in on their own device, complete chores, redeem points |

## 6. High-Level Timeline

| Milestone | Target date |
|-----------|-------------|
| Requirements approved | [date] |
| First working version (core loop) | [date] |
| Delivery / launch | [date] |

## 7. Budget

[To be set with client.] Hosting runs on free tiers (Vercel + Supabase free tier) and is expected to carry a single family at no recurring cost. Note for the client: heavy growth (many families, large media) could eventually require paid tiers — not anticipated for a single household.

## 8. Success Criteria

- Mom can create a chore and assign it to a child in under a minute, without help.
- Each child can log in on their own device and see only their own chores.
- A completed chore awards points and appears on Mom's view in real time.
- A child can redeem points for a reward, and Mom can approve it.
- The app is live and stable for 2 weeks post-launch with the family using it daily.

## 9. Assumptions, Constraints & Risks

- **Assumptions:** Each child has a device with a modern browser; Mom is the single administrator; the family has reliable internet (the app is cloud-backed, not offline-first).
- **Constraints:** Next.js PWA on Vercel; Supabase free tier (Postgres + Auth + Realtime + RLS); points-and-rewards motivation model; single family in v1.
- **Risks:**
  - *Email/password is heavy for young children* (forgotten passwords, email verification, no email address) → friction and support load on Mom. **Mitigation:** documented as the top risk in the BRD/PRD; recommended v1.1 fallback is "Mom invites kid + per-child 4-digit PIN." The client chose email/password with this tradeoff understood.
  - *Recurring-chore reset reliability* (chores must reappear each day) → **Mitigation:** design a deterministic reset that does not depend on a server being awake at midnight (see PRD recommendation).
  - *Points feel unfair if Mom can't correct mistakes* → **Mitigation:** Mom can adjust/void completions; default approval model chosen to balance trust and friction (see PRD).

## 10. Maintenance & Handoff

Delivered with a short how-to guide for Mom. Day-to-day operation (adding kids, chores, rewards, approvals) is fully self-service for the client. The app runs on managed services (Vercel + Supabase) with no servers for the client to maintain. Code changes, schema migrations, and dependency updates remain with the developer on a per-request basis; no ongoing maintenance retainer is included unless separately agreed.

---

## Approval

| | Name | Date |
|---|------|------|
| **Client** | | |
| **Developer** | | |
