import type { VisualSpec } from './types'

function Dots({ total, highlighted, label }: Extract<VisualSpec, { type: 'dots' }>) {
  return <div className="dot-visual" aria-label={`${highlighted} of ${total} ${label}`}>
    <div className="dot-grid">{Array.from({ length: total }, (_, index) => <i key={index} className={index < highlighted ? 'lit' : ''} />)}</div>
    <span><b>{highlighted}</b> {label} <em>/ {total} total</em></span>
  </div>
}

function Bar({ value, label, complementLabel }: Extract<VisualSpec, { type: 'bar' }>) {
  return <div className="bar-visual">
    <div className="probability-bar"><span style={{ width: `${value}%` }} /><i style={{ left: `${value}%` }} /></div>
    <div><span><b>{Math.round(value)}%</b> {label}</span><span>{complementLabel && <><b>{Math.round(100 - value)}%</b> {complementLabel}</>}</span></div>
  </div>
}

function Frequency({ total, truePositive, falsePositive, hypothesisLabel, evidenceLabel }: Extract<VisualSpec, { type: 'frequency' }>) {
  const signalTotal = truePositive + falsePositive
  return <div className="frequency-visual">
    <div className="frequency-equation">
      <div><span className="freq-swatch true" /><b>{truePositive}</b><small>{hypothesisLabel} + signal</small></div>
      <strong>+</strong>
      <div><span className="freq-swatch false" /><b>{falsePositive}</b><small>other + signal</small></div>
      <strong>=</strong>
      <div><span className="freq-swatch all" /><b>{signalTotal}</b><small>all {evidenceLabel}</small></div>
    </div>
    <div className="frequency-strip" aria-label={`${truePositive} true and ${falsePositive} false signals out of ${total}`}>
      <span className="true" style={{ width: `${signalTotal ? truePositive / signalTotal * 100 : 0}%` }} />
      <span className="false" style={{ width: `${signalTotal ? falsePositive / signalTotal * 100 : 0}%` }} />
    </div>
    <p>Among signal cases: <b>{truePositive}</b> / {signalTotal} are {hypothesisLabel}</p>
  </div>
}

function Table({ headers, rows }: Extract<VisualSpec, { type: 'table' }>) {
  return <div className="table-visual"><div /><b>{headers[0]}</b><b>{headers[1]}</b>{rows.map((row) => <div className="table-row" key={row.label}><strong>{row.label}</strong><span>{Number(row.values[0].toFixed(1))}%</span><span>{Number(row.values[1].toFixed(1))}%</span></div>)}</div>
}

function Sequence({ values, labels }: Extract<VisualSpec, { type: 'sequence' }>) {
  return <div className="sequence-visual">{values.map((value, index) => <div key={labels[index]}><span>{labels[index]}</span><i><em style={{ height: `${value}%` }} /></i><b>{value}%</b>{index < values.length - 1 && <strong>→</strong>}</div>)}</div>
}

function Ev({ options }: Extract<VisualSpec, { type: 'ev' }>) {
  return <div className="ev-visual">{options.map((item) => <div key={item.label}><b>{item.label}</b>{item.outcomes.map((outcome) => <span key={`${outcome.probability}-${outcome.payoff}`}><i style={{ width: `${outcome.probability}%` }} />{outcome.probability}% · {outcome.payoff < 0 ? '−' : '+'}£{Math.abs(outcome.payoff)}</span>)}</div>)}</div>
}

export function ProbabilityVisual({ spec }: { spec: VisualSpec }) {
  switch (spec.type) {
    case 'dots': return <Dots {...spec} />
    case 'bar': return <Bar {...spec} />
    case 'frequency': return <Frequency {...spec} />
    case 'table': return <Table {...spec} />
    case 'sequence': return <Sequence {...spec} />
    case 'ev': return <Ev {...spec} />
  }
}

