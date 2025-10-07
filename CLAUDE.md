# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目结构

pnpm workspace monorepo，包含两个包：
- `packages/ui` - React 前端应用
- `packages/server` - FastAPI 后端服务 (Python)

## 常用命令

### 开发
```bash
# 同时启动 UI 和 Server
pnpm dev

# 单独启动 UI（端口 5173）
pnpm --filter @increa-reader/ui dev

# 单独启动 Server（端口 3000）
pnpm --filter @increa-reader/server dev
# 或者直接运行 Python 服务器
cd packages/server && python server.py
```

### 构建和检查
```bash
pnpm build                                    # 构建所有包
pnpm --filter @increa-reader/ui typecheck    # UI 类型检查
pnpm --filter @increa-reader/ui lint         # UI 代码检查
pnpm --filter @increa-reader/ui format       # UI 代码格式化
# 安装 Python 依赖
cd packages/server && pip install -r requirements.txt
```

### 测试
```bash
pnpm test  # 运行所有测试（目前尚未实现）
```

## 架构概览

### UI 架构（packages/ui）
- **技术栈**: React 19, React Router, Vite (rolldown-vite), TypeScript
- **样式**: Tailwind CSS v4 (使用 @tailwindcss/vite 插件), shadcn/ui (new-york 风格)
- **编译器**: React Compiler (babel-plugin-react-compiler)
- **布局**: 三栏可调整大小的面板布局（使用 react-resizable-panels）
  - 左侧：文件树（LeftPanel → FileTree）
  - 中间：主内容区（通过 React Router Outlet 渲染）
  - 右侧：待实现功能区
- **路由**:
  - `/` - 首页
  - `/views/:repoName/*` - 文件查看器
- **API 调用**: 使用 `/api` 前缀，Vite 代理到 `http://localhost:3000`

### Server 架构（packages/server）
- **技术栈**: FastAPI, PyMuPDF, Claude SDK, MCP (Model Context Protocol)
- **核心功能**:
  - 递归构建文件树，支持排除模式（默认排除 `node_modules/`, `.*`）
  - 自动检测文本/二进制文件
  - PDF 处理和搜索功能（通过 MCP 工具）
  - AI 聊天功能（集成 Claude SDK）
  - 流式响应支持
- **API 路由**:
  - `/api/workspace/tree` - 获取文件树
  - `/api/views/{repo}/{path}` - 获取文件内容
  - `/api/preview` - 获取文件预览
  - `/api/chat/query` - AI 聊天接口（流式）
- **MCP 工具**:
  - `open_pdf`, `page_count`, `extract_text`, `render_page_png`, `search_text`, `close_pdf`

### 数据流
1. Server 启动时从 `INCREA_REPO` 环境变量读取仓库路径（用 `:` 分隔多个路径）
2. UI 通过 `/api/workspace/tree` 获取所有仓库的文件树
3. 用户点击文件时，通过 `/api/views/{repo}/{path}` 获取文件内容
4. UI 根据文件类型（text/binary）决定如何显示

## 重要配置说明

### shadcn/ui
- 添加组件：`npx shadcn@latest add <component-name>`
- **重要**: shadcn 会在项目根目录创建 `@/components/ui/`，需手动移到 `packages/ui/src/components/ui/`
- Path alias: `@/` → `packages/ui/src/`（在 tsconfig.app.json 和 vite.config.ts 配置）

### Tailwind CSS v4
- 配置文件: `packages/ui/src/style.css`，只需 `@import "tailwindcss";`
- 不需要手动定义 CSS 变量

### Python 环境
- 推荐使用虚拟环境：`python -m venv .venv && source .venv/bin/activate`
- 依赖管理：`pip install -r requirements.txt`
- 服务器启动：`python server.py`

## 类型系统关键点

### 共享类型
UI 和 Server 各自定义了相似但独立的类型（`TreeNode`, `RepoResource`），未来可考虑提取到共享包。

### 环境变量
- `INCREA_REPO`: 仓库路径，多个路径用 `:` 分隔（例如：`/path/to/repo1:/path/to/repo2`）
- `PORT`: Server 端口（默认 3000）
- `ANTHROPIC_API_KEY`: Claude API 密钥
- `ANTHROPIC_BASE_URL`: Claude API 基础URL（可选）
