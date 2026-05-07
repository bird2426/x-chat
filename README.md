# X-Chat

一个面向学术研究和论文写作的 AI 聊天助手，支持阿里云百炼、Google Gemini 和 DeepSeek 模型、多模型群聊、多模态输入、本地多会话历史和工具调用。

## 特性

- 学术助手人设：论文润色、翻译、文献检索辅助和研究问题回答。
- 多会话历史：使用 IndexedDB 在浏览器本地持久化保存会话，并在左侧侧栏展示。
- 流式响应：聊天接口支持 NDJSON 流式输出。
- 多模型选择：支持阿里云百炼 OpenAI-compatible 模型、DeepSeek OpenAI-compatible 模型，以及已验证可用的 Gemini Flash / Flash-Lite 模型。
- 多模型群聊：在输入中使用 `@DeepSeek`、`@Gemini`、`@Qwen3.6-Plus` 等提及模型，被提及模型会并行回复。
- 工具调用：支持文本润色、天气、网页搜索、计算、时间和旅行规划等工具。
- 多模态输入：支持图片和视频上传，前端会按模型能力限制可用输入。

## 快速开始

### 1. 安装
```bash
npm install
```

### 2. 配置 `.env.local`
```env
BAILIAN_API_KEY=your_bailian_api_key
GOOGLE_API_KEY=your_google_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
TAVILY_API_KEY=your_tavily_api_key

CHAT_LOG_LEVEL=info
CHAT_LOG_TRANSCRIPT=0
CHAT_LOG_REDACT=1
CHAT_LOG_MAX_CHARS=8000
```

### 3. 运行
```bash
npm run dev
```

## 本地历史说明

会话历史保存在浏览器 `IndexedDB` 中。正常刷新页面不会丢失，但清除站点数据、隐身模式、换浏览器、换域名或端口都会看到不同的本地历史。当前持久化保存文本、工具结果和错误信息，不保存上传媒体的 base64 内容；活跃会话 ID 和模型偏好仍用少量 `localStorage` 保存。

## 技术栈

- **Frontend**: Next.js (App Router), CSS Modules
- **AI**: Aliyun Bailian / DashScope (OpenAI Compatible), Google Gemini
- **Tools**: Open-Meteo, Tavily

## License

MIT
