import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOff className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">
          You&apos;re offline
        </h1>
        <p className="text-sm text-muted-foreground">
          ChoreTracker needs an internet connection to load chores and points.
          Reconnect and it&apos;ll pick right back up.
        </p>
      </div>
    </main>
  );
}
