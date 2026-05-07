export interface ToolCall {
  tool_name: string;
  arguments: Record<string, any>;
  result: string;
}

export interface ErrorInfo {
  type: string;
  userMessage: string;
  suggestion: string;
  alternativeProvider?: string;
  alternativeModel?: string;
  alternativeModelDisplayName?: string;
}

export interface MediaFile {
  data: string; // base64
  mimeType: string;
  preview: string; // blob url
  type: 'image' | 'video';
}

export interface QuoteReference {
  id?: string;
  role: 'user' | 'bot';
  content: string;
  author: string;
  modelName?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'bot';
  content: string;
  quote?: QuoteReference;
  media?: MediaFile;
  toolCalls?: ToolCall[];
  error?: ErrorInfo;
  provider?: string;
  model?: string;
  providerName?: string;
  modelName?: string;
  mention?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}
