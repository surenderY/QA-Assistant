import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download, RefreshCw, Trash2, ChevronRight,
  FileText, PenLine, CloudDownload, Plus, X
} from 'lucide-react'
import { importStory, listStories, getStory, deleteStory, retryImport } from '../api/client'
import api from '../api/client'
import { Badge, Button, Card, SectionHeader, EmptyState, Input, Spinner, Toast, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'

const createManualStory = (data) => api.post('/jira/stories/manual', data)

// ── Field components ────────────────────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {label}
        </label>
        {required && <span style={{ fontSize: '10px', color: 'var(--amber)' }}>*</span>}
        {hint && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '7px 10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
      }}
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        padding: '8px 10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        resize: 'vertical',
        lineHeight: 1.6,
      }}
    />
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Manual story form ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  story_id: '',
  title: '',
  description: '',
  story_type: 'Story',
  priority: 'Medium',
  assignee: '',
  reporter: '',
  jira_status: 'Open',
  project_key: '',
  ac_items: [''],   // local only — split out on submit
}

function ManualStoryForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const { toast } = useToast()

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  // AC item helpers
  const setAcItem = (i, val) => setForm(f => {
    const items = [...f.ac_items]
    items[i] = val
    return { ...f, ac_items: items }
  })
  const addAcItem = () => setForm(f => ({ ...f, ac_items: [...f.ac_items, ''] }))
  const removeAcItem = (i) => setForm(f => ({
    ...f,
    ac_items: f.ac_items.filter((_, idx) => idx !== i)
  }))

  const validate = () => {
    const e = {}
    if (!form.story_id.trim()) e.story_id = 'Required'
    if (!form.title.trim()) e.title = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: createManualStory,
    onSuccess: (res) => {
      onSuccess(res.data)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to create story')
    },
  })

  const handleSubmit = () => {
    if (!validate()) return
    mutation.mutate({
      story_id: form.story_id.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      acceptance_criteria_items: form.ac_items.filter(i => i.trim()),
      story_type: form.story_type,
      priority: form.priority,
      assignee: form.assignee.trim() || null,
      reporter: form.reporter.trim() || null,
      jira_status: form.jira_status,
      project_key: form.project_key.trim() || null,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Row 1: Story ID + Project Key */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="STORY ID" required hint="e.g. PROJ-42">
          <TextInput value={form.story_id} onChange={set('story_id')} placeholder="PROJ-42" mono />
          {errors.story_id && <span style={{ fontSize: '11px', color: 'var(--red)' }}>{errors.story_id}</span>}
        </Field>
        <Field label="PROJECT KEY" hint="auto-derived if blank">
          <TextInput value={form.project_key} onChange={set('project_key')} placeholder="PROJ" mono />
        </Field>
      </div>

      {/* Row 2: Title */}
      <Field label="TITLE" required>
        <TextInput value={form.title} onChange={set('title')} placeholder="As a user, I want to..." />
        {errors.title && <span style={{ fontSize: '11px', color: 'var(--red)' }}>{errors.title}</span>}
      </Field>

      {/* Row 3: Description */}
      <Field label="DESCRIPTION">
        <TextArea
          value={form.description}
          onChange={set('description')}
          placeholder="Describe the feature, context, and any relevant details..."
          rows={4}
        />
      </Field>

      {/* Row 4: Type + Priority + JIRA Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Field label="STORY TYPE">
          <SelectInput value={form.story_type} onChange={set('story_type')} options={[
            { value: 'Story', label: 'Story' },
            { value: 'Bug', label: 'Bug' },
            { value: 'Task', label: 'Task' },
            { value: 'Epic', label: 'Epic' },
            { value: 'Sub-task', label: 'Sub-task' },
          ]} />
        </Field>
        <Field label="PRIORITY">
          <SelectInput value={form.priority} onChange={set('priority')} options={[
            { value: 'Highest', label: 'Highest' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' },
            { value: 'Lowest', label: 'Lowest' },
          ]} />
        </Field>
        <Field label="JIRA STATUS">
          <SelectInput value={form.jira_status} onChange={set('jira_status')} options={[
            { value: 'Open', label: 'Open' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'In Review', label: 'In Review' },
            { value: 'Done', label: 'Done' },
            { value: 'Closed', label: 'Closed' },
          ]} />
        </Field>
      </div>

      {/* Row 5: Assignee + Reporter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="ASSIGNEE">
          <TextInput value={form.assignee} onChange={set('assignee')} placeholder="John Smith" />
        </Field>
        <Field label="REPORTER">
          <TextInput value={form.reporter} onChange={set('reporter')} placeholder="Jane Doe" />
        </Field>
      </div>

      {/* Row 6: Acceptance Criteria */}
      <Field label="ACCEPTANCE CRITERIA" hint="one criterion per line">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {form.ac_items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', minWidth: 32, textAlign: 'right' }}>
                AC{String(i + 1).padStart(2, '0')}
              </span>
              <input
                value={item}
                onChange={e => setAcItem(i, e.target.value)}
                placeholder={`Acceptance criterion ${i + 1}...`}
                style={{
                  flex: 1, padding: '7px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', fontSize: '13px', outline: 'none',
                }}
              />
              {form.ac_items.length > 1 && (
                <button onClick={() => removeAcItem(i)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '4px', display: 'flex',
                }}>
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={addAcItem} style={{ alignSelf: 'flex-start' }}>
            Add Criterion
          </Button>
        </div>
      </Field>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button icon={PenLine} loading={mutation.isPending} onClick={handleSubmit}>
          Create Story
        </Button>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function JiraImport() {
  const qc = useQueryClient()
  const { toasts, toast, remove } = useToast()
  const [storyInput, setStoryInput] = useState('')
  const [selectedStory, setSelectedStory] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('jira') // 'jira' | 'manual'

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
    onError: (err) => toast.error(err.response?.data?.detail || 'Import failed'),
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

  const handleManualSuccess = (result) => {
    toast.success(`Story ${result.story_id} created successfully`)
    setManualOpen(false)
    qc.invalidateQueries(['stories'])
  }

  const stories = data?.stories || []

  // ── Tab styles ─────────────────────────────────────────────────────────
  const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 16px',
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
    transition: 'all 0.15s',
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }} className="fade-in">
      <Toast toasts={toasts} remove={remove} />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ◈ JIRA INTEGRATION
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Story Import</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
              Import from JIRA or create stories manually
            </p>
          </div>
          <Button icon={PenLine} variant="secondary" onClick={() => setManualOpen(true)}>
            Create Manually
          </Button>
        </div>
      </div>

      {/* Input card with tabs */}
      <Card glow style={{ marginBottom: 24 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 18, marginLeft: -20, marginRight: -20, paddingLeft: 20 }}>
          <button style={tabStyle(activeTab === 'jira')} onClick={() => setActiveTab('jira')}>
            <CloudDownload size={12} /> IMPORT FROM JIRA
          </button>
          <button style={tabStyle(activeTab === 'manual')} onClick={() => setActiveTab('manual')}>
            <PenLine size={12} /> MANUAL ENTRY
          </button>
        </div>

        {activeTab === 'jira' ? (
          <>
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
              <Button onClick={handleImport} loading={importMutation.isPending} disabled={!storyInput.trim()} icon={Download}>
                Import Story
              </Button>
              <Button variant="secondary" onClick={() => refetch()} icon={RefreshCw}>Refresh</Button>
            </div>
            <div style={{ marginTop: 10, fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              The JIRA Fetch Agent pulls the story title, description, and acceptance criteria automatically.
            </div>
          </>
        ) : (
          <InlineManualForm onSuccess={handleManualSuccess} />
        )}
      </Card>

      {/* Stories table */}
      <Card>
        <SectionHeader
          title={`Imported Stories ${data ? `(${data.total})` : ''}`}
          subtitle="Click a row to view full story details"
          action={
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              AUTO-REFRESH 8s
            </div>
          }
        />

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : stories.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No stories yet"
            description="Import a JIRA story or create one manually above"
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['STORY ID', 'PROJECT', 'TITLE', 'PRIORITY', 'JIRA STATUS', 'STATE', 'SOURCE', 'ACTIONS'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px',
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)', letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stories.map(story => (
                <tr key={story.id}
                  onClick={() => { setSelectedStory(story.id); setDetailOpen(true) }}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
                    {story.story_id}
                  </td>
                  <td style={{ padding: '11px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {story.project_key}
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: '13px', maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{story.title}</div>
                  </td>
                  <td style={{ padding: '11px 10px' }}>
                    {story.priority ? <Badge status={story.priority.toLowerCase()} /> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {story.jira_status || '—'}
                  </td>
                  <td style={{ padding: '11px 10px' }}><Badge status={story.status} /></td>
                  <td style={{ padding: '11px 10px' }}>
                    <SourceBadge story={story} />
                  </td>
                  <td style={{ padding: '11px 10px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {story.title?.startsWith('[Importing') && (
                        <Button size="sm" variant="ghost" icon={RefreshCw}
                          onClick={() => retryMutation.mutate(story.id)}
                          loading={retryMutation.isPending}>
                          Retry
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={Trash2}
                        onClick={() => deleteMutation.mutate(story.id)} />
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

      {/* Manual create modal (full-page modal variant) */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Create Story Manually" width={700}>
        <ManualStoryForm onSuccess={handleManualSuccess} onCancel={() => setManualOpen(false)} />
      </Modal>
    </div>
  )
}

// ── Inline form (tab version — compact) ────────────────────────────────────

function InlineManualForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const { toasts, toast, remove } = useToast()

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))
  const setAcItem = (i, val) => setForm(f => { const items = [...f.ac_items]; items[i] = val; return { ...f, ac_items: items } })
  const addAcItem = () => setForm(f => ({ ...f, ac_items: [...f.ac_items, ''] }))
  const removeAcItem = (i) => setForm(f => ({ ...f, ac_items: f.ac_items.filter((_, idx) => idx !== i) }))

  const validate = () => {
    const e = {}
    if (!form.story_id.trim()) e.story_id = 'Required'
    if (!form.title.trim()) e.title = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: createManualStory,
    onSuccess: (res) => {
      setForm(EMPTY_FORM)
      onSuccess(res.data)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create story'),
  })

  const handleSubmit = () => {
    if (!validate()) return
    mutation.mutate({
      story_id: form.story_id.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      acceptance_criteria_items: form.ac_items.filter(i => i.trim()),
      story_type: form.story_type,
      priority: form.priority,
      assignee: form.assignee.trim() || null,
      reporter: form.reporter.trim() || null,
      jira_status: form.jira_status,
      project_key: form.project_key.trim() || null,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Toast toasts={toasts} remove={remove} />

      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div>
          <Field label="STORY ID" required>
            <TextInput value={form.story_id} onChange={set('story_id')} placeholder="PROJ-42" mono />
            {errors.story_id && <span style={{ fontSize: '10px', color: 'var(--red)' }}>{errors.story_id}</span>}
          </Field>
        </div>
        <div>
          <Field label="PROJECT KEY">
            <TextInput value={form.project_key} onChange={set('project_key')} placeholder="PROJ" mono />
          </Field>
        </div>
        <div>
          <Field label="PRIORITY">
            <SelectInput value={form.priority} onChange={set('priority')} options={[
              { value: 'Highest', label: 'Highest' }, { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' }, { value: 'Low', label: 'Low' }, { value: 'Lowest', label: 'Lowest' },
            ]} />
          </Field>
        </div>
        <div>
          <Field label="TYPE">
            <SelectInput value={form.story_type} onChange={set('story_type')} options={[
              { value: 'Story', label: 'Story' }, { value: 'Bug', label: 'Bug' },
              { value: 'Task', label: 'Task' }, { value: 'Epic', label: 'Epic' },
            ]} />
          </Field>
        </div>
      </div>

      {/* Title */}
      <Field label="TITLE" required>
        <TextInput value={form.title} onChange={set('title')} placeholder="As a user, I want to..." />
        {errors.title && <span style={{ fontSize: '10px', color: 'var(--red)' }}>{errors.title}</span>}
      </Field>

      {/* Description */}
      <Field label="DESCRIPTION">
        <TextArea value={form.description} onChange={set('description')}
          placeholder="Feature context, background, constraints..." rows={3} />
      </Field>

      {/* Acceptance Criteria */}
      <Field label="ACCEPTANCE CRITERIA">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {form.ac_items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', minWidth: 32, textAlign: 'right' }}>
                AC{String(i + 1).padStart(2, '0')}
              </span>
              <input value={item} onChange={e => setAcItem(i, e.target.value)}
                placeholder={`Criterion ${i + 1}...`}
                style={{ flex: 1, padding: '6px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '12px', outline: 'none' }}
              />
              {form.ac_items.length > 1 && (
                <button onClick={() => removeAcItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={addAcItem} style={{ alignSelf: 'flex-start' }}>
            Add Criterion
          </Button>
        </div>
      </Field>

      {/* Assignee / Reporter inline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="ASSIGNEE"><TextInput value={form.assignee} onChange={set('assignee')} placeholder="John Smith" /></Field>
        <Field label="REPORTER"><TextInput value={form.reporter} onChange={set('reporter')} placeholder="Jane Doe" /></Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={PenLine} loading={mutation.isPending} onClick={handleSubmit}>
          Create Story
        </Button>
      </div>
    </div>
  )
}

// ── Source badge ────────────────────────────────────────────────────────────

function SourceBadge({ story }) {
  const isManual = story.title?.startsWith('[Importing') === false && !story.raw_data?.jira_key
  // heuristic: if still importing, show JIRA, otherwise check raw_data source
  const source = story.title?.startsWith('[Importing') ? 'jira'
    : story.raw_data?.source === 'manual' ? 'manual'
    : story.raw_data ? 'jira'
    : 'manual'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 3,
      fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.06em',
      background: source === 'manual' ? 'var(--purple-dim)' : 'var(--blue-dim)',
      color: source === 'manual' ? 'var(--purple)' : 'var(--blue)',
      border: `1px solid ${source === 'manual' ? 'var(--purple)' : 'var(--blue)'}22`,
    }}>
      {source === 'manual' ? <PenLine size={9} /> : <CloudDownload size={9} />}
      {source === 'manual' ? 'MANUAL' : 'JIRA'}
    </span>
  )
}

// ── Story detail modal ──────────────────────────────────────────────────────

function StoryDetail({ story }) {
  const ac = story.acceptance_criteria
  const acItems = ac?.items || (ac?.raw ? [ac.raw] : [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge status={story.status} />
        {story.priority && <Badge status={story.priority.toLowerCase()} />}
        {story.story_type && <Badge custom={story.story_type.toUpperCase()} status="new" />}
        {story.raw_data?.source === 'manual' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 3, fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, background: 'var(--purple-dim)', color: 'var(--purple)' }}>
            <PenLine size={9} /> MANUAL
          </span>
        )}
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
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', minWidth: 24, marginTop: 1 }}>
                  AC{String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          ['JIRA ID', story.story_id],
          ['PROJECT', story.project_key],
          ['JIRA STATUS', story.jira_status || '—'],
          ['ASSIGNEE', story.assignee || '—'],
          ['REPORTER', story.reporter || '—'],
          ['CREATED', new Date(story.created_at).toLocaleString()],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}