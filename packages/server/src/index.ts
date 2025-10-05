import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

const app = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/api',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string()
          })
        }
      },
      description: 'Server info'
    }
  }
})

app.openapi(route, (c) => c.json({ message: 'Increa Reader Server' }))

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '0.0.1',
    title: 'Increa Reader API'
  }
})

app.get('/docs/ui', swaggerUI({ url: '/docs' }))

export default {
  port: 3000,
  fetch: app.fetch
}
