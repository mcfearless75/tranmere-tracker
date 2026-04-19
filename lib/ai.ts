import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared Anthropic client — reads ANTHROPIC_API_KEY from env.
 * Throws a clean error if the key is missing so API routes can return 400.
 */
export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to your Vercel environment variables')
  }
  return new Anthropic({ apiKey })
}

export const MODELS = {
  // Fast + cheap for simple transforms (feedback rewrite, short insights)
  haiku: 'claude-haiku-4-5',
  // Balanced for complex reasoning (match reports, detailed insights)
  sonnet: 'claude-sonnet-4-5',
} as const

export function extractText(response: Anthropic.Message): string {
  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
  return textBlocks.map(b => b.text).join('\n').trim()
}
