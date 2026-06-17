# Up Next — Outlook Calendar on Vercel

A small [Next.js](https://nextjs.org) app that shows the signed-in user's upcoming Microsoft Outlook calendar events (the next 2 weeks), read from [Microsoft Graph](https://learn.microsoft.com/graph/overview).

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

Microsoft Graph access requires an OAuth app registration. Connect does not (yet) have a built-in Entra / Microsoft Graph connector, so the OAuth client lives in a custom integration that points at this Entra app.

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
7. (Recommended) Under **API permissions**, add delegated Microsoft Graph permissions `Calendars.Read` and `User.Read`, then grant admin consent if your tenant requires it. (Users are also prompted to consent during the OAuth flow.)

You now have a **client ID**, a **client secret**, and the redirect URI registered.

## 2. Configure Vercel Connect

The app requests the Microsoft Graph token through a [Vercel Connect](https://vercel.com/docs/connect)
connector. Connect does not yet have a built-in Entra / Microsoft Graph connector, so add it
**manually** as a custom OAuth connector using the values below:

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
| **Scopes** | `openid profile` |

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

> Note: Vercel Passport gates the deployed app, so the `x-vercel-oidc-passport-token` header is
> only present on Vercel. Locally, the user-identity step (`getCurrentUserId`) won't have a token
> unless you supply one, so the calendar view is best verified on a Vercel deployment.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MS_GRAPH_CONNECTOR` | No | Connect connector UID for Microsoft Graph. Defaults to `oauth/microsoft-graph`. |
| `VERCEL_OIDC_TOKEN` | Local dev only | Pulled by `vercel env pull`, injected automatically on Vercel deployments. |

## How it works (code map)

- `lib/graph.ts` — the core logic: reads the Passport user ID, gets a Graph token via Connect (`getToken` / `startAuthorization`), and fetches `/me/calendarView`. It also maps recoverable errors (needs authorization, needs setup) to UI states.
- `app/page.tsx` — server component that renders the appropriate state (connected, needs setup, needs authorization, Passport missing, error).
- `components/` — the calendar UI (up-next hero card, upcoming list, setup/connect states).

## Learn more

- [Vercel Connect documentation](https://vercel.com/docs/connect)
- [Vercel Passport documentation](https://vercel.com/docs/passport)
- [Microsoft Graph calendar API](https://learn.microsoft.com/graph/api/resources/calendar)
