import { Suspense } from 'react'
import { ArrowDown, ArrowUpRight, CalendarDays } from 'lucide-react'
import { LiveCalendarLoading, LiveCalendarPanel } from '@/components/live-calendar-panel'
import { ShowcaseExplorer } from '@/components/showcase-explorer'
import { ShowcaseResponsibilities } from '@/components/showcase-responsibilities'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <main className="showcase-shell">
    <a href="#comparison-heading" className="skip-link">Skip to comparison</a>
    <header className="showcase-nav"><a href="#" className="showcase-brand" aria-label="Up Next home"><span><CalendarDays className="size-4" aria-hidden="true" /></span>Up Next <span className="brand-divider" aria-hidden="true" /> <span className="brand-caption">An enterprise app field guide</span></a><a className="source-link" href="https://vercel.com/docs/connect" target="_blank" rel="noopener noreferrer">Read the docs <ArrowUpRight className="size-3.5" aria-hidden="true" /></a></header>
    <section className="showcase-hero" aria-labelledby="showcase-heading"><p className="eyebrow"><span className="hero-dot" aria-hidden="true" /> Passport + Vercel Connect in practice</p><h1 id="showcase-heading">Same calendar.<br /><span>Less infrastructure for<br className="hidden sm:block" /> each team to operate.</span></h1><div className="hero-bottom"><p>Compare an enterprise-managed Entra integration with Passport + Vercel Connect. Explore who owns the work, then use the real Outlook application.</p><a href="#live-calendar" className="live-anchor">Open live calendar <ArrowDown className="size-4" aria-hidden="true" /></a></div></section>
    <div className="showcase-workspace"><ShowcaseExplorer /><aside id="live-calendar" aria-labelledby="live-calendar-heading" tabIndex={-1} className="live-calendar-panel"><div className="live-panel-heading"><div><p className="eyebrow">Running implementation</p><h2 id="live-calendar-heading">Your live calendar</h2></div><span className="live-label"><span aria-hidden="true" />Live integration</span></div><p className="live-panel-description">This application uses Passport + Connect. The scenario walkthrough is illustrative.</p><Suspense fallback={<LiveCalendarLoading />}><LiveCalendarPanel /></Suspense></aside></div>
    <ShowcaseResponsibilities />
    <footer className="showcase-footer"><p>Up Next <span aria-hidden="true">/</span> A working calendar, with the infrastructure explained.</p><div><a href="https://vercel.com/docs/passport" target="_blank" rel="noopener noreferrer">Passport</a><a href="https://vercel.com/docs/connect" target="_blank" rel="noopener noreferrer">Connect</a><a href="https://learn.microsoft.com/en-us/entra/msal/overview" target="_blank" rel="noopener noreferrer">MSAL baseline</a></div></footer>
  </main>
}
