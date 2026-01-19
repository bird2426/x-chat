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
}

export interface MediaFile {
  data: string; // base64
  mimeType: string;
  preview: string; // blob url
  type: 'image' | 'video';
}

export interface Message {
  role: 'user' | 'bot';
  content: string;
  media?: MediaFile;
  toolCalls?: ToolCall[];
  error?: ErrorInfo;
}
