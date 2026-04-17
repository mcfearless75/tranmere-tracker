describe('supabase client', () => {
  it('createClient returns an object with from() method', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    const { createClient } = await import('@/lib/supabase/client')
    const client = createClient()
    expect(typeof client.from).toBe('function')
  })
})
