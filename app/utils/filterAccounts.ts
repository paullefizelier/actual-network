interface AccountLike {
  name: string
  siret: string | null
  current_status: string
}

export function filterAccounts<T extends AccountLike>(
  rows: T[],
  { search, status }: { search: string, status: string | null }
): T[] {
  const q = search.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesSearch
      = !q
        || row.name.toLowerCase().includes(q)
        || (row.siret ?? '').toLowerCase().includes(q)
    const matchesStatus = status === null || row.current_status === status
    return matchesSearch && matchesStatus
  })
}
