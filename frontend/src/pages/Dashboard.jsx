import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { FileSearch, FlaskConical, Code2, Play, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { getDashboardStats } from '../api/client'
import { StatCard, Card, Badge, SectionHeader, Spinner } from '../components/ui'

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboardStats().then(r => r.data),
    refetchInterval: 15000,
  })

  const stats = data?.totals || {}
  const execSummary = data?.execution_summary || {}
  const recentStories = data?.recent_stories || []

  const execChartData = [
    { name: 'Passed', value: execSummary.passed || 0, color: 'var(--green)' },
    { name: 'Failed', value: execSummary.failed || 0, color: 'var(--red)' },
  ]

  const passRate = (execSummary.passed || 0) + (execSummary.failed || 0) > 0
    ? Math.round((execSummary.passed / ((execSummary.passed || 0) + (execSummary.failed || 0))) * 100)
    : null

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ◈ OVERVIEW
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '0.02em' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
          AI-powered test automation — platform status
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Stories Imported"  value={isLoading ? null : stats.stories}      icon={FileSearch}   color="var(--blue)" />
        <StatCard label="Test Plans"        value={isLoading ? null : stats.test_plans}   icon={FlaskConical} color="var(--purple)" />
        <StatCard label="Test Scripts"      value={isLoading ? null : stats.test_scripts} icon={Code2}        color="var(--amber)" />
        <StatCard label="Executions"        value={isLoading ? null : stats.executions}   icon={Play}         color="var(--green)" />
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

        {/* Execution results chart */}
        <Card>
          <SectionHeader title="Execution Results" subtitle="Pass / fail breakdown" />
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : (execSummary.passed || 0) + (execSummary.failed || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              NO EXECUTIONS YET
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color="var(--green)" />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    {execSummary.passed || 0} passed
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={14} color="var(--red)" />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    {execSummary.failed || 0} failed
                  </span>
                </div>
                {passRate !== null && (
                  <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, color: passRate >= 80 ? 'var(--green)' : passRate >= 50 ? 'var(--amber)' : 'var(--red)' }}>
                    {passRate}%
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={execChartData} barSize={48}>
                  <XAxis dataKey="name" tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                    cursor={{ fill: 'var(--bg-overlay)' }}
                  />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {execChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Pipeline status */}
        <Card>
          <SectionHeader title="Pipeline Status" subtitle="Phase completion" />
          {[
            { phase: '01', label: 'Foundation & Setup',          done: true },
            { phase: '02', label: 'JIRA Agent & Import',         done: true },
            { phase: '03', label: 'Test Plan & Script Agents',   done: true },
            { phase: '04', label: 'Git Agent & Commit Flow',     done: true },
            { phase: '05', label: 'Execution Engine & Results',  done: false },
            { phase: '06', label: 'Dashboard & Polish',          done: false },
          ].map(({ phase, label, done }) => (
            <div key={phase} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                color: done ? 'var(--amber)' : 'var(--text-muted)',
                background: done ? 'var(--amber-glow)' : 'var(--bg-overlay)',
                padding: '2px 7px', borderRadius: 3,
              }}>
                {phase}
              </span>
              <span style={{ fontSize: '12px', color: done ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1 }}>
                {label}
              </span>
              {done
                ? <CheckCircle2 size={13} color="var(--green)" />
                : <Clock size={13} color="var(--text-muted)" />
              }
            </div>
          ))}
        </Card>
      </div>

      {/* Recent stories */}
      <Card>
        <SectionHeader title="Recent Activity" subtitle="Latest imported stories" />
        {isLoading ? (
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : recentStories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            NO STORIES IMPORTED YET — GO TO JIRA IMPORT
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['STORY ID', 'TITLE', 'STATUS', 'IMPORTED'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentStories.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber)' }}>{s.story_id}</td>
                  <td style={{ padding: '10px 10px', fontSize: '13px', maxWidth: 360 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  </td>
                  <td style={{ padding: '10px 10px' }}><Badge status={s.status} /></td>
                  <td style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
