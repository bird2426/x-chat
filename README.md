# AI 多模态聊天机器人 + 智能 Agent 系统

这是一个基于 [Next.js](https://nextjs.org/) 的 AI 聊天机器人，拥有精美的 UI 设计，支持**多个 AI 提供商**、**视频/图片上传**和**智能工具调用**。

✅ **所有模型已验证可用** - 无论是文本对话还是多模态交互，都能流畅运行。

## ✨ 核心特性

- **🎨 极致 UI 设计**: 采用 Glassmorphism 玻璃拟态风格，配合流畅的动画和渐变背景，带来沉浸式体验。
- **🧠 多模型支持**:
  - **Google Gemini**: Gemini 2.5 Flash (多模态，支持视频/图片)
  - **通义千问 Qwen**: Qwen Flash, DeepSeek V3.2, Qwen3 Max 等多个强大模型
- **🛠️ 智能 Agent 系统 (默认开启)**:
  - **☀️ 真实天气查询**: 集成 Open-Meteo API，无需 Key 即可查询全球实时天气及未来7天预报，并以**精美卡片**展示。
  - **🔍 网页搜索**: 使用 Tavily API 搜索互联网，返回结构化结果卡片。
  - **🧮 数学计算**: 自动执行复杂计算。
  - **⏰ 时间查询**: 获取当前精确时间。
- **📹 多模态交互**: 支持上传图片和视频，让 AI "看"懂你的世界。
- **🚀 零配置上手**: 天气等核心工具开箱即用，无需繁琐配置。

## 📸 应用截图

*(此处可以添加项目截图)*

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件并添加你的 API Keys：

```env
# Google Gemini API Key (可选)
GOOGLE_API_KEY=your_google_api_key

# 通义千问 API Key (可选)
QWEN_API_KEY=your_qwen_api_key

# Tavily 搜索 API Key (可选 - 用于真实网页搜索)
TAVILY_API_KEY=your_tavily_api_key
```

> **提示**: 
> - 天气查询、计算器、时间工具 **不需要** 任何 API Key，开箱即用！
> - 至少配置一个 AI 提供商 (Google 或 Qwen) 即可开始对话。

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可体验。

## 💡 使用指南

### 智能 Agent (无感体验)
系统默认开启了智能 Agent 模式。你不需要手动切换任何开关，像平时聊天一样自然提问即可：

*   **问天气**: "今天北京天气怎么样？" -> *显示精美的天气卡片*
*   **搜信息**: "DeepSeek V3 有什么新特性？" -> *显示搜索结果卡片*
*   **算数学**: "3+2等于几？" -> *AI 直接回答*
*   **问时间**: "现在几点了？" -> *AI 报时*

### 切换模型
点击顶部标题栏右侧的 **[切换模型]** 按钮，或直接点击标题文字，即可在不同模型间无缝切换。

### 多模态上传
点击输入框左侧的 **📷 图标**，即可上传图片或视频（请确保当前选择的模型支持多模态，如 Gemini）。

## 🛠️ 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: CSS Modules (Glassmorphism)
- **AI SDK**: Google Generative AI SDK, OpenAI SDK (兼容 Qwen)
- **工具集成**: Open-Meteo (天气), Tavily (搜索)

## 📄 许可证

MIT
