/**
 * Coerce a value to the declared JSON Schema type.
 * Handles the case where MCP layer stringifies all tool arguments.
 *
 * Strategy: JSON.parse first, then `new Function` for JS object literals.
 */

type JsonSchemaType = 'boolean' | 'integer' | 'number' | 'object' | 'array' | 'string'

const typeChecks: Record<JsonSchemaType, (v: unknown) => boolean> = {
  boolean: v => typeof v === 'boolean',
  integer: v => typeof v === 'number' && Number.isInteger(v),
  number: v => typeof v === 'number',
  object: v => typeof v === 'object' && v !== null && !Array.isArray(v),
  array: v => Array.isArray(v),
  string: v => typeof v === 'string',
}

function parseLoose(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    // Fall back to JS evaluation for object literals like {angle: 0}
    try {
      return new Function(`return (${str})`)()
    } catch {
      return undefined
    }
  }
}

export function coerce(type: JsonSchemaType, value: unknown): unknown {
  if (typeChecks[type]?.(value)) return value

  if (type === 'boolean') {
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return Boolean(value)
  }

  if (type === 'integer') {
    if (typeof value === 'string') return parseInt(value, 10)
    return Math.round(Number(value))
  }

  if (type === 'number') {
    if (typeof value === 'string') return parseFloat(value)
    return Number(value)
  }

  if (type === 'object' || type === 'array') {
    if (typeof value === 'string') {
      const parsed = parseLoose(value)
      if (parsed !== undefined && typeChecks[type](parsed)) return parsed
    }
  }

  return value
}
