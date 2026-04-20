'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Check, Plus } from 'lucide-react'

type Platform = {
  id: string
  name: string
  issuer: string
  client_id: string
  deployment_ids: string[]
  auth_login_url: string
  auth_token_url: string
  keyset_url: string
}

export function LtiPlatformForm({ existing }: { existing: Platform[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    issuer: '',
    client_id: '',
    deployment_id: '',
    auth_login_url: '',
    auth_token_url: '',
    keyset_url: '',
  })

  async function save() {
    if (!form.name || !form.issuer || !form.client_id) return alert('Name, Issuer, Client ID required')
    setSaving(true)
    await supabase.from('lti_platforms').insert({
      name: form.name,
      issuer: form.issuer,
      client_id: form.client_id,
      deployment_ids: form.deployment_id ? [form.deployment_id] : [],
      auth_login_url: form.auth_login_url,
      auth_token_url: form.auth_token_url,
      keyset_url: form.keyset_url,
    })
    setSaving(false)
    setForm({ name: '', issuer: '', client_id: '', deployment_id: '', auth_login_url: '', auth_token_url: '', keyset_url: '' })
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Remove this platform? LTI users linked to it will be orphaned.')) return
    await supabase.from('lti_platforms').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Existing platforms */}
      {existing.length > 0 && (
        <div className="space-y-2">
          {existing.map(p => (
            <div key={p.id} className="rounded-xl border p-3 bg-green-50/50 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Check size={14} className="text-green-600" /> {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{p.issuer}</p>
                  <p className="text-xs text-muted-foreground">Client ID: <span className="font-mono">{p.client_id}</span></p>
                </div>
                <button onClick={() => remove(p.id)} className="text-red-500 hover:bg-red-50 rounded p-1.5" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Name" placeholder="e.g. Wirral Met Moodle" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
        <Field label="Issuer (Platform ID)" placeholder="https://moodle.college.ac.uk" value={form.issuer} onChange={v => setForm(f => ({ ...f, issuer: v }))} />
        <Field label="Client ID" placeholder="Assigned by Moodle" value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} />
        <Field label="Deployment ID" placeholder="e.g. 1" value={form.deployment_id} onChange={v => setForm(f => ({ ...f, deployment_id: v }))} />
        <Field label="Auth login URL" placeholder="https://.../mod/lti/auth.php" value={form.auth_login_url} onChange={v => setForm(f => ({ ...f, auth_login_url: v }))} />
        <Field label="Access token URL" placeholder="https://.../mod/lti/token.php" value={form.auth_token_url} onChange={v => setForm(f => ({ ...f, auth_token_url: v }))} />
        <Field label="Public keyset URL" placeholder="https://.../mod/lti/certs.php" value={form.keyset_url} onChange={v => setForm(f => ({ ...f, keyset_url: v }))} fullWidth />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-tranmere-blue text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-900 disabled:opacity-50"
      >
        <Plus size={14} /> {saving ? 'Saving…' : 'Register Platform'}
      </button>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, fullWidth }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border rounded-lg px-2 py-1.5 mt-0.5 font-mono"
      />
    </div>
  )
}
