import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

export function readCategories(settings: unknown): string[] {
  if (settings === null || settings === undefined) return []
  if (typeof settings !== 'object' || Array.isArray(settings)) return []
  const obj = settings as Record<string, unknown>
  if (!('categories' in obj)) return []
  const cats = obj['categories']
  if (!Array.isArray(cats)) return []
  if (!cats.every((item): item is string => typeof item === 'string')) return []
  return cats
}

export function useClientSettings() {
  const supabase = useSupabaseClient() as unknown as SupabaseClient<Database>
  const { current } = useCurrentClient()

  const categories = ref<string[]>([])

  async function load(): Promise<void> {
    if (!current.value) return
    const { data, error } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', current.value.id)
      .single()
    if (error) throw error
    categories.value = readCategories(data?.settings)
  }

  async function saveCategories(list: string[]): Promise<void> {
    if (!current.value) throw new Error('Aucun client sélectionné')
    // First fetch existing settings to merge (avoid clobbering other keys)
    const { data: existing, error: fetchError } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', current.value.id)
      .single()
    if (fetchError) throw fetchError

    const prevSettings = (existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings))
      ? (existing.settings as Record<string, unknown>)
      : {}

    const { error } = await supabase
      .from('clients')
      .update({ settings: { ...prevSettings, categories: list } })
      .eq('id', current.value.id)
    if (error) throw error
    categories.value = list
  }

  return { categories, load, saveCategories }
}
