import katex from 'katex'

const cache = new Map<string, string>()

export function renderMathToImage(latex: string, fontSize = 24): string | null {
  const cacheKey = `${latex}:${fontSize}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
    })

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize}px;color:white;">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.24/dist/katex.min.css"/>
      ${html}
    </div>
  </foreignObject>
</svg>`

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    cache.set(cacheKey, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

export function clearMathRenderCache() {
  cache.clear()
}
