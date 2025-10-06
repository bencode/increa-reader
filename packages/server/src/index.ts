import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

import { registerWorkspaceRoutes } from './routes/workspace'
import { registerViewsRoutes } from './routes/views'
import { sessionMiddleware } from './middleware/session'

const app = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/api',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: 'Server info',
    },
  },
})

app.use('/api/*', sessionMiddleware())

app.openapi(route, c => c.json({ message: 'Increa Reader Server' }))

registerWorkspaceRoutes(app)
registerViewsRoutes(app)

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '0.0.1',
    title: 'Increa Reader API',
  },
})

app.get('/docs/ui', swaggerUI({ url: '/docs' }))

const port = Number(process.env.PORT) || 3000

export default {
  port,
  fetch: app.fetch,
}
