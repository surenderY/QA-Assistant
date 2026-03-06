import { Play, Construction } from 'lucide-react'
import { Card, EmptyState } from '../components/ui'

export default function Execution() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }} className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ◈ TEST RUNNER
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Execution</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
          Run test scripts and inspect results in real time
        </p>
      </div>

      <Card>
        <EmptyState
          icon={Construction}
          title="Phase 5 — Coming Soon"
          description="Execution engine, WebSocket live logs, and per-test results will be built in Phase 5"
        />
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 8, color: 'var(--amber)' }}>PLANNED FOR PHASE 5:</div>
          {[
            'Select generated scripts for batch execution',
            'POST /api/v1/execute/run triggers Execution Agent',
            'WebSocket live log streaming during test run',
            'Per-test results table (pass/fail/skip/error)',
            'Expandable stack traces for failures',
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 4 }}>› {item}</div>
          ))}
        </div>
      </Card>
    </div>
  )
}
