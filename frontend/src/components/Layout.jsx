import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileSearch, FlaskConical, Play, Zap } from 'lucide-react'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/import',   icon: FileSearch,      label: 'JIRA Import' },
  { to: '/generate', icon: FlaskConical,    label: 'Test Generation' },
  { to: '/execute',  icon: Play,            label: 'Execution' },
]

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--amber)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={14} color="#0c0c0d" fill="#0c0c0d" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', letterSpacing: '0.05em' }}>
                TESTGEN
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.15em' }}>
                AI PLATFORM
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 'var(--radius)',
              textDecoration: 'none', marginBottom: 2,
              fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--amber)' : 'var(--text-secondary)',
              background: isActive ? 'var(--amber-glow)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--amber)' : '2px solid transparent',
              transition: 'all 0.12s',
            })}>
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            PHASE 1–3 ACTIVE
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[1,2,3,4,5,6].map(p => (
              <div key={p} style={{
                height: 3, flex: 1, borderRadius: 2,
                background: p <= 3 ? 'var(--amber)' : 'var(--border)',
              }} />
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        {children}
      </main>
    </div>
  )
}
