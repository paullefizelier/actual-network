import type { Database } from '~/types/database'

type TableName = keyof Database['public']['Tables']

export function withClientId<T extends Record<string, unknown>>(payload: T, clientId: string) {
  return { ...payload, client_id: clientId }
}

export function useClientResource<Row>(table: TableName) {
  const supabase = useSupabaseClient<Database>()
  const { current } = useCurrentClient()

  function requireClient(): string {
    if (!current.value) throw new Error('Aucun client sélectionné')
    return current.value.id
  }

  async function list(opts?: { columns?: string, order?: string, ascending?: boolean }): Promise<Row[]> {
    const { data, error } = await supabase
      .from(table)
      .select(opts?.columns ?? '*')
      .eq('client_id', requireClient())
      .order(opts?.order ?? 'created_at', { ascending: opts?.ascending ?? false })
    if (error) throw error
    return (data ?? []) as Row[]
  }

  async function create(payload: Record<string, unknown>): Promise<Row> {
    const { data, error } = await supabase
      .from(table)
      .insert(withClientId(payload, requireClient()) as never)
      .select()
      .single()
    if (error) throw error
    return data as Row
  }

  async function update(id: string, payload: Record<string, unknown>): Promise<Row> {
    const { data, error } = await supabase
      .from(table)
      .update(payload as never)
      .eq('id', id)
      .eq('client_id', requireClient())
      .select()
      .single()
    if (error) throw error
    return data as Row
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('client_id', requireClient())
    if (error) throw error
  }

  return { list, create, update, remove }
}
