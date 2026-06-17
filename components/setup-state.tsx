import { Terminal, AlertTriangle } from "lucide-react"

export function SetupState({ message, connectorUid }: { message?: string; connectorUid: string }) {
  const steps = [
    {
      title: "Link this project to Vercel",
      code: "vercel link",
      desc: "Connects your local directory to a Vercel project so Connect can issue an OIDC token.",
    },
    {
      title: "Create the Microsoft Graph connector",
      code: "vercel connect create login.microsoftonline.com --name microsoft-graph",
      desc: "Registers a Custom OAuth connector. Use your Azure app's client ID and secret, with the Microsoft OAuth 2.0 endpoints and Calendars.Read scope.",
    },
    {
      title: "Attach it to this project",
      code: `vercel connect attach ${connectorUid}`,
      desc: "Authorizes this project (and environment) to request tokens from the connector.",
    },
    {
      title: "Pull a development token",
      code: "vercel env pull",
      desc: "Writes VERCEL_OIDC_TOKEN into .env.local for local development. On Vercel deployments this is automatic.",
    },
  ]

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Finish connecting Microsoft Graph</h2>
          <p className="mt-1 text-pretty leading-relaxed text-muted-foreground">
            {message ??
              "The Microsoft Graph connector isn't set up for this project yet. Complete the steps below, then refresh."}
          </p>
        </div>
      </div>

      <ol className="mt-7 space-y-5">
        {steps.map((step, i) => (
          <li key={step.code} className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                <code className="font-mono inline-flex items-center gap-2">
                  <Terminal className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  {step.code}
                </code>
              </pre>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-lg bg-secondary p-4 text-sm leading-relaxed text-muted-foreground">
        The connector UID this app requests is{" "}
        <code className="font-mono text-foreground">{connectorUid}</code>. Override it with the{" "}
        <code className="font-mono text-foreground">MS_GRAPH_CONNECTOR</code> environment variable if
        you named yours differently.
      </p>
    </div>
  )
}
