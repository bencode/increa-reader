export type TocHeading = {
  id: string
  text: string
  level: number
}

function generateSlug(text: string, slugCounts: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const count = slugCounts.get(base) ?? 0
  slugCounts.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

export function parseHeadings(markdown: string): TocHeading[] {
  const slugCounts = new Map<string, number>()
  const headings: TocHeading[] = []
  let inCodeBlock = false

  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) {
      const text = match[2].replace(/\s*#+\s*$/, '').trim()
      headings.push({ id: generateSlug(text, slugCounts), text, level: match[1].length })
    }
  }
  return headings
}
