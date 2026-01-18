import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  requiresApiKey: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  supportsVision: boolean;
  supportsVideo: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "google",
    name: "Google Gemini",
    requiresApiKey: true,
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash (多模态)",
        supportsVision: true,
        supportsVideo: true,
      },
    ],
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    requiresApiKey: true,
    models: [
      {
        id: "qwen-flash",
        name: "Qwen Flash (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "deepseek-v3.2",
        name: "DeepSeek V3.2 (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
      // 新增的高级模型
      {
        id: "qwen3-max-preview",
        name: "Qwen3 Max Preview (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "qwen3-235b-a22b-thinking-2507",
        name: "Qwen3 235B Thinking (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "qwen-plus-2025-12-01",
        name: "Qwen Plus 12.01 (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "qwen-plus-2025-07-28",
        name: "Qwen Plus 07.28 (文本)",
        supportsVision: false,
        supportsVideo: false,
      },
    ],
  },
];

export function getProvider(providerId: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}

export function getModel(providerId: string, modelId: string): AIModel | undefined {
  const provider = getProvider(providerId);
  return provider?.models.find((m) => m.id === modelId);
}

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

interface MediaData {
  data: string;
  mimeType: string;
}

export async function callGoogleAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not defined");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Google Gemini 支持直接通过 systemInstruction 设置系统提示词
  const genModel = genAI.getGenerativeModel({ 
    model,
    systemInstruction: systemPrompt 
  });

  const promptParts: any[] = [];
  
  // ... (其余代码保持不变)

  if (media?.data) {
    promptParts.push({
      inlineData: {
        data: media.data,
        mimeType: media.mimeType,
      },
    });
  }

  if (message) {
    promptParts.push({ text: message });
  }

  const chatHistory = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = genModel.startChat({
    history: chatHistory,
  });

  const result = await chat.sendMessage(promptParts);
  const response = await result.response;
  return response.text();
}

export async function callQwenAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error("QWEN_API_KEY is not defined");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  // 构造消息数组，显式指定类型以修复 TS 错误
  const messages: any[] = [];

  // 1. 如果有系统提示词，作为第一条 system 消息放入
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  // 2. 放入历史记录
  history.forEach((msg) => {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  });

  // 3. 放入当前用户消息
  messages.push({
    role: "user",
    content: message,
  });

  const completion = await client.chat.completions.create({
    model,
    messages: messages as any,
  });

  return completion.choices[0]?.message?.content || "没有响应";
}
