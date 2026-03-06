import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Code2, ChevronDown, ChevronRight, Play,
  FileCode, Sparkles, CheckSquare, Square, GitBranch,
  GitCommit, Upload, Check, RefreshCw
} from 'lucide-react'
import {
  listStories, generateTestPlan, getTestPlan,
  generateScripts, listScripts, getScriptContent
} from '../api/client'
import api from '../api/client'
import { Badge, Button, Card, SectionHeader, EmptyState, Spinner, Toast, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'

// ── Extra API calls for Phase 4 ───────────────────────────────────────────
const commitBatch = (planId, scriptIds, storyDbId) =>
  api.post(`/scripts/commit-batch/${planId}`, { script_ids: scriptIds, story_db_id: storyDbId })
const getRepoStatus = () => api.get('/scripts/repo/status')

export default function TestGeneration() {
  const qc = useQueryClient()
  const { toasts, toast, remove } = useToast()
  const [selectedStory, setSelectedStory] = useState(null)
  const [expandedScenarios, setExpandedScenarios] = useState({})
  const [selectedScenarioIds, setSelectedScenarioIds] = useState([])
  const [selectedScriptIds, setSelectedScriptIds] = useState([])
  const [scriptModal, setScriptModal] = useState(null)
  const [commitModalOpen, setCommitModalOpen] = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: () => listStories().then(r => r.data),
  })

  const { data: planData, isLoading: planLoading, refetch: refetchPlan } = useQuery({
    queryKey: ['testplan', selectedStory],
    queryFn: () => getTestPlan(selectedStory).then(r => r.data),
    enabled: !!selectedStory,
    retry: false,
  })

  const { data: scriptsData, isLoading: scriptsLoading, refetch: refetchScripts } = useQuery({
    queryKey: ['scripts', planData?.id],
    queryFn: () => listScripts(planData?.id).then(r => r.data),
    enabled: !!planData?.id,
    refetchInterval: 10000,
  })

  const { data: scriptContent, isLoading: contentLoading } = useQuery({
    queryKey: ['script-content', scriptModal?.planId, scriptModal?.id],
    queryFn: () => getScriptContent(scriptModal?.planId, scriptModal?.id).then(r => r.data),
    enabled: !!scriptModal,
  })

  const { data: repoStatus } = useQuery({
    queryKey: ['repo-status'],
    queryFn: () => getRepoStatus().then(r => r.data),
    retry: false,
    throwOnError: false,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const generatePlanMutation = useMutation({
    mutationFn: generateTestPlan,
    onSuccess: () => {
      toast.success('Test plan generation started — allow 30–60s')
      const poll = (ms) => setTimeout(() => { qc.invalidateQueries(['testplan', selectedStory]); refetchPlan() }, ms)
      ;[5000, 15000, 30000, 60000].forEach(poll)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Generation failed'),
  })

  const generateScriptsMutation = useMutation({
    mutationFn: ({ planId, ids }) => generateScripts(planId, ids?.length ? ids : null),
    onSuccess: () => {
      toast.success('Script generation started — allow 60–120s')
      const poll = (ms) => setTimeout(() => { qc.invalidateQueries(['scripts', planData?.id]); refetchScripts() }, ms)
      ;[10000, 30000, 60000, 120000].forEach(poll)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Script generation failed'),
  })

  const commitMutation = useMutation({
    mutationFn: ({ planId, ids, storyId }) => commitBatch(planId, ids, storyId),
    onSuccess: (res) => {
      toast.success(`Git commit queued — GitAgent creating feature branch`)
      setCommitModalOpen(false)
      setSelectedScriptIds([])
      const poll = (ms) => setTimeout(() => { qc.invalidateQueries(['scripts', planData?.id]); refetchScripts() }, ms)
      ;[5000, 15000, 30000].forEach(poll)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Commit failed'),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleScenario = (id) => setExpandedScenarios(p => ({ ...p, [id]: !p[id] }))
  const toggleScenarioSelect = (id) => setSelectedScenarioIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleScriptSelect = (id) => setSelectedScriptIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAllScenarios = (scenarios) => {
    const ids = scenarios.map(s => s.id)
    setSelectedScenarioIds(p => p.length === ids.length ? [] : ids)
  }
  const toggleAllScripts = (scripts) => {
    const uncommitted = scripts.filter(s => !s.is_committed).map(s => s.id)
    setSelectedScriptIds(p => p.length === uncommitted.length ? [] : uncommitted)
  }

  const stories = storiesData?.stories?.filter(s => !s.title.startsWith('[Importing')) || []
  const scenarios = planData?.scenarios || []
  const scripts = scriptsData?.scripts || []
  const uncommittedScripts = scripts.filter(s => !s.is_committed)
  const committedScripts = scripts.filter(s => s.is_committed)

  const selectedStoryObj = stories.find(s => s.id === selectedStory)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }} className="fade-in">
      <Toast toasts={toasts} remove={remove} />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ◈ AI AGENTS — PHASES 2–4
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Test Generation</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
              Import → Plan → Scripts → Git commit
            </p>
          </div>
          {/* Repo status pill */}
          {repoStatus && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            }}>
              <GitBranch size={12} color="var(--amber)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {repoStatus.current_branch}
              </span>
              {repoStatus.has_remote && (
                <span style={{ fontSize: '10px', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>● REMOTE</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Story selector */}
        <Card style={{ padding: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>
            SELECT STORY
          </div>
          {stories.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No stories imported yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stories.map(s => (
                <div key={s.id} onClick={() => { setSelectedStory(s.id); setSelectedScenarioIds([]); setSelectedScriptIds([]) }}
                  style={{
                    padding: '9px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    border: '1px solid', transition: 'all 0.12s',
                    borderColor: selectedStory === s.id ? 'var(--amber)' : 'var(--border)',
                    background: selectedStory === s.id ? 'var(--amber-glow)' : 'var(--bg-elevated)',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', fontWeight: 600, marginBottom: 2 }}>
                    {s.story_id}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </div>
                  <div style={{ marginTop: 4 }}><Badge status={s.status} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedStory ? (
            <Card><EmptyState icon={FlaskConical} title="Select a story to begin" description="Choose a story from the left panel" /></Card>
          ) : (
            <>
              {/* ── Test Plan ─────────────────────────────────────── */}
              <Card>
                <SectionHeader
                  title="Test Plan"
                  subtitle={planData ? `${scenarios.length} scenarios` : 'Not generated yet'}
                  action={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="secondary" onClick={() => refetchPlan()} icon={RefreshCw} />
                      <Button size="sm" loading={generatePlanMutation.isPending} icon={Sparkles}
                        onClick={() => generatePlanMutation.mutate(selectedStory)}
                        disabled={!!planData}>
                        {planData ? 'Plan Generated' : 'Generate Plan'}
                      </Button>
                    </div>
                  }
                />

                {planLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'var(--text-muted)' }}>
                    <Spinner size={16} /><span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Loading...</span>
                  </div>
                ) : !planData ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '10px 0' }}>
                    {generatePlanMutation.isPending ? '⟳ GENERATING TEST PLAN...' : 'Click "Generate Plan" to start'}
                  </div>
                ) : (
                  <>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 6 }}>{planData.title}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {(planData.test_types || []).map(t => <Badge key={t} status={t} />)}
                      </div>
                      {planData.scope && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{planData.scope}</div>}
                    </div>

                    {scenarios.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                        ⚠ NO SCENARIOS — delete this plan and regenerate
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                            SCENARIOS ({scenarios.length})
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => toggleAllScenarios(scenarios)}>
                            {selectedScenarioIds.length === scenarios.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {scenarios.map(sc => (
                            <ScenarioCard key={sc.id} scenario={sc}
                              expanded={expandedScenarios[sc.id]}
                              selected={selectedScenarioIds.includes(sc.id)}
                              onToggleExpand={() => toggleScenario(sc.id)}
                              onToggleSelect={() => toggleScenarioSelect(sc.id)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </Card>

              {/* ── Scripts ───────────────────────────────────────── */}
              {planData && scenarios.length > 0 && (
                <Card>
                  <SectionHeader
                    title="Test Scripts"
                    subtitle={scripts.length > 0 ? `${scripts.length} total — ${committedScripts.length} committed` : 'Not generated yet'}
                    action={
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button size="sm" variant="secondary" onClick={() => refetchScripts()} icon={RefreshCw} />
                        <Button size="sm" loading={generateScriptsMutation.isPending} icon={Code2}
                          onClick={() => generateScriptsMutation.mutate({ planId: planData.id, ids: selectedScenarioIds })}>
                          {selectedScenarioIds.length > 0 ? `Generate ${selectedScenarioIds.length}` : 'Generate All'}
                        </Button>
                        {uncommittedScripts.length > 0 && (
                          <Button size="sm" variant="success" icon={GitCommit}
                            onClick={() => setCommitModalOpen(true)}>
                            Commit to Git
                          </Button>
                        )}
                      </div>
                    }
                  />

                  {scriptsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}><Spinner size={16} /></div>
                  ) : scripts.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '8px 0' }}>
                      {generateScriptsMutation.isPending ? '⟳ GENERATING PYTEST SCRIPTS...' : 'Click "Generate All" to create scripts'}
                    </div>
                  ) : (
                    <>
                      {uncommittedScripts.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                              UNCOMMITTED ({uncommittedScripts.length})
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => toggleAllScripts(scripts)}>
                              {selectedScriptIds.length === uncommittedScripts.length ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {uncommittedScripts.map(s => (
                              <ScriptRow key={s.id} script={s}
                                selected={selectedScriptIds.includes(s.id)}
                                onToggleSelect={() => toggleScriptSelect(s.id)}
                                onView={() => setScriptModal({ id: s.id, planId: planData.id, name: s.script_name })}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {committedScripts.length > 0 && (
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>
                            COMMITTED ({committedScripts.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {committedScripts.map(s => (
                              <ScriptRow key={s.id} script={s} committed
                                onView={() => setScriptModal({ id: s.id, planId: planData.id, name: s.script_name })}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Script content modal ── */}
      <Modal open={!!scriptModal} onClose={() => setScriptModal(null)} title={scriptModal?.name || 'Script'} width={820}>
        {contentLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : scriptContent ? (
          <>
            {scriptContent.is_committed && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '8px 12px', background: 'var(--green-dim)', border: '1px solid var(--green)44', borderRadius: 'var(--radius)' }}>
                <GitBranch size={13} color="var(--green)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)' }}>
                  {scriptContent.branch_name} · {scriptContent.commit_sha?.slice(0, 8)}
                </span>
                {scriptContent.git_path && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {scriptContent.git_path}
                  </span>
                )}
              </div>
            )}
            <pre className="code-block" style={{ maxHeight: 520 }}>{scriptContent.content}</pre>
          </>
        ) : null}
      </Modal>

      {/* ── Commit modal ── */}
      <Modal open={commitModalOpen} onClose={() => setCommitModalOpen(false)} title="Commit Scripts to Git" width={580}>
        <CommitModal
          uncommittedScripts={uncommittedScripts}
          selectedScriptIds={selectedScriptIds}
          onToggle={toggleScriptSelect}
          onToggleAll={() => toggleAllScripts(scripts)}
          onCommit={() => {
            const ids = selectedScriptIds.length > 0 ? selectedScriptIds : uncommittedScripts.map(s => s.id)
            commitMutation.mutate({ planId: planData.id, ids, storyId: selectedStory })
          }}
          loading={commitMutation.isPending}
          repoStatus={repoStatus}
          storyId={selectedStoryObj?.story_id}
        />
      </Modal>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScenarioCard({ scenario, expanded, selected, onToggleExpand, onToggleSelect }) {
  return (
    <div style={{
      border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      background: selected ? 'var(--amber-glow)' : 'var(--bg-elevated)',
      overflow: 'hidden', transition: 'all 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}>
        <div onClick={e => { e.stopPropagation(); onToggleSelect() }} style={{ color: selected ? 'var(--amber)' : 'var(--text-muted)', flexShrink: 0 }}>
          {selected ? <CheckSquare size={13} /> : <Square size={13} />}
        </div>
        <div onClick={onToggleExpand} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', minWidth: 44 }}>{scenario.id}</span>
          <span style={{ fontSize: '12px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scenario.name}</span>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <Badge status={scenario.test_type} />
            <Badge status={scenario.priority} />
          </div>
          {expanded ? <ChevronDown size={12} color="var(--text-muted)" /> : <ChevronRight size={12} color="var(--text-muted)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scenario.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{scenario.description}</div>}
          {scenario.steps?.length > 0 && <ScenarioSection title="STEPS" items={scenario.steps} color="var(--blue)" numbered />}
          {scenario.expected_results?.length > 0 && <ScenarioSection title="EXPECTED RESULTS" items={scenario.expected_results} color="var(--green)" />}
          {scenario.preconditions?.length > 0 && <ScenarioSection title="PRECONDITIONS" items={scenario.preconditions} color="var(--purple)" />}
          {scenario.edge_cases?.length > 0 && <ScenarioSection title="EDGE CASES" items={scenario.edge_cases} color="var(--amber)" />}
        </div>
      )}
    </div>
  )
}

function ScenarioSection({ title, items, color, numbered }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 5 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, minWidth: 20, flexShrink: 0 }}>{numbered ? `${i+1}.` : '›'}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScriptRow({ script, committed, selected, onToggleSelect, onView }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 'var(--radius)',
      border: `1px solid ${selected ? 'var(--amber)' : committed ? 'var(--green)22' : 'var(--border)'}`,
      background: selected ? 'var(--amber-glow)' : committed ? 'var(--green-dim)' : 'var(--bg-elevated)',
      transition: 'all 0.12s',
    }}>
      {!committed && onToggleSelect && (
        <div onClick={onToggleSelect} style={{ color: selected ? 'var(--amber)' : 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
          {selected ? <CheckSquare size={13} /> : <Square size={13} />}
        </div>
      )}
      {committed && <Check size={13} color="var(--green)" style={{ flexShrink: 0 }} />}
      <FileCode size={13} color={committed ? 'var(--green)' : 'var(--amber)'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: committed ? 'var(--green)' : 'var(--amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {script.script_name}
        </div>
        {script.scenario_name && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>{script.scenario_name}</div>
        )}
        {committed && script.branch_name && (
          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)' }}>
              <GitBranch size={9} style={{ display: 'inline', marginRight: 3 }} />{script.branch_name}
            </span>
            {script.commit_sha && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                {script.commit_sha}
              </span>
            )}
          </div>
        )}
      </div>
      <Button size="sm" variant="ghost" icon={Play} onClick={onView}>View</Button>
    </div>
  )
}

function CommitModal({ uncommittedScripts, selectedScriptIds, onToggle, onToggleAll, onCommit, loading, repoStatus, storyId }) {
  const toCommit = selectedScriptIds.length > 0 ? selectedScriptIds : uncommittedScripts.map(s => s.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Repo status */}
      {repoStatus && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>REPO PATH</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{repoStatus.path}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>CURRENT BRANCH</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)' }}>{repoStatus.current_branch}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>REMOTE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: repoStatus.has_remote ? 'var(--green)' : 'var(--text-muted)' }}>
              {repoStatus.has_remote ? '● CONNECTED' : '○ LOCAL ONLY'}
            </div>
          </div>
        </div>
      )}

      {/* What will happen */}
      <div style={{ padding: '10px 14px', background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', marginBottom: 6, letterSpacing: '0.08em' }}>WHAT WILL HAPPEN</div>
        GitAgent will create a feature branch named <code style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>feature/{storyId?.toLowerCase()}-tests</code>,
        write {toCommit.length} script(s) to <code style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>tests/{storyId?.toLowerCase()}/</code>,
        commit with a conventional commit message, and push to remote if configured.
      </div>

      {/* Script list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            SCRIPTS TO COMMIT ({toCommit.length})
          </div>
          <Button size="sm" variant="ghost" onClick={onToggleAll}>
            {selectedScriptIds.length === uncommittedScripts.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
          {uncommittedScripts.map(s => (
            <div key={s.id} onClick={() => onToggle(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
              border: `1px solid ${selectedScriptIds.includes(s.id) || selectedScriptIds.length === 0 ? 'var(--amber)' : 'var(--border)'}`,
              background: selectedScriptIds.includes(s.id) || selectedScriptIds.length === 0 ? 'var(--amber-glow)' : 'var(--bg-elevated)',
            }}>
              <FileCode size={12} color="var(--amber)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 }}>{s.script_name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={() => {}}>Cancel</Button>
        <Button icon={Upload} loading={loading} onClick={onCommit}>
          Commit {toCommit.length} Script(s)
        </Button>
      </div>
    </div>
  )
}