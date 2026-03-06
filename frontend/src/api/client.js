import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth ───────────────────────────────────────────────────────────────────
export const login = (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats')

// ── JIRA Stories ───────────────────────────────────────────────────────────
export const importStory    = (storyId) => api.post(`/jira/import/${storyId}`)
export const listStories    = (skip = 0, limit = 50) => api.get(`/jira/stories?skip=${skip}&limit=${limit}`)
export const getStory       = (id) => api.get(`/jira/stories/${id}`)
export const deleteStory    = (id) => api.delete(`/jira/stories/${id}`)
export const retryImport    = (id) => api.post(`/jira/stories/${id}/retry-import`)

// ── Test Plans ─────────────────────────────────────────────────────────────
export const generateTestPlan = (storyDbId) => api.post(`/testplan/generate/${storyDbId}`)
export const getTestPlan      = (storyDbId) => api.get(`/testplan/${storyDbId}`)
export const getScenarios     = (storyDbId) => api.get(`/testplan/${storyDbId}/scenarios`)
export const deleteTestPlan   = (planId)    => api.delete(`/testplan/${planId}`)

// ── Test Scripts ───────────────────────────────────────────────────────────
export const generateScripts  = (planId, scenarioIds = null) =>
  api.post(`/scripts/generate/${planId}`, { scenario_ids: scenarioIds })
export const listScripts      = (planId) => api.get(`/scripts/${planId}`)
export const getScriptContent = (planId, scriptId) => api.get(`/scripts/${planId}/${scriptId}/content`)
export const deleteScript     = (scriptId) => api.delete(`/scripts/${scriptId}`)

export default api
