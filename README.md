# Increa Reader

一个面向代码、Markdown、PDF 和画板文件的阅读器，带 AI 聊天侧栏。

## 功能

- 三栏布局：文件树、内容区、聊天区
- 多仓库阅读：可同时挂多个代码仓库
- Markdown / PDF / 代码 / 图片 / HTML / `.board` 预览
- PDF 双视图：原始 PDF 视图 + Markdown 阅读视图
- 便签系统：
  - Markdown / PDF 中双击创建便利贴
  - 支持改颜色、拖动、失焦自动保存、`Esc` 取消编辑
  - 数据保存在仓库内的 `.increa/notes.json`
- AI 辅助：
  - 可读取当前可见内容、选中文本、当前 PDF 页
  - 可读取当前文档全部便签或当前视口便签
  - 支持 PDF MCP 工具和前端交互工具
- 画板能力：`.board` 文件支持 p5.js 指令绘制与截图

## 快速开始

### 1. 安装依赖

```bash
git clone <repository-url>
cd increa-reader
pnpm run setup
```

`setup` 会安装前端依赖、创建 `packages/server/.venv`，并生成 `packages/server/.env`。

### 2. 配置仓库和 AI

编辑 `packages/server/.env`：

```bash
# 要浏览的仓库，多个路径用冒号分隔
INCREA_REPO="/path/to/repo1:/path/to/repo2"

# AI 聊天所需
ANTHROPIC_API_KEY="your-api-key"
```

如果走代理：

```bash
ANTHROPIC_BASE_URL="https://your-proxy-url/api/anthropic"
ANTHROPIC_AUTH_TOKEN="your-proxy-token"
```

也可以先启动应用，再在 UI 的 settings 里配置仓库。

### 3. 启动开发环境

```bash
pnpm dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

## 常用命令

```bash
pnpm dev
pnpm build
pnpm test

pnpm --filter @increa-reader/ui dev
pnpm --filter @increa-reader/ui typecheck
pnpm --filter @increa-reader/ui lint

pnpm --filter @increa-reader/server dev
pnpm --filter @increa-reader/server test
```

## 便签说明

- 便签目前支持 `Markdown` 和 `PDF`
- Markdown 便签按段落锚点定位
- PDF 便签按 `page + ratio` 定位
- PDF 便签只在 `PDF` 原始视图显示，不在 PDF 的 Markdown 视图显示
- AI 可通过工具读取：
  - 当前文档全部便签
  - 当前可见范围便签

## 结构

- `packages/ui`: React 19 + TypeScript + Vite
- `packages/server`: FastAPI + Claude SDK + PyMuPDF
- `packages/pdf-reader-mcp`: PDF MCP 服务

## 排查

**Python / venv 有问题**

```bash
python3 -m venv packages/server/.venv
packages/server/.venv/bin/pip install -r packages/server/requirements.txt
```

**聊天不可用**

检查 `packages/server/.env` 中是否配置了 `ANTHROPIC_API_KEY`。

**没有仓库显示**

检查 `INCREA_REPO`，或者在 UI settings 中重新配置。

**改了后端端口**

如果修改了 `PORT`，记得同步更新 `packages/ui/vite.config.ts` 里的代理目标。

## License

Private repository
