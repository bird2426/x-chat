/**
 * 工具执行器 - 后端工具实现
 */

import { TavilyClient } from 'tavily';
import { callQwenAPI } from './ai-providers';

export interface ToolCall {
  tool_name: string;
  arguments: Record<string, any>;
}

export class ToolExecutor {
  private tools: Record<string, (args: Record<string, any>) => Promise<string>>;

  constructor() {
    this.tools = {
      get_weather: this.getWeather.bind(this),
      search_web: this.searchWeb.bind(this),
      calculate: this.calculate.bind(this),
      get_current_time: this.getCurrentTime.bind(this),
      cyber_fortune_telling: this.cyberFortuneTelling.bind(this),
      plan_trip: this.planTrip.bind(this),
    };
  }

  async execute(toolName: string, args: Record<string, any>): Promise<string> {
    if (!(toolName in this.tools)) {
      return `错误: 未知工具 '${toolName}'`;
    }

    try {
      return await this.tools[toolName](args);
    } catch (error) {
      return `工具执行错误: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async getWeather(args: Record<string, any>): Promise<string> {
    const city = args.city || "";
    
    if (!city) {
      return JSON.stringify({ error: "缺少城市参数" });
    }

    try {
      const timeoutMs = 10_000;
      const fetchJson = async (url: string) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          const text = await res.text();
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
          }
          return JSON.parse(text);
        } finally {
          clearTimeout(timer);
        }
      };

      // 1. 地理编码：将城市名转换为经纬度 (使用 Open-Meteo Geocoding API)
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
      const geoData = await fetchJson(geoUrl);

      if (!geoData?.results || geoData.results.length === 0) {
        return JSON.stringify({ error: `未找到城市: ${city}` });
      }

      const { latitude, longitude, name } = geoData.results[0] || {};
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return JSON.stringify({ error: `城市坐标无效: ${city}` });
      }

      // 2. 获取天气数据 (使用 Open-Meteo Forecast API)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const weatherData = await fetchJson(weatherUrl);

      const currentRaw = weatherData?.current;
      const dailyRaw = weatherData?.daily;
      if (!currentRaw || !dailyRaw || !Array.isArray(dailyRaw.time)) {
        return JSON.stringify({ error: "天气数据格式异常，请稍后再试" });
      }

      // WMO 天气代码映射
      const getWeatherIcon = (code: number) => {
        if (code === 0) return "☀️";
        if (code >= 1 && code <= 3) return "⛅";
        if (code >= 45 && code <= 48) return "🌫️";
        if (code >= 51 && code <= 67) return "🌧️";
        if (code >= 71 && code <= 77) return "❄️";
        if (code >= 80 && code <= 82) return "🌧️";
        if (code >= 85 && code <= 86) return "❄️";
        if (code >= 95) return "⛈️";
        return "🌡️";
      };

      const getWeatherDesc = (code: number) => {
        if (code === 0) return "晴";
        if (code >= 1 && code <= 3) return "多云";
        if (code >= 45 && code <= 48) return "雾";
        if (code >= 51 && code <= 67) return "雨";
        if (code >= 71 && code <= 77) return "雪";
        if (code >= 95) return "雷雨";
        return "未知";
      };

      // 构造当前天气
      const temp = Number(currentRaw.temperature_2m);
      const humidity = Number(currentRaw.relative_humidity_2m);
      const weatherCode = Number(currentRaw.weather_code);
      if (!Number.isFinite(temp) || !Number.isFinite(humidity) || !Number.isFinite(weatherCode)) {
        return JSON.stringify({ error: "天气数据缺失，请稍后再试" });
      }

      const current = {
        temp: Math.round(temp),
        condition: getWeatherDesc(weatherCode),
        humidity: Math.round(humidity),
        icon: getWeatherIcon(weatherCode)
      };

      // 构造未来7天预报
      const times: string[] = dailyRaw.time;
      const codes: number[] = dailyRaw.weather_code || [];
      const maxTemps: number[] = dailyRaw.temperature_2m_max || [];
      const minTemps: number[] = dailyRaw.temperature_2m_min || [];

      const forecast = times.map((time: string, index: number) => {
        const date = new Date(time);
        const todayStr = new Date().toISOString().split('T')[0];
        let dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
        
        if (time === todayStr) dateLabel = "今天";
        
        // 计算简单的明天后天
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        if (time === tomorrowStr) dateLabel = "明天";

        const code = Number(codes[index]);
        const maxT = Number(maxTemps[index]);
        const minT = Number(minTemps[index]);
        const safeCode = Number.isFinite(code) ? code : weatherCode;

        return {
          date: dateLabel,
          temp: Number.isFinite(maxT) && Number.isFinite(minT) ? Math.round((maxT + minT) / 2) : Math.round(temp),
          condition: getWeatherDesc(safeCode),
          icon: getWeatherIcon(safeCode),
          min_temp: Number.isFinite(minT) ? Math.round(minT) : Math.round(temp),
          max_temp: Number.isFinite(maxT) ? Math.round(maxT) : Math.round(temp)
        };
      });

      return JSON.stringify({
        location: name || city, // 使用 API 返回的标准名称
        current: current,
        forecast: forecast
      });

    } catch (error) {
      console.error("Weather API Error:", error);
      return JSON.stringify({ error: "获取天气失败，请稍后再试" });
    }
  }

  private async searchWeb(args: Record<string, any>): Promise<string> {
    const query = args.query || "";
    if (!query) {
      return JSON.stringify({ error: "缺少搜索关键词" });
    }

    // 检查是否配置了 Tavily API Key
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      // 模拟结构化搜索结果
      return JSON.stringify({
        query,
        is_simulated: true,
        results: [
          { title: `${query} - 官方文档`, url: "https://example.com/doc", content: "这是一个关于该搜索词的模拟官方文档内容..." },
          { title: `${query} 的最新动态`, url: "https://news.example.com/latest", content: "最新的行业动态显示..." },
          { title: "维基百科: " + query, url: "https://wikipedia.org/wiki/" + query, content: "维基百科上的详细解释..." }
        ]
      });
    }

    try {
      // 使用真实的 Tavily 搜索 API
      const client = new TavilyClient({ apiKey });
      const response = await client.search({
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      });

      // 返回原始 JSON 结构，让前端渲染
      return JSON.stringify({
        query,
        answer: response.answer,
        results: response.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content
        }))
      });
    } catch (error) {
      return JSON.stringify({ error: `搜索出错: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private async calculate(args: Record<string, any>): Promise<string> {
    const expression = args.expression || "";
    if (!expression) {
      return "错误: 缺少计算表达式";
    }

    try {
      // 简单的安全计算（实际项目应该使用更安全的方法）
      const allowedChars = /^[0-9+\-*/().\s]+$/;
      if (!allowedChars.test(expression)) {
        return "错误: 表达式包含不允许的字符";
      }

      // eslint-disable-next-line no-eval
      const result = eval(expression);
      return `计算结果: ${expression} = ${result}`;
    } catch (error) {
      return `计算错误: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async getCurrentTime(args: Record<string, any>): Promise<string> {
    const now = new Date();
    return `当前时间：${now.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }

  private async cyberFortuneTelling(args: Record<string, any>): Promise<string> {
    const category = args.category || "综合";
    
    const fortunes = [
      { 
        level: "大吉", 
        title: "好耶！是好运气", 
        desc: "今天买的便利店便当会意外地好吃，想见的人刚好也想见你。(跳舞)",
        lucky: "热奶茶"
      },
      { 
        level: "中吉", 
        title: "还不赖嘛", 
        desc: "虽然有点累，但刚洗好的被子有太阳的味道，这就足够拯救世界了。",
        lucky: "毛茸茸的睡衣" 
      },
      { 
        level: "小吉", 
        title: "普普通通也不错", 
        desc: "下班路上的晚霞有点好看，虽然没有发生什么特别的好事，但也没有坏事发生哦。",
        lucky: "耳机里的老歌" 
      },
      { 
        level: "吉", 
        title: "加油加油", 
        desc: "虽然感觉自己像个咸鱼，但就算是咸鱼也是最努力翻身的那一条！今天也辛苦啦。",
        lucky: "路边的小猫" 
      },
      { 
        level: "超吉", 
        title: "无敌了", 
        desc: "感觉整个人都在发光！无论是代码还是人生，今天都拥有 'Debug' 一切的能力。",
        lucky: "刚出炉的面包" 
      },
      {
        level: "大吉",
        title: "不需要思考",
        desc: "偶尔当个笨蛋也挺好的，烦恼全部丢进回收站！今天适合在被窝里通过意念拯救世界。",
        lucky: "肥宅快乐水"
      }
    ];

    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    
    return JSON.stringify({
      category: category,
      fortune_level: fortune.level,
      title: fortune.title,
      interpretation: fortune.desc,
      lucky_item: fortune.lucky,
      tips: "那个... 就算运气不好，吃顿好的就没事了！(拍肚皮)"
    });
  }

  private async planTrip(args: Record<string, any>): Promise<string> {
    const { destination, days = 3, budget_level = "舒适", preferences = "默认" } = args;

    if (!destination) {
      return JSON.stringify({ error: "缺少目的地参数" });
    }

    const prompt = `你是一个专业的旅行规划师。请为用户生成一个去${destination}的旅行计划。
    
    **参数**：
    - 天数：${days}天
    - 预算：${budget_level}
    - 偏好：${preferences}
    
    **必须生成的 JSON 格式**（不要包含 markdown 代码块标记，只返回纯 JSON 字符串）：
    {
      "destination": "${destination}",
      "duration": "${days}天",
      "total_budget": "估算总价（人民币）",
      "highlights": ["亮点1", "亮点2"],
      "daily_itinerary": [
        {
          "day": 1,
          "theme": "第一天的主题",
          "activities": [
            { "time": "上午", "activity": "景点名称", "desc": "简短描述", "cost": "门票价格" },
            { "time": "下午", "activity": "景点名称", "desc": "简短描述", "cost": "门票价格" },
            { "time": "晚上", "activity": "活动或晚餐", "desc": "推荐餐厅或活动", "cost": "预估费用" }
          ]
        }
      ],
      "tips": "旅行小贴士"
    }
    
    请确保内容真实合理，特别是景点和路线安排。`;

    try {
      const planJson = await callQwenAPI(
        "qwen-plus-2025-12-01",
        prompt,
        [],
        undefined,
        "你是一个只输出 JSON 的 API 接口。不要输出任何解释性文字。"
      );

      const cleanJson = planJson.replace(/```json/g, '').replace(/```/g, '').trim();
      
      JSON.parse(cleanJson);
      
      return cleanJson;
    } catch (error) {
      console.error("Plan Trip Error:", error);
      return JSON.stringify({
        error: "生成旅行计划失败，但我收到请求了。",
        destination,
        days
      });
    }
  }
}

/**
 * 从文本中提取工具调用
 */
export function extractToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // 方法1: 提取 JSON 代码块中的工具调用 (```json ... ```)
  const jsonPattern = /```json\s*(\{[\s\S]*?\})\s*```/g;
  let match;

  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data.tool_name && data.arguments) {
        toolCalls.push({
          tool_name: data.tool_name,
          arguments: data.arguments
        });
      }
    } catch (e) {
      console.warn('Failed to parse JSON from code block:', match[1], e);
    }
  }

