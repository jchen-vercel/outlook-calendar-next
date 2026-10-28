import { CalendarX2 } from "lucide-react"
import { NewEventButton } from './event-composer'

export function EmptyState({ account }: { account?: string | null }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <CalendarX2 className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Nothing on the horizon</h2>
      <p className="mx-auto mt-2 max-w-sm text-pretty leading-relaxed text-muted-foreground">
        You have no upcoming events in the next 14 days
        {account ? ` on ${account}` : ""}. Enjoy the open calendar.
      </p>
      <NewEventButton className="mt-6" />
    </div>
  )
}
