/**
 * ScriptViewerModal
 *
 * Two-tab modal:
 *   VIEW — react-syntax-highlighter with dark/light theme matching
 *   EDIT — textarea editor with line numbers, unsaved-change tracking,
 *           Python syntax validation on save (from backend), dirty indicator
 */

import { useState, useEffect, useRef } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Eye, PenLine, GitBranch, Save, RotateCcw, Copy, Check, AlertTriangle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateScriptContent } from '../api/client'
import { useTheme } from '../hooks/useTheme'
import { Button, Spinner } from './ui'

// ── Modal shell ────────────────────────────────────────────────────────────

export function ScriptViewerModal({ open, onClose, scriptContent, isLoading, planId }) {
  const [tab, setTab] = useState('view')
  const [copied, setCopied] = useState(false)

  // Reset to view tab whenever a new script is opened
  useEffect(() => { if (open) setTab('view') }, [open, scriptContent?.id])

  if (!open) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent?.content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', cursor: 'pointer',
    border: 'none', background: 'none',
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
    transition: 'all 0.15s',
  })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius-lg)', width: 900, maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow)',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--amber)' }}>
              {scriptContent?.script_name || '…'}
            </span>
            {scriptContent?.scenario_name && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                — {scriptContent.scenario_name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px', flexShrink: 0,
          }}>×</button>
        </div>

        {/* ── Git info bar ── */}
        {scriptContent?.is_committed && (
          <div style={{
            padding: '7px 20px', background: 'var(--green-dim)',
            borderBottom: '1px solid var(--green)22',
            display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          }}>
            <GitBranch size={12} color="var(--green)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)' }}>
              {scriptContent.branch_name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {scriptContent.commit_sha?.slice(0, 8)}
            </span>
            {scriptContent.git_path && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                {scriptContent.git_path}
              </span>
            )}
          </div>
        )}

        {/* ── Tabs + copy ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border)', paddingRight: 16, flexShrink: 0,
        }}>
          <div style={{ display: 'flex' }}>
            <button style={tabStyle(tab === 'view')} onClick={() => setTab('view')}>
              <Eye size={11} /> VIEW
            </button>
            <button style={tabStyle(tab === 'edit')} onClick={() => setTab('edit')}>
              <PenLine size={11} /> EDIT
            </button>
          </div>
          {tab === 'view' && scriptContent && (
            <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spinner />
            </div>
          ) : !scriptContent ? null : tab === 'view' ? (
            <ViewerPane content={scriptContent.content} />
          ) : (
            <EditorPane
              scriptContent={scriptContent}
              planId={planId}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Viewer pane ────────────────────────────────────────────────────────────

function ViewerPane({ content }) {
  const { isDark } = useTheme()

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <SyntaxHighlighter
        language="python"
        style={isDark ? vscDarkPlus : oneLight}
        showLineNumbers
        lineNumberStyle={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: isDark ? '#555' : '#aaa',
          paddingRight: 20,
          userSelect: 'none',
          minWidth: 40,
        }}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '12.5px',
          lineHeight: '1.7',
          fontFamily: '"IBM Plex Mono", monospace',
          background: isDark ? '#1e1e1e' : '#fafafa',
          padding: '20px 24px',
          minHeight: '100%',
        }}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
      >
        {content || ''}
      </SyntaxHighlighter>
    </div>
  )
}

// ── Editor pane ────────────────────────────────────────────────────────────

function EditorPane({ scriptContent, planId, onClose }) {
  const { isDark } = useTheme()
  const qc = useQueryClient()
  const textareaRef = useRef(null)

  const [editedContent, setEditedContent] = useState(scriptContent.content || '')
  const [syntaxError, setSyntaxError] = useState(null)
  const [saved, setSaved] = useState(false)

  const isDirty = editedContent !== scriptContent.content

  // Sync if a different script is opened
  useEffect(() => {
    setEditedContent(scriptContent.content || '')
    setSyntaxError(null)
    setSaved(false)
  }, [scriptContent.id])

  // Tab key inserts 4 spaces instead of changing focus
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const { selectionStart, selectionEnd } = e.target
      const val = editedContent
      const indent = '    '
      setEditedContent(val.slice(0, selectionStart) + indent + val.slice(selectionEnd))
      // Restore cursor after the indent
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = selectionStart + 4
          textareaRef.current.selectionEnd   = selectionStart + 4
        }
      })
    }
    // Ctrl/Cmd+S saves
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (isDirty) saveMutation.mutate()
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => updateScriptContent(scriptContent.id, editedContent),
    onSuccess: (res) => {
      setSyntaxError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Invalidate so the script list + content queries refresh
      qc.invalidateQueries(['scripts', planId])
      qc.invalidateQueries(['script-content'])
    },
    onError: (err) => {
      const detail = err.response?.data?.detail || 'Save failed'
      setSyntaxError(detail)
    },
  })

  const handleReset = () => {
    setEditedContent(scriptContent.content)
    setSyntaxError(null)
  }

  const lineCount = editedContent.split('\n').length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Editor toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Dirty indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isDirty ? 'var(--amber)' : saved ? 'var(--green)' : 'var(--border-bright)',
              transition: 'background 0.2s',
              boxShadow: isDirty ? '0 0 5px var(--amber)' : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
              {isDirty ? 'UNSAVED CHANGES' : saved ? 'SAVED' : 'NO CHANGES'}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            {lineCount} lines
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Python 3
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Ctrl+S to save
          </span>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={handleReset} disabled={!isDirty}>
            Reset
          </Button>
          <Button
            size="sm"
            variant={isDirty ? 'primary' : 'secondary'}
            icon={saved ? Check : Save}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty}
          >
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Syntax error banner */}
      {syntaxError && (
        <div style={{
          padding: '8px 16px', background: 'var(--red-dim)',
          borderBottom: '1px solid var(--red)44',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          flexShrink: 0,
        }}>
          <AlertTriangle size={13} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', lineHeight: 1.5 }}>
            {syntaxError}
          </span>
        </div>
      )}

      {/* Committed-content warning */}
      {scriptContent.is_committed && isDirty && (
        <div style={{
          padding: '7px 16px', background: 'var(--amber-glow)',
          borderBottom: '1px solid var(--amber-dim)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <AlertTriangle size={12} color="var(--amber)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)' }}>
            This script was committed. Saving will clear the commit — you'll need to re-commit.
          </span>
        </div>
      )}

      {/* Editor + line gutter */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Line numbers */}
        <div style={{
          width: 48, flexShrink: 0, overflow: 'hidden',
          background: isDark ? '#1a1a1e' : '#f0f0f4',
          borderRight: '1px solid var(--border)',
          padding: '20px 0',
          userSelect: 'none',
          textAlign: 'right',
        }}>
          {editedContent.split('\n').map((_, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              lineHeight: '1.7', paddingRight: 10,
              color: isDark ? '#454560' : '#bbbbd0',
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={e => { setEditedContent(e.target.value); setSyntaxError(null) }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '12.5px', lineHeight: '1.7',
            padding: '20px 24px',
            background: isDark ? '#1e1e1e' : '#fafafa',
            color: isDark ? '#d4d4d4' : '#24242f',
            overflowY: 'auto',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
          }}
        />
      </div>
    </div>
  )
}
