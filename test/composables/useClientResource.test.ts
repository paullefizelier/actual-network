import { describe, it, expect } from 'vitest'
import { withClientId } from '../../app/composables/useClientResource'

describe('withClientId', () => {
  it('injects client_id into the payload', () => {
    expect(withClientId({ name: 'X' }, 'cid')).toEqual({ name: 'X', client_id: 'cid' })
  })
  it('overrides any client_id already present (current client wins)', () => {
    expect(withClientId({ name: 'X', client_id: 'other' }, 'cid')).toEqual({ name: 'X', client_id: 'cid' })
  })
})
