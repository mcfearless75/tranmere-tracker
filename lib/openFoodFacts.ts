export type FoodItem = {
  food_name: string
  barcode: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export function parseFoodItem(product: any, servingGrams: number): FoodItem {
  const factor = servingGrams / 100
  return {
    food_name: product.product_name ?? 'Unknown',
    barcode: product.code ?? null,
    calories: Math.round((product.nutriments?.['energy-kcal_100g'] ?? 0) * factor),
    protein_g: Math.round((product.nutriments?.protein_100g ?? 0) * factor * 10) / 10,
    carbs_g: Math.round((product.nutriments?.carbohydrates_100g ?? 0) * factor * 10) / 10,
    fat_g: Math.round((product.nutriments?.fat_100g ?? 0) * factor * 10) / 10,
  }
}

export async function searchFood(query: string): Promise<any[]> {
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`
  )
  const data = await res.json()
  return data.products ?? []
}

export async function lookupBarcode(barcode: string): Promise<any | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
  const data = await res.json()
  return data.status === 1 ? data.product : null
}
