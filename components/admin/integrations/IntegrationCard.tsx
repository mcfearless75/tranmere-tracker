'use client'

import { useState } from 'react'
import { Check, Plug, Save, Loader2, AlertCircle } from 'lucide-react'
import type { ClientIntegration } from '@/lib/integrations/clientView'
import { SECRET_SENTINEL } from '@/lib/integrations/clientView'

interface IntegrationCardProps {
  integration: ClientIntegration
}

type TestState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; ok: boolean; message: string }

/** One provider's enable toggle + masked credential fields + Save + Test. */
export function IntegrationCard({ integration }: IntegrationCardProps) {
  const [enabled, setEnabled] = useState(integration.enabled)
  const [baseUrl, setBaseUrl] = useState(integration.baseUrl)
  // Secret fields start as the sentinel so an untouched save keeps the stored value.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of integration.fields) {
      initial[f.key] = f.secret ? (f.hasValue ? SECRET_SENTINEL : '') : f.value
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: integration.provider,
          enabled,
          baseUrl: integration.usesBaseUrl ? baseUrl : null,
          config: values,
        }),
      })
      const json = (await res.json()) as { error?: string }
      setSaveMsg(res.ok ? 'Saved' : json.error ?? 'Save failed')
    } catch {
      setSaveMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function runTest() {
    setTest({ status: 'running' })
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: integration.provider }),
      })
      const json = (await res.json()) as {
        result?: { ok: boolean; message: string }
        error?: string
      }
      if (json.result) {
        setTest({ status: 'done', ok: json.result.ok, message: json.result.message })
      } else {
        setTest({ status: 'done', ok: false, message: json.error ?? 'Test failed' })
      }
    } catch {
      setTest({ status: 'done', ok: false, message: 'Test failed' })
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-1.5">
            <Plug size={16} className="text-tranmere-blue" />
            {integration.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
        </div>
        <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
          <span className="text-xs font-medium text-muted-foreground">
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-tranmere-blue"
            aria-label={`Enable ${integration.name}`}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {integration.usesBaseUrl && (
          <Field
            label={integration.baseUrlLabel ?? 'Base URL'}
            placeholder={integration.baseUrlPlaceholder}
            value={baseUrl}
            onChange={setBaseUrl}
            fullWidth
          />
        )}
        {integration.fields.map((f) => (
          <Field
            key={f.key}
            label={f.secret && f.hasValue ? `${f.label} (stored)` : f.label}
            placeholder={f.placeholder}
            value={values[f.key] === SECRET_SENTINEL ? '' : values[f.key]}
            onChange={(v) => setField(f.key, v)}
            type={f.secret ? 'password' : 'text'}
            secretStored={f.secret && f.hasValue && values[f.key] === SECRET_SENTINEL}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-tranmere-blue text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-900 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={runTest}
          disabled={test.status === 'running'}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-tranmere-blue text-tranmere-blue px-4 py-2.5 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50"
        >
          {test.status === 'running' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plug size={14} />
          )}
          Test connection
        </button>
      </div>

      {saveMsg && (
        <p
          className={`text-xs flex items-center gap-1 ${
            saveMsg === 'Saved' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {saveMsg === 'Saved' ? <Check size={12} /> : <AlertCircle size={12} />}
          {saveMsg}
        </p>
      )}

      {test.status === 'done' && (
        <p
          className={`text-xs flex items-center gap-1 ${
            test.ok ? 'text-green-600' : 'text-amber-600'
          }`}
        >
          {test.ok ? <Check size={12} /> : <AlertCircle size={12} />}
          {test.message}
        </p>
      )}
    </div>
  )
}

interface FieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  fullWidth?: boolean
  type?: 'text' | 'password'
  secretStored?: boolean
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  fullWidth,
  type = 'text',
  secretStored,
}: FieldProps) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={secretStored ? '••••••••  (leave blank to keep)' : placeholder}
        autoComplete="off"
        className="w-full text-sm border rounded-lg px-2 py-1.5 mt-0.5 font-mono"
      />
    </div>
  )
}
