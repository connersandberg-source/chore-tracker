import { CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-sky-deep text-primary-foreground shadow-sm">
        <CheckCircle2 className="size-10" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-extrabold text-ink">
          ChoreTracker
        </h1>
        <p className="text-base text-muted-foreground">
          A friendly family chore checklist. Assign chores, check them off, earn
          points, trade them for rewards.
        </p>
      </div>
      <p className="rounded-full bg-points-soft px-4 py-1.5 text-sm font-semibold text-points">
        Coming together — setup in progress
      </p>
    </main>
  );
}
