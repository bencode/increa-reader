# Increa Reader Server

Increa Reader 的 Python 后端，负责文件预览、PDF 能力、聊天流式接口、前端工具桥接和便签持久化。

## 职责

- 多仓库文件树与文件读取
- Markdown / 代码 / 图片 / HTML / PDF 预览接口
- PDF 页面渲染、文本提取、搜索
- Claude SDK 聊天接口与流式返回
- MCP 工具注册：
  - PDF tools
  - frontend tools
- 文档便签 CRUD，数据写入仓库内 `.increa/notes.json`

## 开发

### 安装

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

或者在仓库根目录执行：

```bash
pnpm run setup
```

### 启动

```bash
pnpm --filter @increa-reader/server dev
```

### 测试

```bash
pnpm --filter @increa-reader/server test
pnpm --filter @increa-reader/server test:cov
```

## 环境变量

```bash
INCREA_REPO="/path/to/repo1:/path/to/repo2"
PORT=3000

ANTHROPIC_API_KEY="your-api-key"
ANTHROPIC_BASE_URL="https://api.anthropic.com"
ANTHROPIC_AUTH_TOKEN=""
```

## 关键接口

### 文件与预览

- `GET /api/workspace/tree`
- `GET /api/raw/{repo}/{path}`
- `GET /api/preview?repo={repo}&path={path}`

### PDF

- `GET /api/pdf/metadata`
- `GET /api/pdf/page-render`
- `GET /api/pdf/page`
- `GET /api/pdf/search`

### 聊天

- `POST /api/chat/query`
- `POST /api/chat/abort`
- `GET /api/chat/frontend-events`
- `POST /api/chat/tool-result`

### 便签

- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`

## AI 工具

聊天侧会向模型暴露两类工具：

### PDF tools

- `open_pdf`
- `page_count`
- `extract_text`
- `render_page_png`
- `search_text`
- `close_pdf`

### Frontend tools

- `get_visible_content`
- `get_selection`
- `get_current_page`
- `get_document_notes`
- `get_visible_notes`
- `refresh_view`
- `canvas_*`

其中 `get_document_notes` 和 `get_visible_notes` 用于让 Agent 读取当前文档或当前视口的便签。
