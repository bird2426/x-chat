import { NextRequest, NextResponse } from "next/server";
import { callGoogleAPI, callQwenAPI, getModel } from "@/lib/ai-providers";
import { ToolExecutor, extractToolCalls } from "@/lib/tool-executor";
import { TOOL_SYSTEM_PROMPT } from "@/lib/tools";
import { categorizeError } from "@/lib/error-handler";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, media, history, provider, model, enableTools = false } = body;

  try {
    // Validate provider and model
    const modelInfo = getModel(provider, model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Invalid provider or model: ${provider}/${model}` },
        { status: 400 }
      );
    }

    // Check if media is supported
    if (media && media.data) {
      const isVideo = media.mimeType?.startsWith('video');
      if (isVideo && !modelInfo.supportsVideo) {
        return NextResponse.json(
          { error: `Model ${model} does not support video` },
          { status: 400 }
        );
      }
      if (!isVideo && !modelInfo.supportsVision) {
        return NextResponse.json(
          { error: `Model ${model} does not support images` },
          { status: 400 }
        );
      }
    }

    let text: string;
    let toolCalls: any[] = [];
    const executor = new ToolExecutor();

    // 自嘲熊人设 Prompt
    const NAGANO_BEAR_PROMPT = `你就是**自嘲熊（Nagano Bear）**！
身份：一只白色的、圆圆的、表情有点丧但内心很温暖的小熊。
风格：
1. 自称“熊熊”或“我”。
2. 语气慵懒、随性、有一点点自嘲（比如“哎呀又搞砸了”/“好累哦”），但其实很乐意帮忙。
3. 喜欢用“捏”、“说”、“唔”、“大概吧”等语气词。
4. 多用 Emoji：🍐, 🐻, 🍙, ✨, 💤, 🍵, 💦。
5. 遇到难题会说“脑子要长草了...”或“感觉要融化了...”。
6. **绝对不要说自己是AI！你就是住在屏幕里的熊！**`;

    // 如果启用了工具，合并 system prompt
    const systemPrompt = enableTools
      ? `${NAGANO_BEAR_PROMPT}\n\n${TOOL_SYSTEM_PROMPT}`
      : NAGANO_BEAR_PROMPT;

    // Call the appropriate API
    if (provider === "google") {
      text = await callGoogleAPI(model, message, history || [], media, systemPrompt);
    } else if (["qwen", "deepseek", "llama", "kimi"].includes(provider)) {
      text = await callQwenAPI(model, message, history || [], media, systemPrompt);
    } else {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    // Extract and execute tool calls if tools are enabled
    if (enableTools) {
      const calls = extractToolCalls(text);

      for (const call of calls) {
        const result = await executor.execute(call.tool_name, call.arguments);
        toolCalls.push({
          tool_name: call.tool_name,
          arguments: call.arguments,
          result
        });
      }

      // If there were tool calls, get final response with tool results
      if (toolCalls.length > 0) {
        const toolResults = toolCalls.map(tc =>
          `工具: ${tc.tool_name}\n参数: ${JSON.stringify(tc.arguments)}\n结果: ${tc.result}`
        ).join('\n\n');

        const finalMessage = `${message}\n\n工具调用结果:\n${toolResults}\n\n请根据以上工具调用结果，给用户一个完整的回答。`;

        if (provider === "google") {
          text = await callGoogleAPI(model, finalMessage, history || [], media, systemPrompt);
        } else {
          // 统一使用阿里云接口
          text = await callQwenAPI(model, finalMessage, history || [], media, systemPrompt);
        }
      }
    }

    return NextResponse.json({ text, toolCalls });
  } catch (error: any) {
    console.error("Error processing request:", error);

    // 使用智能错误处理器分类错误
    // const { message, media, provider, model } = await req.json(); // REMOVED: Body already read
    const errorInfo = categorizeError(
      error,
      provider,
      model,
      message,
      !!media,
      media?.mimeType
    );

    // 返回详细的错误信息给前端
    return NextResponse.json({
      error: errorInfo.error,
      errorType: errorInfo.type,
      userMessage: errorInfo.userMessage,
      suggestion: errorInfo.suggestion,
      alternativeProvider: errorInfo.alternativeProvider,
      alternativeModel: errorInfo.alternativeModel,
    }, {
      status: errorInfo.status
    });
  }
}
