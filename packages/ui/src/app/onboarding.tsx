import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  KeyRound,
  Loader2,
  MapIcon,
  Server,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { completeOnboarding, fetchOnboardingState, type OnboardingState } from './api'

type Step = 'repo' | 'api' | 'check'

function DiagnosticItem({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white/70 px-4 py-3 shadow-sm">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
      {ok ? (
        <CheckCircle2 className="size-5 text-emerald-500" />
      ) : (
        <XCircle className="size-5 text-red-500" />
      )}
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('repo')
  const [state, setState] = useState<OnboardingState | null>(null)
  const [repoPath, setRepoPath] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOnboardingState()
      .then(data => {
        setState(data)
        if (!data.needs_onboarding) navigate('/', { replace: true })
      })
      .catch(() =>
        setError('Unable to connect to the backend service. Make sure the server is running.'),
      )
      .finally(() => setLoading(false))
  }, [navigate])

  const handleComplete = async () => {
    if (!repoPath.trim()) return
    setSaving(true)
    setError(null)
    try {
      await completeOnboarding({
        repo_path: repoPath.trim(),
        api_key: apiKey.trim() || null,
        base_url: baseUrl.trim() || null,
        auth_token: authToken.trim() || null,
        default_model: defaultModel.trim() || null,
      })
      navigate('/', { replace: true })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-white">
        <Loader2 className="mr-2 size-5 animate-spin" /> Checking runtime environment...
      </div>
    )
  }

  const diagnostics = state?.diagnostics

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center gap-10 px-8 py-10">
        <aside className="hidden flex-1 lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-sm text-slate-600 shadow-sm">
            <MapIcon className="size-4 text-blue-600" /> Increa Reader First Run
          </div>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            Open a knowledge repository like opening a folder in VS Code.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Choose a local project, research folder, or Obsidian vault. Increa Reader turns it into
            an AI workspace for reading, asking questions, and capturing notes.
          </p>
          <div className="mt-10 grid max-w-xl gap-3">
            <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
              <FolderOpen className="mb-3 size-6 text-blue-600" />
              <div className="font-medium">Open a knowledge repository</div>
              <div className="mt-1 text-sm text-slate-500">
                Start from a local folder and create your reading entry point automatically.
              </div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
              <KeyRound className="mb-3 size-6 text-violet-600" />
              <div className="font-medium">Connect Claude or a proxy</div>
              <div className="mt-1 text-sm text-slate-500">
                API setup is optional. You can finish it later in Settings.
              </div>
            </div>
          </div>
        </aside>

        <main className="w-full max-w-xl rounded-3xl border bg-white/85 p-6 shadow-2xl shadow-blue-950/10 backdrop-blur">
          <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
            <span className={step === 'repo' ? 'font-medium text-blue-600' : ''}>
              1 Open repository
            </span>
            <ArrowRight className="size-4" />
            <span className={step === 'api' ? 'font-medium text-blue-600' : ''}>2 API setup</span>
            <ArrowRight className="size-4" />
            <span className={step === 'check' ? 'font-medium text-blue-600' : ''}>
              3 Environment check
            </span>
          </div>

          {step === 'repo' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Choose a local folder / repository</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Enter an absolute local path, for example /Users/you/Documents/notes. Browsers
                  cannot expose real folder paths directly for security reasons.
                </p>
              </div>
              <Input
                autoFocus
                placeholder="/Users/shuguang/Documents/knowledge-base"
                value={repoPath}
                onChange={e => setRepoPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && repoPath.trim() && setStep('api')}
              />
              <Button className="w-full" disabled={!repoPath.trim()} onClick={() => setStep('api')}>
                Continue to AI setup
                <ArrowRight className="size-4" />
              </Button>
            </section>
          )}

          {step === 'api' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Connect Claude API</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Use an official API key or a compatible proxy. You can skip this for now and start
                  reading files first.
                </p>
              </div>
              <Input
                type="password"
                placeholder="ANTHROPIC_API_KEY / proxy token"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <Input
                placeholder="ANTHROPIC_BASE_URL, for example https://your-proxy/api/anthropic"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
              />
              <Input
                type="password"
                placeholder="ANTHROPIC_AUTH_TOKEN, optional"
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
              />
              <Input
                placeholder="Default model, optional"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('repo')}>
                  Back
                </Button>
                <Button className="flex-1" onClick={() => setStep('check')}>
                  Check environment
                </Button>
              </div>
            </section>
          )}

          {step === 'check' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Preflight check</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Confirm that the backend, Python, and PDF support are working before entering the
                  reader.
                </p>
              </div>
              <div className="space-y-3">
                {diagnostics && (
                  <>
                    <DiagnosticItem label="Backend service" {...diagnostics.backend} />
                    <DiagnosticItem label="Python environment" {...diagnostics.python} />
                    <DiagnosticItem label="PDF support" {...diagnostics.pdf} />
                  </>
                )}
                <DiagnosticItem
                  label="Knowledge repository"
                  ok={Boolean(repoPath.trim())}
                  detail={repoPath || 'Not selected'}
                />
                <DiagnosticItem
                  label="AI setup"
                  ok={Boolean(apiKey || authToken)}
                  detail={
                    apiKey || authToken
                      ? 'Credentials provided'
                      : 'Not configured. You can set it up later.'
                  }
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('api')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={saving || !repoPath.trim()}
                  onClick={handleComplete}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Server className="size-4" />
                  )}
                  Enter reader
                </Button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
