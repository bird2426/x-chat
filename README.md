# Gemini Video Chatbot

这是一个基于 [Next.js](https://nextjs.org/) 和 Google Gemini API 的简单聊天机器人，支持**视频**和**图片**上传处理。

## 功能
- ✨ 现代化的 UI 设计 (Glassmorphism)
- 🤖 集成 Gemini 2.5 Flash 模型
- 📹 支持上传视频和图片进行多模态对话
- 🚀 一键部署到 Vercel

## 快速开始

1.  **安装依赖**
    ```bash
    npm install
    ```

2.  **配置环境变量**
    创建 `.env.local` 文件并添加你的 Google API Key：
    ```env
    GOOGLE_API_KEY=你的_GOOGLE_API_KEY
    ```
    (你可以从 [Google AI Studio](https://aistudio.google.com/) 获取 key)

3.  **运行开发服务器**
    ```bash
    npm run dev
    ```
    打开 [http://localhost:3000](http://localhost:3000) 即可使用。

## 部署到 Vercel (非常简单！)

1.  将本项目上传到 GitHub。
2.  登录 [Vercel](https://vercel.com/)。
3.  点击 "Add New..." -> "Project"，选择刚才的 GitHub 仓库。
4.  在部署设置的 **Environment Variables** 部分，添加 `GOOGLE_API_KEY`。
5.  点击 **Deploy**。

等待几十秒，你的聊天机器人就上线了！
