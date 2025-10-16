# Text Translator MCP Server

A Model Context Protocol (MCP) server for translating text files with context awareness and iterative glossary building.

## Features

- **Context-Aware Translation**: Maintains context between translation chunks for better coherence
- **Iterative Glossary Building**: Automatically extracts and accumulates terminology during translation
- **Style Analysis**: Analyzes writing style, tone, and domain from text samples
- **Multiple Language Support**: Supports major languages including Chinese, English, Japanese, Korean, etc.
- **Encoding Detection**: Automatically detects file encoding (UTF-8, GBK, etc.)

## Installation

```bash
cd packages/text-translator-mcp
pip install -e ".[dev]"
```

## Usage

### As MCP Server

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "text-translator": {
      "command": "python",
      "args": ["/path/to/translator_server.py"]
    }
  }
}
```

### Available Prompts

#### translate_file (推荐)

快速翻译文件的完整流程 Prompt。

```python
# 参数：
# - input_path: 输入文件路径
# - target_lang: 目标语言（默认 zh-CN）
# - output_format: 输出格式（interleaved | translation_only）
# - chunk_size: 每批段落数（默认 10）

# 使用示例：
translate_file(
    input_path="/path/to/article.txt",
    target_lang="zh-CN",
    output_format="interleaved"  # 或 "translation_only"
)
```

**输出文件命名：**
- `interleaved` 格式：`article.zh-CN.bilingual.txt`（原文-译文混排）
- `translation_only` 格式：`article.zh-CN.txt`（仅译文）
- 术语表：`article.zh-CN.bilingual.glossary.json`

Prompt 会自动引导 Claude Code 完成：
1. 分段读取文件
2. 分批翻译（自动传递上下文）
3. 按指定格式保存文件
4. 保存术语表

### Available Tools

#### 1. analyze_document

Analyze document structure and writing style (returns metadata only, not content).

```python
analyze_document(
    path="/path/to/file.txt",
    target_lang="zh-CN"
)
# Returns: {
#   "path": "...",
#   "total_paragraphs": 500,
#   "file_size": 12345,
#   "encoding": "utf-8",
#   "style_analysis": {
#     "style": "technical/academic/casual",
#     "tone": "formal/informal",
#     "domain": "physics/programming/...",
#     "initial_glossary": {"term": "translation", ...}
#   }
# }
```

#### 2. translate_paragraphs

Translate a batch of paragraphs from file (by index range).

**Important**: Pass the file path and index range, not the paragraph content!

```python
translate_paragraphs(
    file_path="/path/to/file.txt",
    start=0,               # Starting paragraph index (0-based)
    count=10,              # Number of paragraphs to translate
    target_lang="zh-CN",
    context=None,          # First call, or pass previous context
    extract_new_terms=True
)
# Returns: {
#   "translations": ["translation1", "translation2", ...],
#   "start": 0,
#   "count": 10,
#   "context": {...},  # Pass to next call
#   "stats": {
#     "translated": 10,
#     "new_terms": 5,
#     "glossary_size": 25
#   }
# }
```

#### 3. load_glossary / save_glossary

Manage terminology glossaries.

```python
load_glossary(path="/path/to/glossary.json")
save_glossary(glossary={"term": "translation"}, path="/path/to/output.json")
```

#### 4. list_supported_languages

List all supported language codes.

```python
list_supported_languages()
# Returns: {"zh-CN": "简体中文", "en": "English", ...}
```

## Translation Workflow

### 方式 1：使用 Prompt（推荐）

直接使用 `translate_file` Prompt，自动完成全流程：

```bash
# 在 Claude Code 中
User: "使用 translate_file prompt，翻译 /path/to/article.txt 为中文，混排格式"

# Claude 会自动执行所有步骤
```

或者在对话中提供参数：

```bash
User: "翻译文件 /path/to/technical-doc.md，目标语言 en，仅保存译文"

# Claude 会识别并调用 translate_file prompt
```

### 方式 2：手动调用工具（高级用户）

```python
# 1. Analyze document to get total paragraphs
import json
metadata = json.loads(analyze_document(
    path="/path/to/article.txt",
    target_lang="zh-CN"
))
total_paragraphs = metadata["total_paragraphs"]

# 2. Translate in chunks (e.g., 10 paragraphs at a time)
context = None
all_translations = []
chunk_size = 10

for start in range(0, total_paragraphs, chunk_size):
    result = json.loads(translate_paragraphs(
        file_path="/path/to/article.txt",
        start=start,
        count=chunk_size,
        target_lang="zh-CN",
        context=context  # Pass previous context
    ))
    all_translations.extend(result["translations"])
    context = result["context"]  # Update for next chunk

    # Progress tracking
    print(f"Translated {start + result['count']}/{total_paragraphs} paragraphs")

# 3. Save results (implement your own save logic using Write tool)
```

## How It Works

### Context Preservation

Each translation call returns a `context` object containing:
- **glossary**: Accumulated terminology (grows from ~10 to 200 terms)
- **previous_paragraphs**: Last 2 paragraphs (for continuity)
- **style_guide**: Detected writing style, tone, and domain

This context is passed to the next translation call, ensuring consistency.

### Iterative Glossary Building

1. First chunk: Analyze style and extract initial glossary (~10-15 terms)
2. Each subsequent chunk: Extract 5-10 new terms from the translation
3. Glossary grows automatically (up to 200 terms)
4. Later translations benefit from larger glossary

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov

# Format code
ruff format .

# Lint code
ruff check .
```

## Architecture

This server follows MCP best practices:
- **Stateless tools**: No server-side caching
- **Explicit context**: State passed through parameters
- **Sampling API**: Uses client's LLM for translation (model-agnostic)

## License

Part of the increa-reader monorepo.
