import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Download, RefreshCw, Trash2, ChevronRight, AlertCircle, FileText } from 'lucide-react'
import { importStory, listStories, getStory, deleteStory, retryImport } from '../api/client'
import { Badge, Button, Card, SectionHeader, EmptyState, Input, Spinner, Toast, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'

export default function JiraImport() {
  const qc = useQueryClient()
  const { toasts, toast, remove } = useToast()
  const [storyInput, setStoryInput] = useState('')
  const [selectedStory, setSelectedStory] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stories'],
    queryFn: () => listStories().then(r => r.data),
    refetchInterval: 8000,
  })

  const { data: storyDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['story', selectedStory],
    queryFn: () => getStory(selectedStory).then(r => r.data),
    enabled: !!selectedStory && detailOpen,
  })

  const importMutation = useMutation({
    mutationFn: (id) => importStory(id),
    onSuccess: (res) => {
      toast.success(`Import queued for ${res.data.story_id}`)
      setStoryInput('')
      setTimeout(() => qc.invalidateQueries(['stories']), 2000)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Import failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStory,
    onSuccess: () => { toast.success('Story deleted'); qc.invalidateQueries(['stories']) },
    onError: () => toast.error('Delete failed'),
  })

  const retryMutation = useMutation({
    mutationFn: retryImport,
    onSuccess: () => { toast.success('Retry queued'); qc.invalidateQueries(['stories']) },
    onError: () => toast.error('Retry failed'),
  })

  const handleImport = () => {
    const id = storyInput.trim().toUpperCase()
    if (!id) return
    importMutation.mutate(id)
  }

  const stories = data?.stories || []

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }} className="fade-in">
      <Toast toasts={toasts} remove={remove} />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ◈ JIRA INTEGRATION
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Story Import</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
          Import user stories from JIRA — the AI agent fetches and structures the data automatically
        </p>
      </div>

      {/* Import input */}
      <Card glow style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>
          IMPORT NEW STORY
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Input
            value={storyInput}
            onChange={setStoryInput}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="e.g. PROJ-123"
            prefix="STORY ID"
            style={{ flex: 1, maxWidth: 400 }}
          />
          <Button
            onClick={handleImport}
            loading={importMutation.isPending}
            disabled={!storyInput.trim()}
            icon={Download}
          >
            Import Story
          </Button>
          <Button variant="secondary" onClick={() => refetch()} icon={RefreshCw}>
            Refresh
          </Button>
        </div>
        <div style={{ marginTop: 10, fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          The JIRA Fetch Agent will pull the story title, description, and acceptance criteria automatically.
          Poll the list below to see when import completes.
        </div>
      </Card>

      {/* Stories table */}
      <Card>
        <SectionHeader
          title={`Imported Stories ${data ? `(${data.total})` : ''}`}
          subtitle="Click a row to view full story details"
          action={
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              AUTO-REFRESH: 8s
            </div>
          }
        />

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : stories.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No stories imported yet"
            description="Enter a JIRA story ID above to get started"
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['STORY ID', 'PROJECT', 'TITLE', 'PRIORITY', 'JIRA STATUS', 'STATE', 'ACTIONS'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px',
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)', letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stories.map(story => (
                <tr key={story.id}
                  onClick={() => { setSelectedStory(story.id); setDetailOpen(true) }}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
                    {story.story_id}
                  </td>
                  <td style={{ padding: '11px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {story.project_key}
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: '13px', maxWidth: 300 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {story.title}
                    </div>
                  </td>
                  <td style={{ padding: '11px 10px' }}>
                    {story.priority ? <Badge status={story.priority.toLowerCase()} /> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {story.jira_status || '—'}
                  </td>
                  <td style={{ padding: '11px 10px' }}>
                    <Badge status={story.status} />
                  </td>
                  <td style={{ padding: '11px 10px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {story.title.startsWith('[Importing') && (
                        <Button size="sm" variant="ghost" icon={RefreshCw}
                          onClick={() => retryMutation.mutate(story.id)}
                          loading={retryMutation.isPending}>
                          Retry
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={Trash2}
                        onClick={() => deleteMutation.mutate(story.id)}
                        loading={deleteMutation.isPending} />
                      <Button size="sm" variant="ghost" icon={ChevronRight}
                        onClick={() => { setSelectedStory(story.id); setDetailOpen(true) }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Story detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Story Details" width={700}>
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : storyDetail ? (
          <StoryDetail story={storyDetail} />
        ) : null}
      </Modal>
    </div>
  )
}

function StoryDetail({ story }) {
  const ac = story.acceptance_criteria
  const acItems = ac?.items || (ac?.raw ? [ac.raw] : [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge status={story.status} />
        {story.priority && <Badge status={story.priority.toLowerCase()} />}
        {story.story_type && <Badge custom={story.story_type.toUpperCase()} status="new" />}
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>TITLE</div>
        <div style={{ fontSize: '15px', fontWeight: 500 }}>{story.title}</div>
      </div>

      {story.description && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>DESCRIPTION</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {story.description}
          </div>
        </div>
      )}

      {acItems.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
            ACCEPTANCE CRITERIA ({acItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {acItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 12px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', minWidth: 24, marginTop: 1 }}>
                  AC{String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          ['JIRA ID', story.story_id],
          ['PROJECT', story.project_key],
          ['JIRA STATUS', story.jira_status || '—'],
          ['ASSIGNEE', story.assignee || '—'],
          ['REPORTER', story.reporter || '—'],
          ['IMPORTED', new Date(story.created_at).toLocaleString()],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
