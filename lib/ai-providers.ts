import OpenAI from "openai";
import { Content, GoogleGenerativeAI, Part } from "@google/generative-ai";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

interface MediaData {
  data: string;
  mimeType: string;
}

let proxyDispatcherConfigured = false;

async function configureNodeFetchProxy() {
  if (proxyDispatcherConfigured || typeof window !== "undefined") return;

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) {
    proxyDispatcherConfigured = true;
    return;
  }

  const { ProxyAgent, setGlobalDispatcher } = await new Function(
    "specifier",
    "return import(specifier)"
  )("undici");
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  proxyDispatcherConfigured = true;
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

function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not defined");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
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

function buildOpenAICompatibleMessages(
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): any[] {
  return buildBailianMessages(message, history, media, systemPrompt);
}

function getDeepSeekThinkingOptions(model: string) {
  if (model === "deepseek-v4-pro") {
    return {
      thinking: { type: "enabled" },
      reasoning_effort: "high",
    };
  }

  return {};
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

export async function callDeepSeekAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): Promise<string> {
  const client = createDeepSeekClient();
  const messages = buildOpenAICompatibleMessages(message, history, media, systemPrompt);
  const completion = await client.chat.completions.create({
    model,
    messages,
    ...getDeepSeekThinkingOptions(model),
  } as any);

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

export async function* streamDeepSeekAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): AsyncGenerator<string> {
  const client = createDeepSeekClient();
  const messages = buildOpenAICompatibleMessages(message, history, media, systemPrompt);
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    ...getDeepSeekThinkingOptions(model),
  } as any) as unknown as AsyncIterable<any>;

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

function createGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not defined");
  }

  return new GoogleGenerativeAI(apiKey);
}

function buildGeminiContents(message: string, history: ChatMessage[], media?: MediaData): Content[] {
  const contents: Content[] = history
    .filter((msg) => msg.content.trim())
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  const parts: Part[] = [];
  if (message) {
    parts.push({ text: message });
  }

  if (media?.data) {
    parts.push({
      inlineData: {
        data: media.data,
        mimeType: media.mimeType,
      },
    });
  }

  contents.push({
    role: "user",
    parts: parts.length ? parts : [{ text: message || "请分析上传的内容。" }],
  });

  return contents;
}

export async function callGeminiAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): Promise<string> {
  await configureNodeFetchProxy();
  const client = createGeminiClient();
  const generativeModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await generativeModel.generateContent({
    contents: buildGeminiContents(message, history, media),
  });

  return result.response.text() || "没有响应";
}

export async function* streamGeminiAPI(
  model: string,
  message: string,
  history: ChatMessage[],
  media?: MediaData,
  systemPrompt?: string
): AsyncGenerator<string> {
  await configureNodeFetchProxy();
  const client = createGeminiClient();
  const generativeModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await generativeModel.generateContentStream({
    contents: buildGeminiContents(message, history, media),
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}
