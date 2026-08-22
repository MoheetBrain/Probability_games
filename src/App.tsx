import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProbabilityVisual } from './bayes/Visual'
import { hashString } from './bayes/random'
import { createProfile, createSession, probabilityLevel, selectQuestion, skillLabel, strongestMisconception, updateProfile } from './bayes/player'
import { clearProfile, loadProfile, saveProfile } from './bayes/storage'
import { SKILLS, type AnswerOption, type MisconceptionKey, type PlayerProfile, type Question, type SessionMode, type SessionState } from './bayes/types'
import './styles.css'

const misconceptionCopy: Record<MisconceptionKey, { title: string; body: string }> = {
  reverseConditional: { title: 'You reversed the conditional.', body: 'P(evidence | hypothesis) is not the same as P(hypothesis | evidence). Read the right side of the bar first.' },
  baseRateNeglect: { title: 'The base rate still matters.', body: 'Evidence updates the starting probability; it does not erase how rare the hypothesis was.' },
  denominatorNeglect: { title: 'Check the reference group.', body: 'Your numerator is plausible, but the denominator must contain every case allowed by the condition.' },
  independenceError: { title: 'Independence needs a reason.', body: 'Do not multiply probabilities unless the events are independent or the conditional probability is known.' },
  addMultiplyError: { title: 'AND and OR use different moves.', body: 'Independent AND usually multiplies. OR adds, then removes any double-counted overlap.' },
  complementError: { title: 'You found the other side.', body: 'An event and its complement sum to 100%. Subtract the given probability from the whole.' },
  payoffBias: { title: 'The jackpot pulled your eye.', body: 'Expected value weights every payoff by how often it happens. A larger prize can still be the worse bet.' },
}

function todaySeed(): number {
  return hashString(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()))
}

function nextSession(mode: SessionMode): SessionState {
  const seed = mode === 'daily' ? todaySeed() : (Date.now() ^ Math.floor(Math.random() * 1_000_000)) >>> 0
  return createSession(mode, seed)
}

function Header({ profile, session, onMode, onStats }: { profile: PlayerProfile; session: SessionState; onMode: (mode: SessionMode) => void; onStats: () => void }) {
  const accuracy = profile.questionsAnswered ? Math.round(profile.correct / profile.questionsAnswered * 100) : 0
  return <header className="bayes-header">
    <button className="brand" onClick={() => onMode(session.mode)} aria-label="Restart session">
      <span className="brand-mark"><i /><i /><i /></span>
      <span><strong>BAYES</strong><small>PROBABILITY, COMPRESSED</small></span>
    </button>
    <div className="mode-switch" aria-label="Game mode">
      <button className={session.mode === 'daily' ? 'active' : ''} onClick={() => onMode('daily')}>Daily 10</button>
      <button className={session.mode === 'endless' ? 'active' : ''} onClick={() => onMode('endless')}>Endless</button>
    </div>
    <button className="level-pill" onClick={onStats} aria-label="Open progress">
      <span>LEVEL</span><b>{probabilityLevel(profile)}</b><i>{accuracy}%</i>
    </button>
  </header>
}

function Progress({ session, profile }: { session: SessionState; profile: PlayerProfile }) {
  const progress = session.mode === 'daily' ? session.index / 10 * 100 : (session.index % 20) / 20 * 100
  return <div className="progress-row">
    <span>{session.mode === 'daily' ? `QUESTION ${Math.min(session.index + 1, 10)} OF 10` : `QUESTION ${session.index + 1}`}</span>
    <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
    <span className="flow"><b>FLOW ×{profile.flow.toFixed(profile.flow % 1 ? 1 : 0)}</b><i>🔥 {profile.streak}</i></span>
  </div>
}

function QuestionVisual({ question }: { question: Question }) {
  const spec = question.explanation.visual
  if (spec.type === 'frequency') {
    const denominator = spec.truePositive + spec.falsePositive
    return <div className="question-frequency-preview" aria-label="Natural frequency preview">
      <span>IMAGINE {spec.total.toLocaleString()} CASES</span>
      <div><i className="true" style={{ width: `${denominator ? spec.truePositive / denominator * 100 : 0}%` }} /><i className="false" /></div>
      <small><b>{spec.truePositive}</b> true signals <em>+</em> <b>{spec.falsePositive}</b> false signals</small>
    </div>
  }
  if (spec.type === 'bar' && question.kind === 'complement') return <ProbabilityVisual spec={{ ...spec, complementLabel: undefined }} />
  if (spec.type === 'dots' && question.difficulty <= 2) return <ProbabilityVisual spec={spec} />
  if (spec.type === 'sequence') return <ProbabilityVisual spec={spec} />
  if (spec.type === 'table' && ['evidence_strength', 'union_probability'].includes(question.kind)) return <ProbabilityVisual spec={spec} />
  return null
}

