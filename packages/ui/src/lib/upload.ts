export async function uploadImage(blob: Blob): Promise<{ absolutePath: string; filename: string }> {
  const reader = new FileReader()
  const base64 = await new Promise<string>(resolve => {
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64 }),
  })

  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}
