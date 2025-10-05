import { Hono } from 'hono'

const app = new Hono()

app.get('/api', (c) => c.json({ message: 'Increa Reader Server' }))

export default {
  port: 3000,
  fetch: app.fetch
}
