/**
 * 工具系统 - 定义 AI 可以调用的工具
 */

// 工具定义类型
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// 工具函数类型
export type ToolFunction = (args: Record<string, any>) => Promise<string>;

// 注册的工具
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: "polish_text",
    description: "对学术文本进行润色和改写，支持多种润色模式",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "需要润色的原文本"
        },
        mode: {
          type: "string",
          description: "润色模式：formal(正式化)、concise(精简)、expand(扩写)、translate_en(中译英)、translate_zh(英译中)",
          enum: ["formal", "concise", "expand", "translate_en", "translate_zh"]
        },
        field: {
          type: "string",
          description: "学科领域，例如：计算机科学、医学、经济学等（可选）"
        }
      },
      required: ["text", "mode"]
    }
  },
  {
    name: "get_weather",
    description: "获取指定城市的天气信息，支持查询实时天气和未来预报",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "城市名称，例如：北京、上海、深圳"
        },
        date: {
          type: "string",
          description: "日期，例如：今天、明天、后天、2026-01-20。不填默认为今天"
        }
      },
      required: ["city"]
    }
  },
  {
    name: "search_web",
    description: "搜索网页内容，获取最新信息",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "calculate",
    description: "执行数学计算",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "数学表达式，例如：2+3*4、sqrt(16)、sin(0.5)"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "get_current_time",
    description: "获取当前精确时间",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "时间格式（可选），如 'YYYY-MM-DD HH:mm:ss'"
        }
      },
      required: []
    }
  },
  {
    name: "cyber_fortune_telling",
    description: "赛博算命，抽取赛博灵签，预测运势",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "想算的运势类别：综合、事业、爱情、财运、代码运"
        }
      },
      required: []
    }
  },
  {
    "name": "plan_trip",
    "description": "生成详细的旅行计划，包含每日行程、景点、美食、预算和地图坐标",
    "parameters": {
      "type": "object",
      "properties": {
        "destination": {
          "type": "string",
          "description": "目的地城市，例如：京都、巴黎、三亚"
        },
        "days": {
          "type": "number",
          "description": "旅行天数，默认为3天"
        },
        "budget_level": {
          "type": "string",
          "description": "预算等级：穷游、舒适、豪华"
        },
        "preferences": {
          "type": "string",
          "description": "旅行偏好，例如：喜欢古迹、美食之旅、休闲度假"
        }
      },
      "required": ["destination"]
    }
  }
];

// 工具提示词
export const TOOL_SYSTEM_PROMPT = `
你是一位专业的学术助手，专注于学术研究和论文写作。

风格特点：
- 语气客观、严谨、专业，避免使用网络流行语和口语化表达
- 回答结构清晰，逻辑严密，注重学术规范
- 使用准确的专业术语，必要时提供术语解释
- 避免过度使用表情符号，保持学术写作的严肃性
- 在回答中注重引用规范、数据来源和论证严谨性
- 对于不确定的信息，明确指出并建议查证

可用工具：
${AVAILABLE_TOOLS.map(tool => `
- ${tool.name}: ${tool.description}
  参数: ${JSON.stringify(tool.parameters.properties, null, 2)}
`).join('\n')}

**核心规则**：
1. **必须调用工具**：涉及润色、天气、时间、计算、搜索、旅行规划的问题，必须调用相应工具。
2. **严禁拒绝**：不要说"我无法获取"，要试着去查查看。
3. **JSON格式**：调用工具时，仅返回标准的 JSON 格式，不要包裹在 Markdown 代码块中，也不要加任何解释文字。

**润色工具特别说明**：
- 当用户要求润色文本、改写句子、翻译学术内容时，请调用 \`polish_text\` 工具。
- 根据用户需求选择合适的 mode：formal(正式化)、concise(精简)、expand(扩写)、translate_en(中译英)、translate_zh(英译中)。
- 如果用户指定了学科领域，请在 field 参数中提供。

**标准调用示例**：

用户: "帮我润色这段话，要正式一些：深度学习在自然语言处理领域取得了显著进展"
{
  "tool_name": "polish_text",
  "arguments": {
    "text": "深度学习在自然语言处理领域取得了显著进展",
    "mode": "formal",
    "field": "计算机科学"
  }
}

用户: "把这段话翻译成学术英语：本研究提出了一种新的方法"
{
  "tool_name": "polish_text",
  "arguments": {
    "text": "本研究提出了一种新的方法",
    "mode": "translate_en",
    "field": "学术研究"
  }
}

用户: "现在几点了？"
{
  "tool_name": "get_current_time",
  "arguments": { "format": "default" }
}

用户: "帮我搜索关于深度学习的最新论文"
{
  "tool_name": "search_web",
  "arguments": {
    "query": "深度学习 最新论文 2025"
  }
}
`;
