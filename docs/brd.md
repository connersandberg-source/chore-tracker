# Business Requirements Document — ChoreTracker

| | |
|---|---|
| **Client** | [Client — "Mom" / household admin] |
| **Author** | Conner Sandberg (App Studio) |
| **Date** | 2026-06-21 |
| **Version** | 1.0 |
| **Approved by** | [Client name] |

---

## 1. Executive Summary

ChoreTracker is a Progressive Web App for a single household that turns daily chore delegation into a self-running, motivating system. Mom creates chores and assigns them to a specific child (one-off or recurring); each child logs in on their own device and sees only their personal checklist; checking off a chore earns points; points are redeemed for rewards Mom defines. Mom watches completion in real time. It replaces verbal nagging and whiteboards with a shared source of truth that motivates the kids and gives Mom back time and mental load.

## 2. Background & Problem Statement

Today, chore delegation is verbal and repetitive. Mom re-assigns the same chores every day, has no reliable view of what's actually done, and ends up chasing or re-doing tasks. Children lack a clear, owned list of "what's mine," and there's no consistent incentive to finish. The result is friction, forgotten chores, and a recurring time drain for the parent. There is no shared, trusted record that both Mom and each child can look at.

## 3. Business Objectives

| ID | Objective | How we'll measure it |
|----|-----------|----------------------|
| BO-1 | Eliminate daily re-assignment of routine chores | Recurring chores auto-appear on each child's list with zero daily input from Mom |
| BO-2 | Give Mom a trusted, real-time view of completion | Mom can see each child's done/pending status without asking anyone |
| BO-3 | Increase chore completion via motivation | Higher proportion of assigned chores completed once points/rewards are live |
| BO-4 | Reduce parental time and mental load on chores | Mom reports less time spent assigning and verifying chores |

## 4. Current State → Desired Future State

| | Today (current) | After (desired) |
|---|-----------------|-----------------|
| Assigning chores | Verbal, repeated daily | Created once; recurring chores auto-appear |
| Child's view of tasks | Has to ask / remember | Personal checklist on their own device |
| Tracking completion | Mom re-checks manually, or trusts memory | Real-time dashboard, updates as kids check off |
| Motivation | Nagging | Points earned, redeemable for defined rewards |
| Record of who did what | None | Persistent, per-child history of completions and points |

## 5. Business Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BR-1 | The solution must let Mom create chores and assign each to a specific child | Must |
| BR-2 | The solution must support recurring chores (daily and specific weekdays) that reappear automatically | Must |
| BR-3 | The solution must give each child a private checklist showing only their own chores | Must |
| BR-4 | The solution must let a child mark a chore complete from their own device | Must |
| BR-5 | The solution must award points for completed chores | Must |
| BR-6 | The solution must let Mom define a catalog of rewards with point costs | Must |
| BR-7 | The solution must let a child redeem points for a reward, with Mom able to approve | Must |
| BR-8 | The solution must show Mom each child's completion status in real time | Must |
| BR-9 | The solution must keep each child's data isolated from siblings (a child cannot see or alter another child's chores/points) | Must |
| BR-10 | The solution should let Mom correct mistakes (adjust points, void or re-open a completion) | Should |
| BR-11 | The solution should notify users of relevant events (chore assigned, chore completed) | Should (deferred to v1.1) |
| BR-12 | The solution could support multiple families in future without a rebuild | Could (schema-ready in v1) |

## 6. Stakeholders

| Stakeholder | Interest / need |
|-------------|-----------------|
| Client ("Mom") | Stop nagging; see what's done; motivate kids; minimal admin effort |
| Children | Know what to do; get credit and rewards; a list that's clearly "theirs" |
| Developer | Clear scope, maintainable single-family build on managed free-tier services |

## 7. Scope

**In scope:** Parent admin account + per-child accounts (email/password); chore creation, assignment, and recurrence; per-child checklist with check-off; automatic daily reset of recurring chores; points on completion; Mom-defined reward catalog and redemption/approval flow; Mom's real-time dashboard; Row-Level Security isolating each child's data.

**Out of scope:** Multiple families and multiple/co-parent accounts (single family, single admin in v1 — schema designed to allow families later); native app-store apps; allowances or real money; web push notifications (v1.1); photo proof, chore chat/comments, monthly recurrence; any AI/LLM features.

## 8. Success Metrics (KPIs)

- Mom no longer manually re-assigns routine chores (recurring chores cover the daily routine).
- Mom can answer "is it done?" for any child in under 10 seconds, from the app.
- Majority of assigned chores marked complete each week once points/rewards are active.
- At least one reward redeemed in the first two weeks (signals the motivation loop works).
- App live and stable for 2 weeks post-launch with daily family use.

## 9. Assumptions, Constraints & Dependencies

- **Assumptions:** Each child has their own device + modern browser; Mom is the sole admin; reliable internet (cloud-backed, not offline-first); each child can receive/use an email address for sign-up.
- **Constraints:** Next.js PWA on Vercel; Supabase free tier (Postgres, Auth, Realtime, RLS); points-and-rewards motivation model; single family in v1.
- **Dependencies:** Vercel (hosting), Supabase (database, auth, realtime). Client must provide the children's names and decide the initial chores, point values, and reward catalog.

## 10. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Email/password is heavy for young kids** — forgotten passwords, email verification, kids without their own email | Friction, drop-off, support load on Mom | Documented for the client (chosen knowingly). Recommended v1.1 fallback: "Mom invites kid + per-child 4-digit PIN." Build v1 Auth so this path is addable without a rewrite. |
| Recurring-chore reset doesn't fire (chores don't reappear) | Core daily value breaks | Use a deterministic, app-driven reset that doesn't rely on a server being awake at midnight (see PRD). |
| Points feel unfair / can't be corrected | Kids lose trust, motivation collapses | Mom can adjust points and void/re-open completions (BR-10). |
| Auto-awarding points lets kids "check off" undone chores | Gaming the system | Default to Mom approval before points are awarded (see PRD recommendation), with an option to flip to auto-award per family preference. |
| Free-tier limits (rows, realtime connections) | Service degrades | Single family is comfortably within Supabase free tier; monitor at handoff. |

## 11. Data & Privacy Considerations

The app stores personal data about minors: each child's name, email (for Auth), their chores, completions, points, and redemptions. This data lives in the client's own Supabase project, governed by Row-Level Security so each child can read/write only their own records and only Mom (admin) can see all children. No data is sent to any third-party LLM or analytics service. No photos or sensitive identifiers are collected in v1. Because the users include children, accounts and any password resets are mediated by Mom as administrator. If the v1.1 PIN model is adopted, children would not need email addresses at all, further reducing data collected about minors.

## 12. Glossary

- **PWA (Progressive Web App):** A website that can be "installed" to a phone/tablet home screen and behaves like an app.
- **Recurring chore:** A chore that repeats automatically (daily, or on specific weekdays).
- **Points economy:** Children earn points for completed chores and spend them on rewards.
- **Reward catalog:** The list of rewards (with point costs) that Mom defines.
- **Redemption:** A child spending points to claim a reward.
- **RLS (Row-Level Security):** A database rule layer that restricts which rows each user can see or change — how we keep each child's data private.
- **Supabase:** The managed backend (Postgres database, authentication, realtime updates) the app runs on.
- **Admin / Mom:** The single parent account that manages everything in v1.

---

## Approval

| | Name | Date |
|---|------|------|
| **Client** | | |
| **Author** | | |
