import { describe, expect, it } from 'vitest'

import { splitSseLines } from './utils'

describe('splitSseLines', () => {
  it('keeps an incomplete SSE line for the next chunk', () => {
    expect(splitSseLines('', 'data: {"type":"res')).toEqual({
      lines: [],
      remainder: 'data: {"type":"res',
    })
  })

  it('reconstructs a line split across chunks', () => {
    expect(splitSseLines('data: {"type":"res', 'ult"}\n')).toEqual({
      lines: ['data: {"type":"result"}'],
      remainder: '',
    })
  })

  it('returns complete lines while preserving the trailing fragment', () => {
    expect(splitSseLines('', 'data: one\n\ndata: tw')).toEqual({
      lines: ['data: one', ''],
      remainder: 'data: tw',
    })
  })

  it('reconstructs a CRLF delimiter split across chunks', () => {
    const first = splitSseLines('', 'data: one\r')

    expect(splitSseLines(first.remainder, '\ndata: two\r\n')).toEqual({
      lines: ['data: one', 'data: two'],
      remainder: '',
    })
  })
})
