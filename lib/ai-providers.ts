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
    id: "bailian",
    name: "阿里云百炼",
    requiresApiKey: true,
    models: [
      // 千问
      {
        id: "qwen3.6-plus",
        name: "Qwen3.6-Plus",
        supportsVision: true,
        supportsVideo: false,
      },
      {
        id: "qwen3.5-plus",
        name: "Qwen3.5-Plus",
        supportsVision: true,
        supportsVideo: false,
      },
      {
        id: "qwen3-max-2026-01-23",
        name: "Qwen3-Max",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "qwen3-coder-next",
        name: "Qwen3-Coder-Next",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "qwen3-coder-plus",
        name: "Qwen3-Coder-Plus",
        supportsVision: false,
        supportsVideo: false,
      },
      // 智谱 GLM
      {
        id: "glm-5",
        name: "GLM-5",
        supportsVision: false,
        supportsVideo: false,
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        supportsVision: false,
        supportsVideo: false,
      },
      // Kimi
      {
        id: "kimi-k2.5",
        name: "Kimi-K2.5",
        supportsVision: true,
        supportsVideo: false,
      },
      // MiniMax
      {
        id: "MiniMax-M2.5",
        name: "MiniMax-M2.5",
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

function createBailianClient() {
  const apiKey = process.env.BAILIAN_API_KEY;
  if (!apiKey) {
    throw new Error("BAILIAN_API_KEY is not defined");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://coding.dashscope.aliyuncs.com/v1",
  });
}

function buildBailianMessages(
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): any[] {
  const messages: any[] = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  history.forEach((msg) => {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  });

  const userMessage: any = {
    role: "user",
    content: message,
  };

  if (media?.data) {
    userMessage.content = [
      { type: "text", text: message },
      {
        type: "image_url",
        image_url: { url: `data:${media.mimeType};base64,${media.data}` },
      },
    ];
  }

  messages.push(userMessage);
  return messages;
}

export async function callBailianAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): Promise<string> {
  const client = createBailianClient();
  const messages = buildBailianMessages(message, history, media, systemPrompt);
  const completion = await client.chat.completions.create({
    model,
    messages,
  });

  return completion.choices[0]?.message?.content || "没有响应";
}

export async function* streamBailianAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): AsyncGenerator<string> {
  const client = createBailianClient();
  const messages = buildBailianMessages(message, history, media, systemPrompt);
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
