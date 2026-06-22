import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

// Tables with a client_id column (everything except the clients table itself).
type ScopedTable = Exclude<keyof Database['public']['Tables'], 'clients'>

export function withClientId<T extends Record<string, unknown>>(payload: T, clientId: string) {
  return { ...payload, client_id: clientId }
}

export function useClientResource<Row>(table: ScopedTable) {
  // The generic-over-tables shape can't satisfy supabase-js's per-table column
  // typing, so we use an untyped client here; callers get typed rows via <Row>.
  const supabase = useSupabaseClient() as unknown as SupabaseClient
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
