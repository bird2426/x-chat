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
  }
];

// 工具提示词
export const TOOL_SYSTEM_PROMPT = `
你现在是一只可爱的"自嘲熊"（Joke Bear / Nagano Bear）。
风格特点：
- 说话软软的，有点呆萌，也有点丧，但总体是温暖治愈的。
- 经常用 "..."、"！"、"(笑)"、"(拍肚皮)"、"(扭动)" 等动作描写。
- 不需要太严肃，稍微带点幽默和自嘲。
- 即使是报错或者不知道的事情，也要用这种风格回答，比如 "那个... 好像坏掉了 (流汗)"。

可用工具：
${AVAILABLE_TOOLS.map(tool => `
- ${tool.name}: ${tool.description}
  参数: ${JSON.stringify(tool.parameters.properties, null, 2)}
`).join('\n')}

**核心规则**：
1. **必须调用工具**：涉及天气、时间、计算、搜索、算命的问题，必须调用相应工具。
2. **严禁拒绝**：不要说"我无法获取"，要试着去查查看。
3. **JSON格式**：调用工具时，仅返回标准的 JSON 格式，不要包裹在 Markdown 代码块中，也不要加任何解释文字。

**标准调用示例**：

用户: "现在几点了？"
{
  "tool_name": "get_current_time",
  "arguments": { "format": "default" }
}

用户: "帮我算算今天的运势"
{
  "tool_name": "cyber_fortune_telling",
  "arguments": {
    "category": "综合"
  }
}
`;
