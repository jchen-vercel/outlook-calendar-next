# Up Next — Outlook Calendar on Vercel

A small [Next.js](https://nextjs.org) app that shows the signed-in user's upcoming Microsoft Outlook calendar events (the next 2 weeks) and creates personal appointments in their default calendar through [Microsoft Graph](https://learn.microsoft.com/graph/overview).

Select **New event** to enter a title, start and end, time zone, optional location and notes, or an all-day date range. The dialog uses your device's time zone when Outlook supports it. Dates on all-day events are inclusive in the form. Events are saved as busy appointments with normal Outlook visibility and default reminders; no invitations are sent. Invitations, recurrence, Teams meetings, editing, and deleting are outside this version.

The agenda initially requests read access. On your first save, the app requests `Calendars.ReadWrite` through Vercel Connect. If authorization is needed, select **Enable Outlook access**. Your draft is kept in this tab's session storage, scoped to your sign-in identity, and restored after authorization. Select **Save event** again to finish; returning from consent never automatically creates an event. If temporary storage is blocked, authorization opens in another tab so the original form stays available.

After saving, the agenda refreshes and a confirmation links to the event in Outlook. Events outside the next 14 days are saved but do not appear in the agenda. If a connection drops during saving, the form keeps the exact submitted request and locks its fields: **Retry save** reuses its Graph transaction ID to reduce duplicate creation.

It uses two Vercel platform features instead of rolling its own auth and token storage:

- **[Vercel Passport](https://vercel.com/docs/passport)** authenticates the end user and identifies who they are. The app reads the Passport token from the `x-vercel-oidc-passport-token` request header and uses its `external_sub` claim as the user ID.
- **[Vercel Connect](https://vercel.com/docs/connect)** obtains a short-lived Microsoft Graph access token for that user, running the OAuth flow and refreshing tokens automatically.

The flow at request time:

```
Browser → Vercel Passport (who is this user? → external_sub)
        → Vercel Connect (getToken for this user → Microsoft Graph access token)
        → Microsoft Graph (GET /me/calendarView → upcoming events)
```

Because both Passport and Connect inject what they need at the edge, **the app only works once it is deployed to Vercel with both Passport and Connect configured.** All three pieces below (Entra ID, Passport, Connect) must be set up for it to run.

---

## Prerequisites

- A Vercel account with this project deployed (or linked locally via `vercel link`).
- Access to a Microsoft [Entra ID](https://entra.microsoft.com) tenant where you can register an application.
- The [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) for local development.

## 1. Register the application in Microsoft Entra ID

Microsoft Graph access requires an OAuth app registration. The default `oauth/microsoft-graph` connector described here uses a custom OAuth registration in Microsoft Entra ID. You can also use an existing Microsoft Graph connector by setting `MS_GRAPH_CONNECTOR` to its UID.

1. Go to [Entra ID → App registrations](https://entra.microsoft.com) → **New registration**.
2. Give it a name (e.g. `Up Next Calendar`).
3. Choose the supported account types:
   - **Single tenant** if only your organization's users will sign in.
   - **Multitenant** if users from any organization should be able to sign in (this maps to the `common` endpoint used below).
4. Under **Platform configurations**, add a **Web** platform with this redirect URI:

   ```text
   https://connect.vercel.com/callback
   ```

5. Under **Certificates & secrets**, create a **client secret**. Copy the secret **value** (not ID) — it is only shown once.
6. From the app's **Overview** page, copy the **Application (client) ID**.
7. Under **API permissions**, add delegated Microsoft Graph permissions `Calendars.Read`, `Calendars.ReadWrite`, and `User.Read`, then grant admin consent if your tenant requires it. Read permission is requested on connection; write permission is requested when saving the first event. An existing read-only connection can continue showing the agenda until the user chooses to authorize creation.

You now have a **client ID**, a **client secret**, and the redirect URI registered.

## 2. Configure Vercel Connect

The app requests the Microsoft Graph token through a [Vercel Connect](https://vercel.com/docs/connect)
connector. To configure the default custom OAuth connector, add it
**manually** using the values below:

| Setting | Value |
| --- | --- |
| **Server URL** | `https://graph.microsoft.com/` |
| **Authorization endpoint** | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| **Token endpoint** | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| **Token Auth Method** | `client_secret_post` |
| **Client ID** | the Application (client) ID from Entra (step 1) |
| **Client Secret** | the client secret value from Entra (step 1) |
| **PKCE** | Enabled, challenge method **S256** (optional, but recommended) |
| **User authorization** | Enabled |
| **Scopes** | Allow `openid profile offline_access Calendars.Read Calendars.ReadWrite User.Read`. The app selects read or write scopes for each operation. |

> **Tenant note:** `common` in the authorization and token endpoints is for **multitenant** apps.  
> For a single-tenant app, replace `common` with your tenant ID (or verified domain), e.g. `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize` and the matching `/token` endpoint.

Then **attach the connector to this project** (and the environment you're deploying to) so the project is authorized to request tokens.

The app looks for the connector UID `oauth/microsoft-graph` by default.  
If your connector UID differs, set it via the `MS_GRAPH_CONNECTOR` environment variable on the project.

> You can also drive Connect from the CLI:
> ```bash
> vercel connect create login.microsoftonline.com --name microsoft-graph
> vercel connect attach oauth/microsoft-graph
> ```

## 3. Configure Vercel Passport

[Vercel Passport](https://vercel.com/docs/passport) authenticates the end user and provides their identity to the app.  
Enable Passport on the project so that incoming requests carry the `x-vercel-oidc-passport-token` header. The app reads the `external_sub` claim from it as the user ID and passes that to Connect when requesting the Graph token.

## 4. Deploy

Push to the connected Git repository or run `vercel deploy`. On Vercel, Passport and Connect
inject the user token and OIDC token automatically.

Once deployed:

1. Open the deployment. Vercel Passport prompts the user to sign in.
2. The first time, Connect shows a consent screen to authorize Microsoft Graph access.
3. After consent, the app reads the user's upcoming calendar events and renders them.

The app handles each setup state explicitly, so the UI will tell you what's missing:

- **"Vercel Passport not configured"** — no Passport user token in the request; enable Passport on
  the project.
- **"Finish connecting Microsoft Graph"** — the Connect connector isn't created/attached yet.
- **Authorization prompt** — the user hasn't consented to Microsoft Graph yet; follow the link.

---

## Local development

The app depends on tokens that Vercel injects, so local dev requires linking to the Vercel project:

```bash
vercel link          # link this directory to the Vercel project
vercel env pull      # writes VERCEL_OIDC_TOKEN into .env.local
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

> Note: Vercel Passport gates the deployed app, so the `x-vercel-oidc-passport-token` header is only present on Vercel.  
> Locally, the user-identity step (`getCurrentUserId`) won't have a token unless you supply one, so the calendar view is best verified on a Vercel deployment.

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MS_GRAPH_CONNECTOR` | No | Connect connector UID for Microsoft Graph. Defaults to `oauth/microsoft-graph`. |
| `VERCEL_OIDC_TOKEN` | Local dev only | Pulled by `vercel env pull`, injected automatically on Vercel deployments. |

---

## How it works (code map)

- `lib/graph.ts` — reads the Passport user ID, gets a Graph token via Connect (`getToken` / `startAuthorization`), fetches `/me/calendarView` and supported time zones, and creates appointments with `POST /me/events`. It maps recoverable errors to UI states.
- `app/actions.ts` — authenticated Server Actions for loading time zones and creating events.
- `lib/event-validation.ts` — validates untrusted input and builds Graph requests using Temporal. Invalid dates, reversed ranges, and skipped or ambiguous daylight-saving times produce field errors.
- `app/page.tsx` — server component that renders the appropriate state (connected, needs setup, needs authorization, Passport missing, error).
- `components/` — the calendar UI (up-next hero card, upcoming list, setup/connect states).

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```

Tests mock Connect and Graph; they do not create real calendar entries. Component tests cover the dialog, permission recovery, session drafts, uncertain-save retries, and save feedback. The default local app still requires Passport and Connect, as described above; there is no development authentication bypass.

For deployment acceptance, use a Passport-protected Vercel preview with the connector attached. Verify the read-only agenda before granting write access, then create a timed appointment in another time zone and a multi-day all-day appointment. Confirm the dates, times, location, and notes directly in Outlook. Also test a date beyond the 14-day agenda and a denied authorization attempt. The write permission is broader than creation, but this app exposes creation only.

---

## Learn more

- [Vercel Connect documentation](https://vercel.com/docs/connect)
- [Vercel Passport documentation](https://vercel.com/docs/passport)
- [Microsoft Graph calendar API](https://learn.microsoft.com/graph/api/resources/calendar)
