# Nagano Bear Chat (X-Chat)

一个温馨、有趣的 AI 聊天机器人系统，以 **自嘲熊 (Nagano Bear / Jibun Tsukkomi Kuma)** 为主题设计。

## ✨ 特性

- **🎨 治愈系 UI**: 暖色调全重构设计，支持全平台响应式布局，移动端极致体验。
- **🐻 趣味互动**: 内置自嘲熊人设与点击互动反馈。
- **🧠 多模型集成**: 支持 Google Gemini 以及阿里云百炼平台（Qwen, DeepSeek, Kimi, Llama）的多种模型。
- **🛠️ 智能 Agent**: 自动调用天气查询、网页搜索、数学计算等工具。
- **🖼️ 多模态**: 支持图片和视频上传。

## 🚀 快速开始

### 1. 安装
```bash
npm install
```

### 2. 配置 `.env.local`
```env
GOOGLE_API_KEY=your_key
QWEN_API_KEY=your_key
TAVILY_API_KEY=your_key  # 可选，用于网页搜索
```

### 3. 运行
```bash
npm run dev
```

## 🛠️ 技术栈

- **Frontend**: Next.js (App Router), CSS Modules
- **AI**: Google Generative AI, Aliyun DashScope (OpenAI Compatible)
- **Tools**: Open-Meteo, Tavily

## 📄 License

MIT
