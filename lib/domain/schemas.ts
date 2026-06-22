import { z } from "zod";

// Source of truth for ChoreTracker's domain types. Mirrors the Postgres schema
// in docs/architecture.md §2 / supabase/migrations exactly. Every row crossing
// the repository boundary is validated against these.

// ---------------------------------------------------------------------------
// Enums (match the Postgres enum types)
// ---------------------------------------------------------------------------
export const UserRole = z.enum(["admin", "child"]);
export const RecurrenceType = z.enum(["one_off", "daily", "weekly"]);
export const CompletionStatus = z.enum(["pending", "approved", "rejected"]);
export const RedemptionStatus = z.enum(["pending", "fulfilled", "denied"]);

export type UserRole = z.infer<typeof UserRole>;
export type RecurrenceType = z.infer<typeof RecurrenceType>;
export type CompletionStatus = z.infer<typeof CompletionStatus>;
export type RedemptionStatus = z.infer<typeof RedemptionStatus>;

// Reusable primitives
const uuid = z.string().uuid();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"); // a calendar day
const timestamp = z.string(); // timestamptz, ISO string
const weekdays = z.array(z.number().int().min(0).max(6)); // 0=Sun..6=Sat

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export const Family = z.object({
  id: uuid,
  name: z.string().min(1),
  timezone: z.string().min(1),
  auto_approve: z.boolean(),
  created_at: timestamp,
});

export const Profile = z.object({
  id: uuid,
  family_id: uuid,
  role: UserRole,
  display_name: z.string().min(1),
  email: z.string().email(),
  created_at: timestamp,
});

export const Chore = z.object({
  id: uuid,
  family_id: uuid,
  child_id: uuid,
  title: z.string().min(1),
  description: z.string().nullable(),
  points: z.number().int().min(0),
  recurrence_type: RecurrenceType,
  weekdays: weekdays,
  start_date: isoDate,
  active: z.boolean(),
  created_by: uuid,
  created_at: timestamp,
});

// The editable fields of a chore (create/edit form payload). family_id and
// created_by are supplied by the repository from the signed-in admin, never the
// form, so they can't be spoofed.
export const ChoreDraft = z.object({
  child_id: uuid,
  title: z.string().trim().min(1, "Give the chore a name").max(80),
  description: z.string().trim().max(300).nullable(),
  points: z.number().int().min(0).max(1000),
  recurrence_type: RecurrenceType,
  weekdays: weekdays,
  start_date: isoDate,
  active: z.boolean(),
});
export type ChoreDraft = z.infer<typeof ChoreDraft>;

export const ChoreCompletion = z.object({
  id: uuid,
  family_id: uuid,
  chore_id: uuid,
  child_id: uuid,
  due_date: isoDate,
  status: CompletionStatus,
  points_awarded: z.number().int(),
  completed_at: timestamp,
  approved_at: timestamp.nullable(),
  approved_by: uuid.nullable(),
});

export const Reward = z.object({
  id: uuid,
  family_id: uuid,
  title: z.string().min(1),
  description: z.string().nullable(),
  cost: z.number().int().positive(),
  active: z.boolean(),
  created_at: timestamp,
});

// Editable fields of a reward (create/edit form). family_id is set by the repo.
export const RewardDraft = z.object({
  title: z.string().trim().min(1, "Give the reward a name").max(80),
  description: z.string().trim().max(300).nullable(),
  cost: z.number().int().positive("Cost must be at least 1"),
  active: z.boolean(),
});
export type RewardDraft = z.infer<typeof RewardDraft>;

export const Redemption = z.object({
  id: uuid,
  family_id: uuid,
  child_id: uuid,
  reward_id: uuid,
  cost: z.number().int().positive(),
  status: RedemptionStatus,
  requested_at: timestamp,
  resolved_at: timestamp.nullable(),
  resolved_by: uuid.nullable(),
});

export const PointAdjustment = z.object({
  id: uuid,
  family_id: uuid,
  child_id: uuid,
  delta: z.number().int(),
  note: z.string().min(1),
  created_by: uuid,
  created_at: timestamp,
});

// The v_child_balance view row
export const ChildBalance = z.object({
  child_id: uuid,
  family_id: uuid,
  balance: z.number().int(),
  lifetime_earned: z.number().int(),
  committed_to_rewards: z.number().int(),
});

export type Family = z.infer<typeof Family>;
export type Profile = z.infer<typeof Profile>;
export type Chore = z.infer<typeof Chore>;
export type ChoreCompletion = z.infer<typeof ChoreCompletion>;
export type Reward = z.infer<typeof Reward>;
export type Redemption = z.infer<typeof Redemption>;
export type PointAdjustment = z.infer<typeof PointAdjustment>;
export type ChildBalance = z.infer<typeof ChildBalance>;
