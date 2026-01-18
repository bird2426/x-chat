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

    // 如果启用了工具，设置 system prompt
    const systemPrompt = enableTools ? TOOL_SYSTEM_PROMPT : undefined;

    // Call the appropriate API
    if (provider === "google") {
      text = await callGoogleAPI(model, message, history || [], media, systemPrompt);
    } else if (provider === "qwen") {
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
        } else if (provider === "qwen") {
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
