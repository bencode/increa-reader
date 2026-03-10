import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchApiSettings, updateApiSettings, type ApiSettings } from './api'

export function ApiSettingsForm({ open }: { open: boolean }) {
  const [saved, setSaved] = useState<ApiSettings>({ base_url: null, api_key: null, default_model: null })
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (!open) return
    fetchApiSettings()
      .then((s) => {
        setSaved(s)
        setBaseUrl(s.base_url ?? '')
        setDefaultModel(s.default_model ?? '')
        setApiKey('')
        setKeyTouched(false)
      })
      .catch(console.error)
  }, [open])

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload: Partial<ApiSettings> = {
        base_url: baseUrl || null,
        default_model: defaultModel || null,
      }
      if (apiKey) {
        payload.api_key = apiKey
      } else if (keyTouched && saved.api_key) {
        // User touched the field and left it empty — explicitly clear the key
        payload.api_key = ''
      }
      const result = await updateApiSettings(payload)
      setSaved(result)
      setApiKey('')
      setKeyTouched(false)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to save API settings:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Base URL</label>
        <Input
          placeholder="https://api.anthropic.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">API Key</label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder={saved.api_key ?? 'sk-ant-...'}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setKeyTouched(true) }}
            className="pr-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Default Model</label>
        <Input
          placeholder="claude-sonnet-4-20250514"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
        />
      </div>

      <Button onClick={handleSave} disabled={loading} size="sm">
        {status === 'saved' ? 'Saved' : loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
