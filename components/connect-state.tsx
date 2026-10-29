import { CalendarCheck2, ShieldCheck, Zap } from "lucide-react"

export function ConnectState({ authorizationUrl }: { authorizationUrl?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <CalendarCheck2 className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-balance text-2xl font-semibold tracking-tight">
        Connect your Outlook calendar
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
        Authorize access through Vercel Connect to see what&apos;s next on your Microsoft Outlook
        calendar. Vercel Connect manages authorization and short-lived tokens. Calendar write
        permission is requested separately when you create your first event.
      </p>

      {authorizationUrl ? (
        <a
          href={authorizationUrl}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          Connect Microsoft Outlook
        </a>
      ) : (
        <p className="mt-7 text-sm text-destructive">
          Couldn&apos;t generate an authorization link. See the setup steps below.
        </p>
      )}

      <ul className="mx-auto mt-8 grid max-w-lg gap-3 text-left sm:grid-cols-3">
        <li className="flex flex-col items-start gap-2 rounded-xl bg-secondary p-4">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">Read first</span>
          <span className="text-xs text-muted-foreground">Write access when you create</span>
        </li>
        <li className="flex flex-col items-start gap-2 rounded-xl bg-secondary p-4">
          <Zap className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">Short-lived</span>
          <span className="text-xs text-muted-foreground">Tokens refresh automatically</span>
        </li>
        <li className="flex flex-col items-start gap-2 rounded-xl bg-secondary p-4">
          <CalendarCheck2 className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">Managed credentials</span>
          <span className="text-xs text-muted-foreground">Microsoft client secrets and refresh tokens are managed outside this application.</span>
        </li>
      </ul>
    </div>
  )
}
