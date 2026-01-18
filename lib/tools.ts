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
  }
];

// 工具提示词
export const TOOL_SYSTEM_PROMPT = `
你是一个拥有强大工具的智能助手。

可用工具：
${AVAILABLE_TOOLS.map(tool => `
- ${tool.name}: ${tool.description}
  参数: ${JSON.stringify(tool.parameters.properties, null, 2)}
`).join('\n')}

**核心规则**：
1. **必须调用工具**：涉及天气、时间、计算、搜索的问题，必须调用相应工具，严禁凭空回答。
2. **严禁拒绝**：不要说"我无法获取"、"我没有实时能力"。你有工具，用就是了。
3. **JSON格式**：调用工具时，仅返回标准的 JSON 格式，不要包裹在 Markdown 代码块中，也不要加任何解释文字。

**标准调用示例**：

用户: "现在几点了？"
{
  "tool_name": "get_current_time",
  "arguments": { "format": "default" }
}

用户: "明天上海天气如何？"
{
  "tool_name": "get_weather",
  "arguments": {
    "city": "上海",
    "date": "明天"
  }
}
`;
