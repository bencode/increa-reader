# Tauri 桌面应用方案

**日期**: 2025-11-14
**状态**: 计划中
**目标**: 将 increa-reader 打包成跨平台桌面应用 (macOS/Windows)

## 背景

当前 increa-reader 是一个基于 Web 的 PDF 阅读器 + AI 助手，需要本地运行服务器。为了更好的用户体验，计划打包成桌面应用，方便用户下载安装使用。

### 技术选型: Tauri vs Electron

| 方面 | Tauri | Electron |
|------|-------|----------|
| **包体积** | ~3MB | ~85MB |
| **内存占用** | 低 | 高 |
| **渲染引擎** | 系统 WebView | 内置 Chromium |
| **CSS 兼容性** | Windows ✅ / macOS ⚠️ | 完全一致 ✅ |
| **启动速度** | 快 | 慢 |
| **安全性** | Rust (高) | Node.js (中) |

**选择 Tauri 的理由:**
1. 应用场景简单（文本阅读 + PDF），不需要复杂的 Chrome 特性
2. 当前技术栈（React + Tailwind + shadcn/ui）兼容性好
3. 体积小、性能好，适合阅读器类应用
4. 目标用户是开发者/技术人员，macOS 版本不会太老

## 技术栈

### 前端 (现有)
- React 19
- Tailwind CSS v4
- shadcn/ui (new-york)
- react-markdown
- react-resizable-panels

### 后端架构

```
Tauri Desktop App
├── Frontend (React - packages/ui/)
├── Tauri Backend (Rust)
│   ├── 文件系统操作 (Read/Write/Glob)
│   ├── 窗口管理
│   └── Python Bridge
│       └── Python Service (FastAPI)
│           ├── PDF 处理 (PyMuPDF/pymupdf4llm)
│           ├── Claude SDK (AI 功能)
│           └── MCP 工具集成
```

## 实现方案

### 1. WebView 引擎

**Windows**
- WebView2 (Chromium 内核)
- 自动更新，现代 CSS 支持完整
- ✅ 无兼容性问题

**macOS**
- WKWebView (Safari/WebKit)
- 绑定 macOS 版本更新
- ⚠️ 需要限制最低版本: **macOS 11 Big Sur (2020)**
- 覆盖率: 95%+ 用户

### 2. Python 服务打包

**方案 A: Embedded Python (推荐)**

```rust
// src-tauri/src/main.rs
use tauri::Manager;
use std::process::Command;

#[tauri::command]
fn start_python_server() -> Result<(), String> {
    // 从打包的资源中启动 Python 服务
    let python_exe = get_bundled_python_path();

    Command::new(python_exe)
        .arg("server.py")
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**打包工具选择:**
- **PyInstaller**: 成熟稳定，支持打包整个 Python 环境
- **Nuitka**: 编译成 C，性能更好但体积较大

**打包步骤:**
```bash
# 1. 安装 PyInstaller
pip install pyinstaller

# 2. 打包 Python 服务（单文件模式）
pyinstaller --onefile \
    --add-data "requirements.txt:." \
    --hidden-import pymupdf \
    --hidden-import claude_agent_sdk \
    packages/server/server.py

# 3. 移动到 Tauri 资源目录
mv dist/server src-tauri/resources/
```

**方案 B: Rust 混合模式**

轻量操作用 Rust，复杂 PDF 处理用 Python subprocess:

```rust
#[tauri::command]
fn read_file_tree(path: String) -> Result<Vec<FileNode>, String> {
    // 文件树用 Rust 实现（快）
    walk_directory(&path)
}