  // 方法2: 提取单独一行的 JSON 对象
  if (toolCalls.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.includes('tool_name')) {
        try {
          const data = JSON.parse(trimmed);
          if (data.tool_name && data.arguments) {
            toolCalls.push({
              tool_name: data.tool_name,
              arguments: data.arguments
            });
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  // 方法3: 提取 markdown 代码块中的 JSON (``` ... ```)
  if (toolCalls.length === 0) {
    const codeBlockPattern = /```\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = codeBlockPattern.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (data.tool_name && data.arguments) {
          toolCalls.push({
            tool_name: data.tool_name,
            arguments: data.arguments
          });
        }
      } catch (e) {
        console.warn('Failed to parse JSON from code block:', match[1], e);
      }
    }
  }

  // 方法4: 尝试提取裸露的多行 JSON (寻找最外层的 { ... })
  if (toolCalls.length === 0) {
    try {
      const firstOpen = text.indexOf('{');
      const lastClose = text.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        const potentialJson = text.substring(firstOpen, lastClose + 1);
        const data = JSON.parse(potentialJson);
        if (data.tool_name && data.arguments) {
          toolCalls.push({
            tool_name: data.tool_name,
            arguments: data.arguments
          });
        }
      }
    } catch (e) {
      // 忽略解析错误，这可能只是普通文本中包含括号
    }
  }

  return toolCalls;
}
