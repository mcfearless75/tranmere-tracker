import { parseFoodItem } from '@/lib/openFoodFacts'

describe('parseFoodItem', () => {
  it('extracts macros from Open Food Facts product', () => {
    const product = {
      product_name: 'Chicken Breast',
      nutriments: {
        'energy-kcal_100g': 165,
        protein_100g: 31,
        carbohydrates_100g: 0,
        fat_100g: 3.6,
      },
    }
    const result = parseFoodItem(product, 100)
    expect(result.food_name).toBe('Chicken Breast')
    expect(result.calories).toBe(165)
    expect(result.protein_g).toBe(31)
    expect(result.carbs_g).toBe(0)
    expect(result.fat_g).toBeCloseTo(3.6)
  })

  it('scales macros by serving size', () => {
    const product = {
      product_name: 'Rice',
      nutriments: { 'energy-kcal_100g': 130, protein_100g: 2.7, carbohydrates_100g: 28, fat_100g: 0.3 },
    }
    const result = parseFoodItem(product, 200)
    expect(result.calories).toBe(260)
    expect(result.carbs_g).toBeCloseTo(56)
  })
})
