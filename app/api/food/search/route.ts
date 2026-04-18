import { searchFood, lookupBarcode } from '@/lib/openFoodFacts'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const barcode = searchParams.get('barcode')

  try {
    if (barcode) {
      const product = await lookupBarcode(barcode)
      return NextResponse.json(product ? [product] : [])
    }
    if (!query || query.length < 2) return NextResponse.json([])
    const products = await searchFood(query)
    return NextResponse.json(products.slice(0, 10))
  } catch {
    return NextResponse.json([])
  }
}
