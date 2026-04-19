import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODELS } from '@/lib/ai'
import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg'

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analyse this meal photo for a student athlete's nutrition log. Return ONLY a JSON object with these keys — no markdown, no prose, no code fences:

{
  "food_name": "short descriptive name (e.g. 'Grilled chicken with rice and broccoli')",
  "meal_type": "one of: breakfast | lunch | dinner | snack",
  "calories": estimated total kcal (integer),
  "protein_g": estimated grams of protein (number, 1 decimal),
  "carbs_g": estimated grams of carbs (number, 1 decimal),
  "fat_g": estimated grams of fat (number, 1 decimal),
  "confidence": "low" | "medium" | "high",
  "notes": "one-sentence note about the meal's nutritional value for an athlete"
}

Be realistic with portion sizes based on what you see. If you can't identify the food, return confidence: "low" and your best guess.`,
          },
        ],
      }],
    }) as Anthropic.Message

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const raw = textBlock?.text.trim() ?? ''
    // Strip possible code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    let parsed: any
    try { parsed = JSON.parse(cleaned) } catch {
      return NextResponse.json({ error: 'Could not parse AI response', raw }, { status: 500 })
    }

    return NextResponse.json({ success: true, estimate: parsed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
