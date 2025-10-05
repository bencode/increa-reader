# Increa Reader 项目上下文

## 项目结构
- monorepo 使用 pnpm workspace
- packages/ui: 前端 UI 包
- packages/server: 后端服务包

## UI 包技术栈
- React 19
- Vite (rolldown-vite@7.1.15)
- TypeScript
- Tailwind CSS v4 (使用 @tailwindcss/vite 插件)
- shadcn/ui (new-york 风格)
- React Compiler (babel-plugin-react-compiler)

## 重要配置说明

### shadcn/ui 使用注意
1. 添加组件命令：`npx shadcn@latest add <component-name>`
2. **问题**：shadcn 会将组件创建在项目根目录的 `@/components/ui/` 目录下（字面量路径）
3. **解决**：需要手动将文件移动到 `src/components/ui/` 目录
4. components.json 中的 `aliases` 配置是给 shadcn 工具使用的，用于生成代码的 import 路径
5. 真正的 TypeScript/Vite path alias 只有一个：`@/` 指向 `src/`（配置在 tsconfig.app.json 和 vite.config.ts）

### Tailwind CSS v4
- CSS 文件：`src/style.css`，只需 `@import "tailwindcss";`
- 不需要手动定义 CSS 变量，Tailwind v4 自动处理
- 使用 @tailwindcss/vite 插件

### 已完成的配置
- ✅ Prettier 配置（.prettierrc）
- ✅ ESLint 配置
- ✅ TypeScript 配置（包括 path alias）
- ✅ Vite 配置（包括 Tailwind 插件和 API 代理）
- ✅ shadcn/ui 配置
- ✅ Button 组件已添加并测试通过

## 可用的 npm scripts
- `pnpm dev`: 启动开发服务器
- `pnpm build`: 构建生产版本
- `pnpm lint`: 运行 ESLint
- `pnpm format`: 格式化代码
- `pnpm typecheck`: 类型检查

## API 代理配置
- `/api` 请求会被代理到 `http://localhost:3000`

## Server 包技术栈
- Hono - Web 框架
- Drizzle ORM - 数据库 ORM
- Bun - 运行时
- @hono/zod-openapi - OpenAPI/Swagger 集成
- Zod - Schema 验证

### Server 可用命令
- `pnpm --filter @increa-reader/server dev`: 开发模式
- `pnpm --filter @increa-reader/server build`: 构建
- `pnpm --filter @increa-reader/server start`: 运行构建产物

### Server API 端点
- `/docs` - OpenAPI JSON 文档
- `/docs/ui` - Swagger UI 界面
- `/api` - 服务器信息
