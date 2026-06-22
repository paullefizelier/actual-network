import { describe, it, expect } from 'vitest'
import { pickDefaultClient } from '../../app/composables/useCurrentClient'

const clients = [{ id: '1', name: 'A', slug: 'a' }, { id: '2', name: 'B', slug: 'b' }]

describe('pickDefaultClient', () => {
  it('reprend le client sauvegardé s\'il existe encore', () => {
    expect(pickDefaultClient(clients, '2')!.id).toBe('2')
  })
  it('prend le premier client si aucun sauvegardé', () => {
    expect(pickDefaultClient(clients, null)!.id).toBe('1')
  })
  it('prend le premier si le sauvegardé n\'existe plus', () => {
    expect(pickDefaultClient(clients, '99')!.id).toBe('1')
  })
  it('renvoie null si aucun client', () => {
    expect(pickDefaultClient([], '1')).toBeNull()
  })
})
