import { CalendarDays } from "lucide-react"
import { getUpcomingEvents, MS_GRAPH_CONNECTOR } from "@/lib/graph"
import { UpNextCard } from "@/components/up-next-card"
import { UpcomingList } from "@/components/upcoming-list"
import { ConnectState } from "@/components/connect-state"
import { SetupState } from "@/components/setup-state"
import { EmptyState } from "@/components/empty-state"
import { RefreshButton } from "@/components/refresh-button"

export const dynamic = "force-dynamic"

export default async function Page() {
  const result = await getUpcomingEvents()
  const [upNext, ...rest] = result.events

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight">Up Next</h1>
            <p className="text-sm text-muted-foreground">
              {result.status === "connected" && result.account
                ? result.account
                : "Microsoft Outlook calendar"}
            </p>
          </div>
        </div>
        {result.status === "connected" && <RefreshButton />}
      </header>

      <div className="mt-8">
        {result.status === "needs_setup" && (
          <SetupState message={result.message} connectorUid={MS_GRAPH_CONNECTOR} />
        )}

        {result.status === "needs_authorization" && (
          <ConnectState authorizationUrl={result.authorizationUrl} />
        )}

        {result.status === "error" && (
          <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Couldn&apos;t load your calendar</h2>
            <p className="mx-auto mt-2 max-w-md text-pretty leading-relaxed text-muted-foreground">
              {result.message ?? "Something went wrong while reaching Microsoft Graph."}
            </p>
            <div className="mt-6 flex justify-center">
              <RefreshButton />
            </div>
          </div>
        )}

        {result.status === "connected" &&
          (upNext ? (
            <>
              <UpNextCard event={upNext} />
              <UpcomingList events={rest} />
            </>
          ) : (
            <EmptyState account={result.account} />
          ))}
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        Authenticated with Microsoft Graph via Vercel Connect · read-only calendar access
      </footer>
    </main>
  )
}
