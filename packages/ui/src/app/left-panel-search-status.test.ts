import { describe, expect, it } from 'vitest'

import { getLeftPanelSearchStatus } from './left-panel-search-status'

describe('getLeftPanelSearchStatus', () => {
  it('returns an empty string for an empty query', () => {
    expect(getLeftPanelSearchStatus('', false)).toBe('')
  })

  it('returns an empty string for a whitespace-only query', () => {
    expect(getLeftPanelSearchStatus('   ', false)).toBe('')
  })

  it('returns the trimmed query when filtering has settled', () => {
    expect(getLeftPanelSearchStatus('  brain2  ', false)).toBe('Filtering by "brain2"')
  })

  it('returns the filtering state while filtering is in progress', () => {
    expect(getLeftPanelSearchStatus('brain2', true)).toBe('Filtering...')
  })

  it('returns an empty string again after the query is cleared', () => {
    expect(getLeftPanelSearchStatus('', false)).toBe('')
  })
})
