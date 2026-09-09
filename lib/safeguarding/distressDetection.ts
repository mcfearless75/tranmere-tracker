/**
 * Deterministic, keyword/phrase-based distress detector for student-facing
 * chat messages. This is a safety NET, not a diagnosis: it runs regardless
 * of what an LLM decides to do with the same message, so a human is
 * notified even if the AI's own reply is imperfect. Deliberately biased
 * toward false positives over false negatives — an unnecessary staff
 * notification is a much smaller cost than a missed real signal.
 *
 * Pure and synchronous: no AI call, no network access, fully unit-testable.
 */

type DistressCategory = 'self_harm_or_suicide' | 'abuse_disclosure' | 'hopelessness'

const PATTERNS: Record<DistressCategory, RegExp> = {
  self_harm_or_suicide:
    /\b(kill(?:ing)?\s+myself|end(?:ing)?\s+my\s+life|suicidal|suicide|self[- ]harm(?:ing)?|hurt(?:ing)?\s+myself|cut(?:ting)?\s+myself|want(?:ed)?\s+to\s+die|don'?t\s+want\s+to\s+(?:be\s+here|live|exist)(?:\s+anymore)?|no\s+reason\s+to\s+live)\b/i,
  abuse_disclosure:
    /\b(?:he|she|they)\s+(?:hits?|hurts?|touch(?:ed|es?)?|abuses?)\s+me\b|\b(?:my\s+)?(?:mom|mother|dad|father|stepmom|stepdad|mum|boyfriend|girlfriend|brother|sister|uncle|aunt)\s+(?:hits?|hurts?|touch(?:ed|es?)?|abuses?)\s+me\b|\bsomeone\s+(?:is\s+)?(?:hurting|abusing|hitting)\s+me\b|\b(?:sexually\s+abus\w*|being\s+abused)\b/i,
  hopelessness:
    /\b(?:hopeless(?:ness)?|no\s*one\s+(?:would\s+)?care|nothing\s+matters\s+anymore|can'?t\s+(?:take|cope\s+with|handle)\s+(?:it|this)\s+anymore|given?\s+up\s+on\s+(?:everything|life))\b/i,
}

export function detectDistressSignals(text: string): DistressCategory[] {
  if (!text || !text.trim()) return []

  return (Object.keys(PATTERNS) as DistressCategory[]).filter(category =>
    PATTERNS[category].test(text)
  )
}
