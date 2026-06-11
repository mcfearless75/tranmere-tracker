import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'Privacy Notice — The Solar Campus',
  description: 'How The Solar Campus platform collects, uses and protects personal data.',
}

const LAST_UPDATED = '11 June 2026'

/**
 * Public privacy notice (no auth — listed in middleware PUBLIC_PATHS).
 * Required for UK GDPR transparency (the platform processes minors' data,
 * including a public trial-application form) and used as the privacy policy
 * URL for Google OAuth consent-screen branding verification.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-tranmere-blue py-8 px-4">
      <div className="mx-auto w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 sm:p-10 space-y-6">
        <div className="flex items-center gap-3">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Club crest"
            width={48}
            height={48}
          />
          <div>
            <h1 className="text-2xl font-bold text-tranmere-blue">Privacy Notice</h1>
            <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <Section title="Who we are">
          Tranmere Tracker — the platform at The Solar Campus — is a performance and
          education platform for academy students, their parents and guardians, and academy staff.
          It is operated on behalf of the academy. Questions about this notice or your
          data: <a className="text-tranmere-blue underline" href="mailto:paulmc18@gmail.com">contact us</a>.
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account details</strong> — name, email address, role, year group, avatar.</li>
            <li><strong>Attendance</strong> — check-in/out times and, where used, approximate
              location at the moment of check-in (to confirm presence at the academy) and
              check-in selfies. Location is captured only during check-in, never tracked continuously.</li>
            <li><strong>Football performance</strong> — training sessions, match involvement,
              coach ratings, GPS session metrics.</li>
            <li><strong>Health and lifestyle</strong> — nutrition, hydration and gym logs,
              and optional meal photos, entered by the student.</li>
            <li><strong>Wellbeing and pastoral</strong> — fortnightly wellbeing survey answers,
              learner reviews, and safeguarding records (staff-recorded, strictly access-controlled).</li>
            <li><strong>Trial applications</strong> — details submitted through our public
              trials form, including parent/guardian contact information, with explicit consent.</li>
            <li><strong>Messages</strong> — chat messages and attachments sent within the platform.</li>
          </ul>
        </Section>

        <Section title="Why we process it (lawful basis)">
          We process data to deliver the academy&apos;s education and football programme
          (legitimate interests and, for trial applications, consent), to meet safeguarding
          and duty-of-care obligations (legal obligation and vital interests), and to keep
          parents and guardians informed about their child&apos;s attendance and development.
        </Section>

        <Section title="Children's data">
          Most students are under 18, and the platform is designed accordingly: access is
          restricted to academy accounts, safeguarding records are visible to designated
          staff only, financial records are admin-only, files are stored in private buckets,
          and youth-section players have no accounts at all — their records are managed by
          staff with parent/guardian consent.
        </Section>

        <Section title="Where it lives and who processes it">
          Data is stored with <strong>Supabase</strong> (database, authentication, file storage)
          and the application is hosted on <strong>Vercel</strong>. AI-generated summaries
          (development reports, review summaries) are produced via <strong>Anthropic</strong>&apos;s
          Claude API; only the data needed for the summary is sent and it is not used to train
          models. Optional Google sign-in is provided via <strong>Google</strong> OAuth.
          Education content is delivered separately through <strong>Moodle</strong>.
        </Section>

        <Section title="How long we keep it">
          Records are kept for the duration of the student&apos;s enrolment and then for no
          longer than necessary to meet the academy&apos;s legal and safeguarding retention
          obligations. Trial applications that do not progress are removed within 12 months.
        </Section>

        <Section title="Your rights">
          You (and parents/guardians on behalf of children) can ask for access to, correction
          of, or deletion of personal data, and can withdraw consent where consent is the
          basis. Contact us using the email above. You also have the right to complain to the
          ICO (ico.org.uk).
        </Section>

        <div className="pt-2 border-t">
          <Link href="/login" className="text-sm text-tranmere-blue underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}
