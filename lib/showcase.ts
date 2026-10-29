export type ResponsibilityOwner = 'Application team' | 'Platform team' | 'Vercel' | 'Microsoft/Entra'

type ScenarioStep = { title: string; description: string; owners: ResponsibilityOwner[] }
type ImplementationExample = { label: string; code: string }

export type ShowcaseScenario = {
  id: string
  shortTitle: string
  title: string
  employeeExperience: string
  traditional: ScenarioStep[]
  managed: ScenarioStep[]
  shift: string
  retained: string
  example: { traditional: ImplementationExample; managed: ImplementationExample; note: string }
  source: { label: string; url: string }
}

export const showcaseScenarios: ShowcaseScenario[] = [
  {
    id: 'sign-in', shortTitle: 'Sign in', title: 'An employee opens the calendar.',
    employeeExperience: 'Use the company’s Entra sign-in, then see a calendar personalized to the signed-in user.',
    traditional: [
      { title: 'Integrate corporate sign-in', description: 'Configure an OIDC library, Entra application, and callback in the application’s authentication stack.', owners: ['Application team', 'Platform team'] },
      { title: 'Operate sessions and route protection', description: 'Maintain session configuration and ensure the application’s entry points require sign-in. A shared gateway can also provide this.', owners: ['Application team', 'Platform team'] },
      { title: 'Apply the application’s access policy', description: 'Read the authenticated identity and enforce the department, role, and data permissions this tool requires.', owners: ['Application team'] },
    ],
    managed: [
      { title: 'Select the corporate connection', description: 'Apply the company’s Passport configuration to the project. Entra remains the identity provider.', owners: ['Platform team', 'Microsoft/Entra'] },
      { title: 'Passport handles deployment sign-in', description: 'Vercel handles the redirect, authentication response, and deployment session before application routes run.', owners: ['Vercel'] },
      { title: 'Apply the application’s access policy', description: 'Read the supplied identity and enforce the same department, role, and data permissions.', owners: ['Application team'] },
    ],
    shift: 'Deployment sign-in and session operation move to a shared platform service. Application access decisions remain explicit.',
    retained: 'A shared Passport connection does not provide a per-project department policy editor. This calendar does not implement department or role gating.',
    example: {
      traditional: { label: 'Illustrative integration responsibilities', code: 'Configure the OIDC client and callback\nMaintain application session settings\nProtect server routes and actions\nApply department and data policies' },
      managed: { label: 'From this app · identity lookup', code: 'const identity = getCurrentUserId(requestHeaders)\nif (!identity.ok) {\n  return { status: \'passport_missing\', events: [] }\n}' },
      note: 'This app reads the identity header injected by Passport on Vercel. Additional application authorization is still your implementation.',
    },
    source: { label: 'Passport deployment protection', url: 'https://vercel.com/docs/passport' },
  },
  {
    id: 'connect-outlook', shortTitle: 'Connect Outlook', title: 'The employee connects Outlook.',
    employeeExperience: 'Authorize calendar access through Microsoft and return to the application.',
    traditional: [
      { title: 'Configure Microsoft authorization', description: 'Register the Entra application and integrate an OAuth library with the consent and callback flow.', owners: ['Platform team', 'Application team'] },
      { title: 'Persist the user’s credentials', description: 'Operate a protected token cache or shared credential service, with access controls and persistent storage.', owners: ['Application team', 'Platform team'] },
      { title: 'Build the connection experience', description: 'Associate the grant with the authenticated user and handle consent, denial, and connection errors.', owners: ['Application team'] },
    ],
    managed: [
      { title: 'Attach an approved connector', description: 'Reuse the team’s Graph connector and authorize this project’s environments. Microsoft permissions still require configuration.', owners: ['Platform team', 'Microsoft/Entra'] },
      { title: 'Connect brokers authorization', description: 'Vercel runs the OAuth exchange and stores refresh credentials outside the application.', owners: ['Vercel'] },
      { title: 'Build the connection experience', description: 'Request a token for the authenticated user and show the returned authorization link when consent is needed.', owners: ['Application team'] },
    ],
    shift: 'The application consumes a credential service instead of operating its own persistent OAuth credential store.',
    retained: 'Keep user-to-credential mapping on the server. Microsoft consent, suitable scopes, and an approved project link are still required.',
    example: {
      traditional: { label: 'Illustrative credential integration', code: 'Configure the OAuth client\nExchange authorization codes with a library\nPersist each user’s token cache securely\nHandle consent and account association' },
      managed: { label: 'From this app · token request', code: 'await getToken(MS_GRAPH_CONNECTOR, {\n  subject: { type: \'user\', id: userId },\n  scopes: MS_GRAPH_SCOPES,\n})' },
      note: 'getToken runs on the server. The UI receives connection states and authorization links, never the access or refresh token.',
    },
    source: { label: 'Connect authorization and credentials', url: 'https://vercel.com/docs/connect/concepts/authentication' },
  },
  {
    id: 'token-refresh', shortTitle: 'Return later', title: 'An access token has expired.',
    employeeExperience: 'Continue loading the calendar without another consent prompt when the underlying grant remains valid.',
    traditional: [
      { title: 'Acquire a token through a library', description: 'MSAL already caches and refreshes tokens. The enterprise integrates that library with its application or shared service.', owners: ['Application team'] },
      { title: 'Operate persistent token storage', description: 'Maintain protected cache persistence across application instances, deployment changes, and restarts.', owners: ['Platform team', 'Application team'] },
      { title: 'Recover when authorization changes', description: 'Handle revoked grants, policy challenges, and failures that need another employee interaction.', owners: ['Application team', 'Microsoft/Entra'] },
    ],
    managed: [
      { title: 'Ask Connect for a usable token', description: 'Call getToken before the Graph request. The SDK caches identical requests and handles token validity.', owners: ['Application team'] },
      { title: 'Connect operates credential refresh', description: 'Vercel uses its stored refresh credential with Microsoft when renewal is needed and supported by the grant.', owners: ['Vercel', 'Microsoft/Entra'] },
      { title: 'Recover when authorization changes', description: 'Translate recoverable SDK errors into a reconnect experience. A revoked grant can still require user consent.', owners: ['Application team'] },
    ],
    shift: 'Persistent credential storage and provider refresh move out of the app’s operating responsibilities.',
    retained: 'This is an illustrated expiry scenario. A successful calendar load does not tell this UI whether a token was refreshed or served from cache.',
    example: {
      traditional: { label: 'Illustrative MSAL operating model', code: 'Configure the persistent MSAL token cache\nAcquire tokens silently through the library\nMaintain cache protection and availability\nRecover when interaction is required' },
      managed: { label: 'From this app · same token request', code: 'const token = await getToken(MS_GRAPH_CONNECTOR, {\n  subject: { type: \'user\', id: userId },\n  scopes,\n})\n// Then call Microsoft Graph on the server.' },
      note: 'Neither implementation needs to hand-write the OAuth refresh protocol. The difference is who operates the credential infrastructure.',
    },
    source: { label: 'Connect token caching and refresh', url: 'https://vercel.com/docs/connect/concepts/tokens' },
  },
  {
    id: 'create-event', shortTitle: 'Create an event', title: 'The employee saves a first appointment.',
    employeeExperience: 'If write authorization is needed, authorize it, return to the preserved draft, and explicitly save again.',
    traditional: [
      { title: 'Request additional permission', description: 'Use the authentication library to request Calendars.ReadWrite when the employee chooses to create an event.', owners: ['Application team', 'Microsoft/Entra'] },
      { title: 'Maintain the grant and credentials', description: 'Integrate the authorization response with the application’s token cache or shared credential service.', owners: ['Application team', 'Platform team'] },
      { title: 'Preserve the draft and save safely', description: 'Validate time zones, restore the draft, submit to Graph, and handle uncertain outcomes without careless duplicate writes.', owners: ['Application team'] },
    ],
    managed: [
      { title: 'Request additional permission', description: 'Ask Connect for Calendars.ReadWrite. The application chooses when the broader access is needed.', owners: ['Application team', 'Microsoft/Entra'] },
      { title: 'Connect handles the authorization flow', description: 'Start authorization when needed. Vercel handles the provider exchange and underlying credentials.', owners: ['Vercel'] },
      { title: 'Preserve the draft and save safely', description: 'The same calendar validation, draft restoration, Graph write, and uncertain-save recovery remain application code.', owners: ['Application team'] },
    ],
    shift: 'Connect supplies the authorization service. The application team builds the workflow around it.',
    retained: 'Calendars.ReadWrite is broader than creation-only access. This app exposes personal appointment creation and requires an explicit Save event after consent.',
    example: {
      traditional: { label: 'Illustrative application workflow', code: 'Preserve the draft\nRequest additional scopes with the auth library\nProcess the callback and updated token cache\nRestore the draft and require another save' },
      managed: { label: 'From this app · authorization request', code: 'await startAuthorization(MS_GRAPH_CONNECTOR, {\n  subject: { type: \'user\', id: userId },\n  scopes: MS_GRAPH_WRITE_SCOPES,\n}, { callbackUrl })' },
      note: 'The comparison never requests write access. Only the live appointment form can start that flow, after the employee submits it.',
    },
    source: { label: 'Connect user authorization flow', url: 'https://vercel.com/docs/connect/quickstart' },
  },
  {
    id: 'another-app', shortTitle: 'Add another app', title: 'Another team builds a calendar tool.',
    employeeExperience: 'Use corporate sign-in and authorize the calendar permissions the new tool needs.',
    traditional: [
      { title: 'Adopt the enterprise integration stack', description: 'Reuse internal libraries or gateways where available, and configure authentication for the new application.', owners: ['Platform team', 'Application team'] },
      { title: 'Integrate credential infrastructure', description: 'Connect the new tool to approved token storage and provider configuration. Maintain its integration as the app evolves.', owners: ['Platform team', 'Application team'] },
      { title: 'Review and enforce the new tool’s policy', description: 'Decide who may use it, what data it accesses, and which permissions its operations need.', owners: ['Application team', 'Platform team'] },
    ],
    managed: [
      { title: 'Apply an existing Passport configuration', description: 'New projects can inherit team defaults; administrators can assign a suitable connection to existing projects.', owners: ['Platform team', 'Vercel'] },
      { title: 'Link an approved shared connector', description: 'Authorize the new project and its environments within the same Vercel team. Reuse suitable provider setup and credential infrastructure.', owners: ['Platform team', 'Vercel'] },
      { title: 'Review and enforce the new tool’s policy', description: 'Use consistent server-side user mapping. Implement application authorization and obtain additional consent when required.', owners: ['Application team', 'Platform team'] },
    ],
    shift: 'Each additional tool can consume shared sign-in and credential services, reducing the number of independently operated integrations.',
    retained: 'Sharing a connector does not automatically authorize a new project, isolate provider accounts by environment, or eliminate user consent and application policy.',
    example: {
      traditional: { label: 'Illustrative onboarding checklist', code: 'Adopt and configure the shared auth stack\nIntegrate the credential service or token store\nMaintain the application’s integration\nImplement and review its access policy' },
      managed: { label: 'Illustrative setup for an approved new project', code: '# Select the existing Passport configuration\n# Then link the approved Graph connector:\nvercel connect attach oauth/microsoft-graph \\\n  --environment production' },
      note: 'These are explanatory examples, not controls. Project linking, provider permissions, and application review remain administrator responsibilities.',
    },
    source: { label: 'Connect project and environment links', url: 'https://vercel.com/docs/connect/concepts/project-links' },
  },
]

export const responsibilityComparison = [
  { stage: 'Shared setup', traditional: 'Establish identity integration, protected token storage, provider configuration, and operational ownership.', managed: 'Configure Passport and approved Connect connectors. For this custom connector, maintain the Entra registration, credentials, and admin consent.' },
  { stage: 'The next application', traditional: 'Adopt shared libraries or services, integrate them with the app, and configure its access.', managed: 'Apply Passport configuration, approve connector project links, and consume the SDK. Define the app’s access policy.' },
  { stage: 'Ongoing maintenance', traditional: 'Operate the authentication and credential infrastructure, plus each application’s integration.', managed: 'Vercel operates deployment sign-in and credential brokering. Your teams maintain configuration, dependencies, application policy, and behavior.' },
]
