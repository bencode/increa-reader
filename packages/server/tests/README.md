# Server Tests

## 安装测试依赖

```bash
# 安装所有开发依赖（包括 pytest）
pip install -e '.[dev]'

# 或使用 pnpm
pnpm --filter @increa-reader/server install:dev
```

## 运行测试

```bash
# 在 packages/server 目录下运行所有测试
pytest

# 或使用 pnpm
pnpm --filter @increa-reader/server test

# 运行测试并查看覆盖率
pnpm --filter @increa-reader/server test:cov
```

## 测试文件

- `test_pdf_api.py` - PDF API 接口测试
- `test_pdf_processor.py` - PDF 处理器测试
- `test_pdf_mcp.py` - PDF MCP 工具集成测试
- `test_chat_api.py` - 聊天 API 接口测试（需要服务器运行）
- `test_document.pdf` - 测试用 PDF 文件