function HintRail({ hints, count, onHint }: { hints: string[]; count: number; onHint: () => void }) {
  return <div className="hint-rail">
    {count > 0 && <div className="hint-card"><span>HINT {count}</span><p>{hints[count - 1]}</p></div>}
    {count < hints.length && <button onClick={onHint}>✦ {count ? 'Another hint' : 'Need a hint?'}</button>}
  </div>
}

function Answers({ question, selected, locked, onAnswer }: { question: Question; selected?: AnswerOption; locked: boolean; onAnswer: (answer: AnswerOption) => void }) {
  return <div className="answer-grid" role="group" aria-label="Answer choices">
    {question.options.map((answer, index) => {
      const correct = answer.id === question.correctOptionId
      const state = locked ? correct ? 'correct' : selected?.id === answer.id ? 'wrong' : 'muted' : ''
      return <button key={answer.id} className={state} disabled={locked} onClick={() => onAnswer(answer)}>
        <span>{index + 1}</span><b>{answer.label}</b>{locked && correct && <i>✓</i>}{locked && selected?.id === answer.id && !correct && <i>×</i>}
      </button>
    })}
  </div>
}

function Feedback({ question, selected, correct, confidence, onConfidence, onNext }: { question: Question; selected: AnswerOption; correct: boolean; confidence?: 'low' | 'medium' | 'high'; onConfidence: (value: 'low' | 'medium' | 'high') => void; onNext: () => void }) {
  const diagnosis = selected.misconception ? misconceptionCopy[selected.misconception] : undefined
  return <section className={`feedback ${correct ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
    <div className="feedback-copy">
      <span className="result-icon">{correct ? '✓' : '↺'}</span>
      <div><small>{correct ? 'NICE READ' : 'LET’S TUNE IT'}</small><h2>{correct ? question.explanation.title : diagnosis?.title ?? 'Not quite.'}</h2><p>{correct ? question.explanation.body : diagnosis?.body ?? question.explanation.body}</p></div>
    </div>
    <div className="feedback-visual"><ProbabilityVisual spec={question.explanation.visual} /></div>
    <div className="takeaway"><span>KEEP</span><p>{question.explanation.takeaway}</p></div>
    <div className="feedback-actions">
      <div className="confidence"><span>HOW SURE WERE YOU?</span>{(['low', 'medium', 'high'] as const).map((value) => <button className={confidence === value ? 'active' : ''} key={value} onClick={() => onConfidence(value)}>{value}</button>)}</div>
      <button className="continue" onClick={onNext}>Continue <span>↗</span><kbd>ENTER</kbd></button>
    </div>
  </section>
}

function StatsPanel({ profile, onClose, onReset }: { profile: PlayerProfile; onClose: () => void; onReset: () => void }) {
  const accuracy = profile.questionsAnswered ? Math.round(profile.correct / profile.questionsAnswered * 100) : 0
  return <div className="panel-backdrop" onClick={onClose}><aside className="stats-panel" onClick={(event) => event.stopPropagation()}>
    <div className="panel-head"><span>YOUR MODEL</span><button onClick={onClose}>×</button></div>
    <div className="big-level"><small>PROBABILITY LEVEL</small><strong>{probabilityLevel(profile)}</strong><span>{profile.xp} XP</span></div>
    <div className="stat-trio"><div><b>{profile.questionsAnswered}</b><span>answered</span></div><div><b>{accuracy}%</b><span>accuracy</span></div><div><b>{profile.streak}</b><span>streak</span></div></div>
    <div className="skill-list">{SKILLS.map((skill) => <div key={skill}><span>{skillLabel(skill)}</span><i><em style={{ width: `${profile.skills[skill]}%` }} /></i><b>{Math.round(profile.skills[skill])}</b></div>)}</div>
    <button className="reset-progress" onClick={onReset}>Reset local progress</button>
  </aside></div>
}

function DailyComplete({ session, profile, onReplay, onEndless }: { session: SessionState; profile: PlayerProfile; onReplay: () => void; onEndless: () => void }) {
  const weak = strongestMisconception(profile)
  const counts = SKILLS.map((skill) => ({ skill, right: session.answers.filter((answer) => answer.skill === skill && answer.correct).length, total: session.answers.filter((answer) => answer.skill === skill).length })).filter((row) => row.total)
  return <main className="completion-card">
    <span className="completion-orbit">◌</span><small>DAILY 10 COMPLETE</small><h1>{session.score} <em>/ 10</em></h1><p>{session.score >= 8 ? 'Your probability instincts are sharpening.' : 'Useful mistakes. Your model just got better.'}</p>
    <div className="session-skills">{counts.map((row) => <div key={row.skill}><span>{skillLabel(row.skill)}</span><b>{row.right === row.total ? '↑↑' : row.right ? '↑' : '↺'}</b><small>{row.right}/{row.total}</small></div>)}</div>
    {weak && profile.misconceptions[weak] >= 1 && <div className="weakness"><span>NEXT TARGET</span><b>{misconceptionCopy[weak].title}</b><p>{misconceptionCopy[weak].body}</p></div>}
    <div className="complete-actions"><button onClick={onEndless}>Keep going <span>→</span></button><button onClick={onReplay}>Replay daily</button></div>
  </main>
}

export default function App() {
  const initialProfile = useMemo(() => loadProfile(), [])
  const [profile, setProfile] = useState<PlayerProfile>(initialProfile)
  const [session, setSession] = useState<SessionState>(() => nextSession('daily'))
  const [question, setQuestion] = useState<Question>(() => selectQuestion(initialProfile, todaySeed(), 0))
  const [selected, setSelected] = useState<AnswerOption | undefined>(undefined)
  const [hintCount, setHintCount] = useState(0)
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high' | undefined>(undefined)
  const [statsOpen, setStatsOpen] = useState(false)
  const startedAt = useRef(performance.now())
  const selectedRef = useRef<AnswerOption | undefined>(undefined)
  const profileRef = useRef(profile)

  useEffect(() => { profileRef.current = profile; saveProfile(profile) }, [profile])

  const correct = selected?.id === question.correctOptionId

  const changeMode = useCallback((mode: SessionMode) => {
    const next = nextSession(mode)
    setSession(next)
    setQuestion(selectQuestion(profileRef.current, next.seed, 0))
    setSelected(undefined); selectedRef.current = undefined; setHintCount(0); setConfidence(undefined); startedAt.current = performance.now()
  }, [])

  const answer = useCallback((choice: AnswerOption) => {
    if (selectedRef.current) return
    selectedRef.current = choice
    setSelected(choice)
  }, [])

  const advance = useCallback(() => {
    const choice = selectedRef.current
    if (!choice) return
    const wasCorrect = choice.id === question.correctOptionId
    const responseMs = Math.max(250, Math.round(performance.now() - startedAt.current))
    const nextProfile = updateProfile(profileRef.current, question, wasCorrect, responseMs, choice.misconception, hintCount, confidence)
    profileRef.current = nextProfile
    setProfile(nextProfile)
    const answerRecord = { questionId: question.id, correct: wasCorrect, skill: question.skill, misconception: choice.misconception }
    const nextIndex = session.index + 1
    const complete = session.mode === 'daily' && nextIndex >= 10
    const nextState = { ...session, index: nextIndex, score: session.score + (wasCorrect ? 1 : 0), complete, answers: [...session.answers, answerRecord] }
    setSession(nextState)
    if (!complete) setQuestion(selectQuestion(nextProfile, session.seed, nextIndex))
    setSelected(undefined); selectedRef.current = undefined; setHintCount(0); setConfidence(undefined); startedAt.current = performance.now()
  }, [confidence, hintCount, question, session])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (statsOpen) return
      if (!selectedRef.current && ['1', '2', '3', '4'].includes(event.key)) {
        const choice = question.options[Number(event.key) - 1]
        if (choice) answer(choice)
      } else if (selectedRef.current && event.key === 'Enter') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, answer, question, statsOpen])

  const reset = () => {
    clearProfile(); const fresh = createProfile(); profileRef.current = fresh; setProfile(fresh); setStatsOpen(false)
    const next = nextSession('daily'); setSession(next); setQuestion(selectQuestion(fresh, next.seed, 0)); setSelected(undefined); selectedRef.current = undefined
  }

  const progressStyle = useMemo(() => ({ '--skill-color': question.skill === 'bayes' ? '#ff8b5c' : '#77dfc4' } as React.CSSProperties), [question.skill])

  return <div className="bayes-app" style={progressStyle}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <Header profile={profile} session={session} onMode={changeMode} onStats={() => setStatsOpen(true)} />
    <Progress session={session} profile={profile} />
    {session.complete ? <DailyComplete session={session} profile={profile} onReplay={() => changeMode('daily')} onEndless={() => changeMode('endless')} /> : <main className={`game-shell ${selected ? 'answered' : ''}`}>
      <section className="question-card">
        <div className="question-meta"><span>{question.eyebrow}</span><b>{skillLabel(question.skill)}</b><i>LV {question.difficulty}</i></div>
        <div className="question-body">
          {question.notation && <div className="notation">{question.notation}</div>}
          <h1>{question.prompt}</h1>
          {question.detail && <p>{question.detail}</p>}
          <QuestionVisual question={question} />
        </div>
        <Answers question={question} selected={selected} locked={Boolean(selected)} onAnswer={answer} />
        {!selected && <HintRail hints={question.hints} count={hintCount} onHint={() => setHintCount((count) => Math.min(question.hints.length, count + 1))} />}
        {!selected && <div className="keyboard-hint"><span>KEYS</span> 1–4 to answer</div>}
      </section>
      {selected && <Feedback question={question} selected={selected} correct={Boolean(correct)} confidence={confidence} onConfidence={setConfidence} onNext={advance} />}
    </main>}
    <footer><span>LEARN THE SHAPE, NOT THE SCRIPT.</span><i>●</i><span>LOCAL PROGRESS · NO HEARTS · NO TIMER</span></footer>
    {statsOpen && <StatsPanel profile={profile} onClose={() => setStatsOpen(false)} onReset={reset} />}
  </div>
}
