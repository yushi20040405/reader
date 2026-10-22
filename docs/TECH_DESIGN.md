# TECH_DESIGN：桌面版 EPUB/TXT 电子阅读器

## 1. 技术栈
- Electron + React + TypeScript + Vite
- EPUB 解析：epub.js（只引入一套 EPUB 解析库）
- TXT 编码识别：jschardet + iconv-lite（或等价库）
- 状态管理：优先复用项目现有方案；无则使用轻量 store
- 持久化：主进程文件存储或 electron-store
- 样式：CSS 变量主题系统

## 2. 进程职责
### 主进程
- 创建窗口、文件对话框、读取本地文件
- TXT 编码检测与转码
- 持久化读写
- 最近阅读管理

### preload
暴露最小 API：
- openBookFile()
- readBookFile(path)
- getPathForFile(file)（拖拽文件取绝对路径）
- getRecentFiles() / saveRecentFile(entry)
- getProgress(bookId) / saveProgress(bookId, progress)
- getSettings() / saveSettings(settings)
- getTheme() / saveTheme(theme)

开启 contextIsolation，关闭 nodeIntegration 与脚本注入；EPUB 正文 iframe 另设 sandbox 与 CSP（`script-src 'none'`）禁止脚本执行。

### 渲染进程
- UI、目录面板、阅读视图、主题、排版设置
- 不直接滥用 Node API

## 3. 目录结构
src/
  main/
    main.ts
    ipc/
    storage/
  preload/
    preload.ts
  renderer/
    App.tsx
    components/
      Layout/
      Toolbar/
      TocPanel/
      ReaderView/
      ThemeToggle/
    features/
      books/
        bookTypes.ts
        bookStore.ts
      epub/
        epubLoader.ts
        epubAdapter.ts
        epubToc.ts
      txt/
        txtLoader.ts
        txtAdapter.ts
        txtToc.ts
      reader/
        readerAdapter.ts
        chapterNavigation.ts
        tocFilter.ts
      theme/
        themeStore.ts
        themeColors.ts
        theme.css
      progress/
        progressStore.ts
    types/
      assets.d.ts

## 4. 统一数据模型
```ts
type BookFormat = 'epub' | 'txt';

interface Book {
  id: string;              // 路径 hash 或内容 hash
  title: string;
  format: BookFormat;
  filePath: string;
  createdAt: number;
  lastReadAt: number;
  cover?: string;
}

interface TocItem {
  id: string;
  label: string;
  level: number;
  href?: string;           // EPUB
  charOffset?: number;     // TXT
  children?: TocItem[];
}

interface ReadingProgress {
  bookId: string;
  chapterId?: string;
  cfi?: string;            // EPUB
  charOffset?: number;     // TXT
  percent?: number;
  updatedAt: number;
}

## 6. 阶段三（v1.2）实现说明
- 主题：`themeStore.applyTheme(theme)` 在 `documentElement` 上设置 `data-theme`，外部 UI 通过 `theme.css` 的 CSS 变量联动；EPUB 正文由 `EpubAdapter.applyTheme` 向 iframe 注入主题 `<style>`（`themeColors.ts` 提供与 CSS 变量一致的 `--reader-bg/--reader-text/--link`）；TXT 正文直接使用页面 CSS 变量，无需额外注入。主题与排版（字号/行距/宽度）解耦，切换主题不触碰排版设置。
- 主题持久化：主进程 `theme.json`，`getTheme`/`saveTheme` IPC。
- 目录搜索：`reader/tocFilter.ts` 提供大小写不敏感过滤，匹配项的祖先节点保留；过滤中强制展开。
- 章节进度提示：仅 TXT 可真实计算（`charOffset / 文本长度`），EPUB 不伪造、返回 null。
- 安全：`main.ts` 开启 `contextIsolation`、关闭 `nodeIntegration`、启用 `sandbox`；EPUB 渲染 `allowScriptedContent:false` + 注入 CSP `script-src 'none'`。
- 打包：`electron-builder.yml` 设 `win.signAndEditExecutable:false`（无签名证书，且默认 winCodeSign 需符号链接权限），产物为未签名 NSIS 安装包。