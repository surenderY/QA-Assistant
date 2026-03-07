import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileSearch, FlaskConical, Play, Zap, Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/import',   icon: FileSearch,      label: 'JIRA Import' },
  { to: '/generate', icon: FlaskConical,    label: 'Test Generation' },
  { to: '/execute',  icon: Play,            label: 'Execution' },
]

function ThemeToggle() {
  const { theme, toggle, isDark } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Sun size={11} color={isDark ? 'var(--text-muted)' : 'var(--amber)'} />
      <button
        onClick={toggle}
        className="theme-toggle"
        data-on={!isDark}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        <div className="theme-toggle-knob" />
      </button>
      <Moon size={11} color={isDark ? 'var(--amber)' : 'var(--text-muted)'} />
    </div>
  )
}

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
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--amber)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={14} color="#fff" fill="#fff" />
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
            })}>
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer — theme toggle + phase progress */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Theme toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              THEME
            </span>
            <ThemeToggle />
          </div>

          {/* Phase progress */}
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
              PHASE 1–4 ACTIVE
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5,6].map(p => (
                <div key={p} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: p <= 4 ? 'var(--amber)' : 'var(--border)',
                }} />
              ))}
            </div>
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