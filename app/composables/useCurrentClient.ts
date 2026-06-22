export interface ClientRow { id: string, name: string, slug: string }

export function pickDefaultClient(clients: ClientRow[], savedId: string | null): ClientRow | null {
  if (clients.length === 0) return null
  if (savedId) {
    const found = clients.find(c => c.id === savedId)
    if (found) return found
  }
  return clients[0] ?? null
}

const STORAGE_KEY = 'an:current-client'

export function useCurrentClient() {
  const supabase = useSupabaseClient()
  const clients = useState<ClientRow[]>('clients', () => [])
  const current = useState<ClientRow | null>('current-client', () => null)

  async function load() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, slug')
      .order('name')
    clients.value = (data as ClientRow[]) ?? []
    const saved = import.meta.client ? localStorage.getItem(STORAGE_KEY) : null
    current.value = pickDefaultClient(clients.value, saved)
  }

  function setCurrent(id: string) {
    const found = clients.value.find(c => c.id === id) ?? null
    current.value = found
    if (found && import.meta.client) localStorage.setItem(STORAGE_KEY, found.id)
  }

  return { clients, current, setCurrent, load }
}
