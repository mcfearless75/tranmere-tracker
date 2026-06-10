import { Mail, Phone, ShieldCheck, ShieldX } from 'lucide-react'
import { playerAge } from '@/lib/youth/youthUtils'
import { YouthPlayerRow } from './types'

export function PlayerCard({ player }: { player: YouthPlayerRow }) {
  const age = playerAge(player.date_of_birth)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            {player.first_name} {player.last_name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {age !== null ? `Age ${age}` : 'Age unknown'}
          </p>
        </div>
        {player.consent_given ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            <ShieldCheck size={12} /> Consent
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            <ShieldX size={12} /> No consent
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs text-gray-700">
        <p className="font-semibold">{player.parent_guardian_name} (parent/guardian)</p>
        <p className="flex items-center gap-1.5">
          <Mail size={13} className="text-tranmere-blue" />
          <a href={`mailto:${player.parent_contact_email}`} className="break-all underline-offset-2 hover:underline">
            {player.parent_contact_email}
          </a>
        </p>
        {player.parent_contact_phone && (
          <p className="flex items-center gap-1.5">
            <Phone size={13} className="text-tranmere-blue" />
            <a href={`tel:${player.parent_contact_phone}`}>{player.parent_contact_phone}</a>
          </p>
        )}
        {player.medical_notes && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
            <span className="font-semibold">Medical:</span> {player.medical_notes}
          </p>
        )}
      </div>
    </div>
  )
}
