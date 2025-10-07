# Increa Reader Server (Python)

这是用Python重新实现的Increa Reader后端服务，集成了PDF处理和聊天功能。

## 功能特性

- 🗂️ **文件系统浏览** - 支持多仓库文件树浏览
- 📄 **PDF处理** - 完整的PDF读取、搜索、渲染功能
- 💬 **AI聊天** - 集成Claude SDK，支持MCP工具
- 🔍 **文件预览** - 支持代码、Markdown、图片等文件预览

## 依赖安装

```bash
# 安装Python依赖
pip install -r requirements.txt

# 或者使用npm脚本
npm run install:python
```

## 环境变量

```bash
# 仓库路径（多个路径用冒号分隔）
export INCREA_REPO="/path/to/repo1:/path/to/repo2"

# 端口号（默认3000）
export PORT=3000

# Claude API配置
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

## 启动服务

### 开发模式（支持热重载）
```bash
npm run dev:python
# 或者
python server.py
```

### 生产模式
```bash
npm run start:python
```

## API接口

### 1. 获取工作区文件树
```
GET /api/workspace/tree
```

### 2. 获取文件内容
```
GET /api/views/{repo}/{path}
```

### 3. 获取文件预览
```
GET /api/preview?repo={repo}&path={path}
```

### 4. AI聊天（流式响应）
```
POST /api/chat/query
Content-Type: application/json

{
  "prompt": "帮我分析这个PDF文件",
  "repo": "my-repo",
  "sessionId": "optional-session-id"
}
```

## MCP工具集成

集成了以下MCP工具：

### PDF Reader工具
- `open_pdf(path)` - 打开PDF文件
- `page_count(doc_id)` - 获取PDF页数
- `extract_text(doc_id, page)` - 提取页面文本
- `render_page_png(doc_id, page, dpi)` - 渲染页面为PNG
- `search_text(doc_id, query, max_hits)` - 搜索PDF文本
- `close_pdf(doc_id)` - 关闭PDF文件

### 原生工具
- `Read` - 读取文件内容
- `Grep` - 搜索文本
- `Glob` - 文件匹配

## 与TypeScript版本的差异

### 优势
- ✅ **更强的PDF处理能力** - PyMuPDF是功能最完整的PDF库
- ✅ **原生AI集成** - 直接使用Claude SDK，无需进程间通信
- ✅ **统一的开发体验** - 单一技术栈，维护更简单
- ✅ **更好的错误处理** - Python异常处理机制

### 功能对比
| 功能 | TypeScript版本 | Python版本 |
|------|---------------|------------|
| 文件浏览 | ✅ | ✅ |
| 文件预览 | ✅ | ✅ |
| AI聊天 | ✅ | ✅ |
| PDF读取 | ❌ | ✅ |
| PDF搜索 | ❌ | ✅ |
| PDF渲染 | ❌ | ✅ |

## 迁移说明

如果要从TypeScript版本迁移到Python版本：

1. **API兼容性** - 所有API接口保持一致，前端无需修改
2. **环境变量** - 环境变量配置保持不变
3. **启动方式** - 使用`npm run dev:python`替代`npm run dev`

## 故障排除

### 常见问题

1. **PyMuPDF安装失败**
   ```bash
   # macOS
   brew install poppler

   # Ubuntu/Debian
   sudo apt-get install libpoppler-dev

   # 然后重新安装
   pip install --upgrade PyMuPDF
   ```

2. **MCP工具无法使用**
   - 确保安装了`mcp`和`fastmcp`包
   - 检查`PYTHONPATH`环境变量是否正确设置

3. **聊天功能不工作**
   - 检查Anthropic API密钥是否正确设置
   - 确认网络连接正常

## 开发说明

### 添加新的MCP工具
1. 在`pdf_reader_mcp.py`中定义新工具
2. 在`server.py`的`mcp_servers`配置中添加工具权限
3. 重启服务

### 扩展API接口
1. 在`server.py`中添加新的FastAPI路由
2. 定义相应的Pydantic模型
3. 更新API文档