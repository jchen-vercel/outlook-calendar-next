import { ArrowUpRight, Layers3, ShieldCheck } from 'lucide-react'
import { responsibilityComparison } from '@/lib/showcase'

export function ShowcaseResponsibilities() {
  return <section className="portfolio-section" aria-labelledby="portfolio-heading">
    <div className="section-heading"><div><p className="eyebrow">From one tool to a portfolio</p><h2 id="portfolio-heading">The next team gets a foundation to build on.</h2></div><Layers3 className="size-5 text-muted-foreground" aria-hidden="true" /></div>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">The value compounds through reuse: fewer independently operated sign-in and credential integrations, with explicit access decisions for every application.</p>
    <div className="responsibility-table-wrapper" role="region" aria-label="Operational responsibilities comparison" tabIndex={0}>
      <table className="responsibility-table"><caption className="sr-only">Who operates the infrastructure as more internal applications are added</caption><thead><tr><th scope="col">Across your tools</th><th scope="col">Enterprise-managed integration</th><th scope="col">Passport + Vercel Connect</th></tr></thead><tbody>{responsibilityComparison.map((row) => <tr key={row.stage}><th scope="row">{row.stage}</th><td>{row.traditional}</td><td>{row.managed}</td></tr>)}</tbody></table>
    </div>
    <div className="ownership-boundaries">
      <div><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><h3>Application policy stays with you.</h3><p>Department and role checks, record-level access, Graph operations, validation, consent UX, and save recovery remain application responsibilities. This showcase does not implement department gating.</p><a className="source-link" href="https://vercel.com/kb/guide/vercel-passport-nextjs" target="_blank" rel="noopener noreferrer">Application authorization <ArrowUpRight className="size-3.5" aria-hidden="true" /></a></div>
      <div><Layers3 className="size-5 text-primary" aria-hidden="true" /><h3>Shared infrastructure needs configuration.</h3><p>This app uses a custom OAuth connector. Entra registration, client credential maintenance, and applicable admin consent still need an owner. Sharing requires approved project/environment links; provider isolation can require separate connectors.</p><a className="source-link" href="https://vercel.com/docs/connect/concepts/project-links" target="_blank" rel="noopener noreferrer">Connector access and isolation <ArrowUpRight className="size-3.5" aria-hidden="true" /></a></div>
    </div>
  </section>
}