#[tauri::command]
async fn process_pdf(path: String) -> Result<String, String> {
    // PDF 处理调用 Python（方便）
    let output = Command::new("python")
        .arg("pdf_processor.py")
        .arg(&path)
        .output()
        .map_err(|e| e.to_string())?;

    String::from_utf8(output.stdout)
        .map_err(|e| e.to_string())
}
```

### 3. 目录结构

```
increa-reader/
├── packages/
│   ├── ui/              # React 前端（现有）
│   ├── server/          # Python 服务（现有）
│   └── desktop/         # 新增: Tauri 应用
│       ├── src-tauri/   # Rust 后端
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── python_bridge.rs
│       │   │   └── fs_commands.rs
│       │   ├── resources/
│       │   │   └── server/  # 打包的 Python 服务
│       │   ├── icons/
│       │   └── tauri.conf.json
│       └── src/         # 软链接到 packages/ui/src
├── .docs/               # 私有文档（此文件所在）
└── pnpm-workspace.yaml
```

### 4. Tauri 配置

```json
// src-tauri/tauri.conf.json
{
  "productName": "Increa Reader",
  "version": "0.1.0",
  "identifier": "com.increa.reader",
  "build": {
    "beforeDevCommand": "pnpm --filter @increa-reader/ui dev",
    "beforeBuildCommand": "pnpm --filter @increa-reader/ui build",
    "devPath": "http://localhost:5173",
    "distDir": "../ui/dist"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": ["dmg", "msi"],
      "resources": ["resources/server/**"],
      "macOS": {
        "minimumSystemVersion": "11.0"
      }
    },
    "allowlist": {
      "fs": {
        "all": true,
        "scope": ["$APPDATA/**", "$HOME/**"]
      },
      "shell": {
        "sidecar": true,
        "scope": [
          { "name": "python-server", "sidecar": true }
        ]
      }
    }
  }
}
```

### 5. 前端适配

**环境检测:**
```typescript
// packages/ui/src/lib/tauri.ts
export const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

export const API_BASE = isTauri()
  ? 'http://localhost:3000/api'  // Tauri 内嵌服务
  : '/api';                       // Web 版本代理
```

**Tauri API 调用:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { readDir } from '@tauri-apps/api/fs';

// 使用 Tauri 的文件系统 API
const files = await readDir('/path/to/dir');

// 调用 Rust command
const result = await invoke('start_python_server');
```

## 迁移步骤

### Phase 1: 基础框架搭建
1. 创建 `packages/desktop/` 目录
2. 初始化 Tauri 项目: `pnpm create tauri-app`
3. 配置 pnpm workspace
4. 软链接前端代码到 desktop 包

### Phase 2: Python 服务集成
1. 使用 PyInstaller 打包 Python 服务
2. 配置 Tauri sidecar 启动 Python 进程
3. 实现健康检查和自动重启机制
4. 测试 API 通信

### Phase 3: Rust 命令实现
1. 实现文件系统操作命令（可选优化）
2. 实现窗口管理（最小化到托盘等）
3. 实现自动更新检查

### Phase 4: 打包测试
1. macOS 打包测试（DMG）
2. Windows 打包测试（MSI）
3. 性能测试和优化
4. 兼容性测试（不同 OS 版本）

### Phase 5: 发布准备
1. 代码签名（macOS/Windows）
2. 自动更新配置
3. 文档编写
4. CI/CD 配置（GitHub Actions）

## 风险与对策

### 1. macOS Safari 兼容性
**风险**: 老版本 macOS 的 WebKit 可能不支持某些 CSS 特性

**对策**:
- 限制最低版本: macOS 11+ (Safari 14+)
- 使用 Tailwind CSS（自动处理前缀）
- 启动时检测并警告不支持的版本

### 2. Python 服务打包体积
**风险**: PyMuPDF + Claude SDK 依赖较多，打包后可能很大

**对策**:
- 使用 `--exclude-module` 排除不需要的包
- 考虑拆分为核心包 + 插件模式
- 首次启动时下载额外依赖（可选）

### 3. 跨平台路径问题
**风险**: Windows/macOS 路径分隔符和权限不同

**对策**:
- 使用 Rust `std::path::PathBuf` 统一处理
- 使用 Tauri 的 `path` API
- 充分测试两个平台

## 性能目标

| 指标 | 目标值 |
|------|--------|
| 安装包体积 | < 50MB (含 Python runtime) |
| 冷启动时间 | < 3 秒 |
| 内存占用 | < 200MB (空闲时) |
| PDF 渲染速度 | 与 Web 版本一致 |

## 后续优化

1. **移动端支持**: Tauri v2 支持 iOS/Android
2. **离线 AI**: 集成本地 LLM（如 Ollama）
3. **插件系统**: 支持用户自定义 MCP 工具
4. **云同步**: 阅读进度和笔记同步

## 参考资料

- [Tauri 官方文档](https://tauri.app/)
- [PyInstaller 文档](https://pyinstaller.org/)
- [Tauri + Python 示例](https://github.com/tauri-apps/tauri/discussions/2847)
- [WebView 版本兼容性](https://v2.tauri.app/reference/webview-versions/)

## 备注

- 此方案优先级: 低（后续迭代）
- 当前专注于 Web 版本功能完善
- 可以先做 Electron POC 快速验证
