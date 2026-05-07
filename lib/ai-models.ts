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
  mentionAliases?: string[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "bailian",
    name: "阿里云百炼",
    requiresApiKey: true,
    models: [
      {
        id: "qwen3.6-plus",
        name: "Qwen3.6-Plus",
        supportsVision: true,
        supportsVideo: false,
        mentionAliases: ["qwen3.6", "qwen36", "qwen-plus", "通义千问"],
      },
      {
        id: "qwen3.5-plus",
        name: "Qwen3.5-Plus",
        supportsVision: true,
        supportsVideo: false,
        mentionAliases: ["qwen3.5", "qwen35"],
      },
      {
        id: "qwen3-max-2026-01-23",
        name: "Qwen3-Max",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["qwen-max", "qwen3-max"],
      },
      {
        id: "qwen3-coder-next",
        name: "Qwen3-Coder-Next",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["qwen-coder-next"],
      },
      {
        id: "qwen3-coder-plus",
        name: "Qwen3-Coder-Plus",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["qwen-coder", "qwen-coder-plus"],
      },
      {
        id: "glm-5",
        name: "GLM-5",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["glm5", "智谱"],
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["glm47", "glm4.7"],
      },
      {
        id: "kimi-k2.5",
        name: "Kimi-K2.5",
        supportsVision: true,
        supportsVideo: false,
        mentionAliases: ["kimi", "月之暗面"],
      },
      {
        id: "MiniMax-M2.5",
        name: "MiniMax-M2.5",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["minimax", "minimax-m2.5"],
      },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    requiresApiKey: true,
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        supportsVision: true,
        supportsVideo: true,
        mentionAliases: ["gemini", "gemini-flash"],
      },
      {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash-Lite",
        supportsVision: true,
        supportsVideo: true,
        mentionAliases: ["gemini-lite", "flash-lite"],
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    requiresApiKey: true,
    models: [
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["deepseek", "deepseek-pro", "ds-pro", "深度求索"],
      },
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        supportsVision: false,
        supportsVideo: false,
        mentionAliases: ["deepseek-flash", "ds-flash"],
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
