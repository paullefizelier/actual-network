import { describe, it, expect } from 'vitest'
import { readCategories } from '../../app/composables/useClientSettings'

describe('readCategories', () => {
  it('renvoie [] pour null', () => {
    expect(readCategories(null)).toEqual([])
  })

  it('renvoie [] pour undefined', () => {
    expect(readCategories(undefined)).toEqual([])
  })

  it('renvoie [] si la clé categories est absente', () => {
    expect(readCategories({ other: 'value' })).toEqual([])
  })

  it('renvoie [] si categories n\'est pas un tableau', () => {
    expect(readCategories({ categories: 'pas un tableau' })).toEqual([])
    expect(readCategories({ categories: 42 })).toEqual([])
    expect(readCategories({ categories: null })).toEqual([])
    expect(readCategories({ categories: {} })).toEqual([])
  })

  it('renvoie [] si categories contient des éléments non-string', () => {
    expect(readCategories({ categories: [1, 2, 3] })).toEqual([])
    expect(readCategories({ categories: ['ok', 42] })).toEqual([])
  })

  it('renvoie le tableau de chaînes quand il est valide', () => {
    expect(readCategories({ categories: ['Commerce', 'Industrie'] })).toEqual(['Commerce', 'Industrie'])
  })

  it('renvoie [] pour un tableau vide de catégories', () => {
    expect(readCategories({ categories: [] })).toEqual([])
  })

  it('renvoie [] si settings est un tableau (forme inattendue)', () => {
    expect(readCategories([1, 2, 3])).toEqual([])
  })
})
