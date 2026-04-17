'use client'

import { useState, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { parseFoodItem, type FoodItem } from '@/lib/openFoodFacts'

type Props = { onSelect: (item: FoodItem) => void }

export function FoodSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 400)
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search food (e.g. chicken breast)…"
        value={query}
        onChange={e => handleChange(e.target.value)}
        className="text-sm"
      />
      {loading && (
        <p className="text-xs text-muted-foreground mt-1 px-1">Searching…</p>
      )}
      {results.length > 0 && (
        <div className="absolute z-20 w-full bg-white border rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((product, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-3 hover:bg-gray-50 active:bg-gray-100 text-sm border-b last:border-0"
              onClick={() => {
                onSelect(parseFoodItem(product, 100))
                setQuery(product.product_name ?? '')
                setResults([])
              }}
            >
              <p className="font-medium truncate">{product.product_name}</p>
              <p className="text-muted-foreground text-xs">
                {Math.round(product.nutriments?.['energy-kcal_100g'] ?? 0)} kcal/100g
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
