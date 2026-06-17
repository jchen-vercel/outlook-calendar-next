"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
    >
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
      <span className="hidden sm:inline">{isPending ? "Refreshing" : "Refresh"}</span>
    </button>
  )
}
