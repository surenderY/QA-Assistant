import { Loader2 } from 'lucide-react'

// ── Badge ──────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  new:       { bg: 'var(--blue-dim)',   color: 'var(--blue)',   label: 'NEW' },
  planned:   { bg: 'var(--purple-dim)', color: 'var(--purple)', label: 'PLANNED' },
  scripted:  { bg: 'var(--amber-glow)', color: 'var(--amber)',  label: 'SCRIPTED' },
  executed:  { bg: 'var(--green-dim)',  color: 'var(--green)',  label: 'EXECUTED' },
  passed:    { bg: 'var(--green-dim)',  color: 'var(--green)',  label: 'PASSED' },
  failed:    { bg: 'var(--red-dim)',    color: 'var(--red)',    label: 'FAILED' },
  importing: { bg: 'var(--blue-dim)',   color: 'var(--blue)',   label: 'IMPORTING' },
  high:      { bg: 'var(--red-dim)',    color: 'var(--red)',    label: 'HIGH' },
  medium:    { bg: 'var(--amber-glow)', color: 'var(--amber)',  label: 'MEDIUM' },
  low:       { bg: 'var(--green-dim)',  color: 'var(--green)',  label: 'LOW' },
  unit:         { bg: 'var(--blue-dim)',   color: 'var(--blue)',   label: 'UNIT' },
  integration:  { bg: 'var(--purple-dim)', color: 'var(--purple)', label: 'INTEGRATION' },
  e2e:          { bg: 'var(--amber-glow)', color: 'var(--amber)',  label: 'E2E' },
  api:          { bg: 'var(--green-dim)',  color: 'var(--green)',  label: 'API' },
  security:     { bg: 'var(--red-dim)',    color: 'var(--red)',    label: 'SECURITY' },
  performance:  { bg: 'var(--blue-dim)',   color: 'var(--blue)',   label: 'PERF' },
}

export function Badge({ status, custom }) {
  const s = STATUS_STYLES[status?.toLowerCase()] || {
    bg: 'var(--bg-overlay)', color: 'var(--text-secondary)', label: status?.toUpperCase() || '—'
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '3px',
      fontSize: '10px', fontFamily: 'var(--font-mono)',
      fontWeight: 600, letterSpacing: '0.08em',
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}22`,
      whiteSpace: 'nowrap',
    }}>
      {custom || s.label}
    </span>
  )
}

// ── Button ─────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, loading, icon: Icon, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.04em',
    border: '1px solid transparent', borderRadius: 'var(--radius)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  }
  const sizes = { sm: { padding: '4px 10px', fontSize: '11px' }, md: { padding: '7px 14px', fontSize: '12px' }, lg: { padding: '10px 20px', fontSize: '13px' } }
  const variants = {
    primary:  { background: 'var(--amber)', color: '#0c0c0d', borderColor: 'var(--amber)' },
    secondary:{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-bright)' },
    ghost:    { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'transparent' },
    danger:   { background: 'var(--red-dim)', color: 'var(--red)', borderColor: 'var(--red)44' },
    success:  { background: 'var(--green-dim)', color: 'var(--green)', borderColor: 'var(--green)44' },
  }
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {loading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : Icon ? <Icon size={12} /> : null}
      {children}
    </button>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, onClick, glow }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${glow ? 'var(--amber-dim)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)', padding: '20px',
      boxShadow: glow ? 'var(--shadow-amber)' : 'var(--shadow-sm)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = 'var(--amber)', sub }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
            {label.toUpperCase()}
          </div>
          <div style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', fontWeight: 600, color, lineHeight: 1 }}>
            {value ?? <span className="skeleton" style={{ display:'inline-block', width:48, height:32 }} />}
          </div>
          {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
        </div>
        {Icon && (
          <div style={{ background: `${color}15`, borderRadius: 'var(--radius)', padding: 10, color }}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Section header ─────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
      {Icon && <Icon size={36} style={{ marginBottom: 16, opacity: 0.4 }} />}
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: '12px', marginBottom: 20 }}>{description}</div>}
      {action}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = 'var(--amber)' }) {
  return (
    <Loader2 size={size} style={{ animation: 'spin 0.8s linear infinite', color }} />
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────
export function Toast({ toasts, remove }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="fade-in" onClick={() => remove(t.id)} style={{
          padding: '10px 16px', borderRadius: 'var(--radius)',
          background: t.type === 'error' ? '#2a1010' : t.type === 'success' ? '#0f2a1a' : 'var(--bg-elevated)',
          border: `1px solid ${t.type === 'error' ? 'var(--red)' : t.type === 'success' ? 'var(--green)' : 'var(--border-bright)'}`,
          color: t.type === 'error' ? 'var(--red)' : t.type === 'success' ? 'var(--green)' : 'var(--text-primary)',
          fontSize: '12px', fontFamily: 'var(--font-mono)',
          cursor: 'pointer', maxWidth: 360, boxShadow: 'var(--shadow)',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 600 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius-lg)', width, maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px',
          }}>×</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Input ──────────────────────────────────────────────────────────────────
export function Input({ value, onChange, onKeyDown, placeholder, prefix, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)', overflow: 'hidden', ...style }}>
      {prefix && (
        <span style={{ padding: '0 10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
          {prefix}
        </span>
      )}
      <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          flex: 1, padding: '8px 12px', background: 'none', border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px',
        }}
      />
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'var(--amber)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ background: 'var(--bg-overlay)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  )
}
