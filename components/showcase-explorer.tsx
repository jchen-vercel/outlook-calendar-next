'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDownRight, ArrowRight, Building2, Check, ChevronDown, ExternalLink, KeyRound, Layers3, LogIn, Plus, RotateCw, UserRound } from 'lucide-react'
import { showcaseScenarios, type ResponsibilityOwner, type ShowcaseScenario } from '@/lib/showcase'

const scenarioIcons = [LogIn, KeyRound, RotateCw, Plus, Layers3]

function OwnerBadge({ owner }: { owner: ResponsibilityOwner }) {
  return <span className={`owner-badge ${owner === 'Vercel' ? 'owner-badge-vercel' : ''}`}>{owner}</span>
}

function Approach({ managed, scenario }: { managed: boolean; scenario: ShowcaseScenario }) {
  const steps = managed ? scenario.managed : scenario.traditional
  return <section className={`approach-card ${managed ? 'approach-card-managed' : ''}`} aria-label={managed ? 'Passport + Vercel Connect' : 'Enterprise-managed integration'}>
    <div className="approach-header">
      <span className="approach-icon" aria-hidden="true">{managed ? <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M12 3 23 22H1Z" /></svg> : <Building2 className="size-4" />}</span>
      <div><p className="eyebrow">{managed ? 'Platform services' : 'Enterprise-operated stack'}</p><h3>{managed ? 'Passport + Vercel Connect' : 'Enterprise-managed integration'}</h3></div>
    </div>
    <ol className="approach-steps">
      {steps.map((step, index) => <li key={step.title}>
        <span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0"><h4>{step.title}</h4><p>{step.description}</p><div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Operated by">{step.owners.map((owner) => <OwnerBadge key={owner} owner={owner} />)}</div></div>
      </li>)}
    </ol>
  </section>
}

export function ShowcaseExplorer() {
  const [selected, setSelected] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const scenario = showcaseScenarios[selected]

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % showcaseScenarios.length; break
      case 'ArrowLeft': next = (index - 1 + showcaseScenarios.length) % showcaseScenarios.length; break
      case 'Home': next = 0; break
      case 'End': next = showcaseScenarios.length - 1; break
      default: return
    }
    event.preventDefault()
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return <section aria-labelledby="comparison-heading" className="min-w-0">
    <div className="section-heading"><div><p className="eyebrow">Explore the operating model</p><h2 id="comparison-heading" tabIndex={-1}>One experience. Two ways to run it.</h2></div><span className="illustration-label">Illustrated comparison</span></div>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Choose an everyday scenario. Follow the responsibilities behind the same calendar experience.</p>

    <div role="tablist" aria-label="Calendar implementation scenarios" className="scenario-tabs">
      {showcaseScenarios.map((item, index) => {
        const Icon = scenarioIcons[index]
        return <button type="button" key={item.id} ref={(node) => { tabs.current[index] = node }} role="tab" id={`scenario-${item.id}`} aria-controls="scenario-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onKeyDown={(event) => moveTab(event, index)} onClick={() => setSelected(index)} className="scenario-tab">
          <span className="flex items-center justify-between gap-3"><Icon className="size-4" aria-hidden="true" /><span className="font-mono text-[10px]" aria-hidden="true">0{index + 1}</span></span>
          <span>{item.shortTitle}</span>
        </button>
      })}
    </div>

    <div id="scenario-panel" role="tabpanel" aria-labelledby={`scenario-${scenario.id}`} tabIndex={0} className="scenario-panel">
      <div className="scenario-intro"><div className="flex items-start gap-3"><UserRound className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /><div><h3>{scenario.title}</h3><p>{scenario.employeeExperience}</p></div></div></div>
      <div className="approach-grid"><Approach managed={false} scenario={scenario} /><Approach managed scenario={scenario} /></div>
      <div className="operational-shift"><ArrowDownRight className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="eyebrow">What changes operationally</p><p className="mt-1 text-sm font-medium leading-relaxed">{scenario.shift}</p></div></div>
      <div className="retained-responsibility"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div><p className="font-medium">Still owned by your team</p><p className="mt-1 leading-relaxed">{scenario.retained}</p></div></div>

      <details className="implementation-details" key={scenario.id}>
        <summary><span>Look at the implementation</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></summary>
        <div className="implementation-body"><div className="grid gap-4 md:grid-cols-2">{[scenario.example.traditional, scenario.example.managed].map((example) => <div className="min-w-0" key={example.label}><p className="mb-2 text-xs font-medium text-muted-foreground">{example.label}</p><pre><code>{example.code}</code></pre></div>)}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{scenario.example.note}</p><a className="source-link mt-4" href={scenario.source.url} target="_blank" rel="noopener noreferrer">{scenario.source.label}<ExternalLink className="size-3" aria-hidden="true" /></a></div>
      </details>
    </div>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground"><p className="max-w-lg leading-relaxed">The enterprise baseline uses libraries such as MSAL and can reuse internal services. It does not require hand-written OAuth.</p><a href="#live-calendar" className="source-link shrink-0">Try the live application <ArrowRight className="size-3.5" aria-hidden="true" /></a></div>
  </section>
}
