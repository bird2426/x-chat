import { NextRequest, NextResponse } from "next/server";
import {
  callBailianAPI,
  callGeminiAPI,
  streamBailianAPI,
  streamGeminiAPI,
} from "@/lib/ai-providers";
import { getModel } from "@/lib/ai-models";
import { ToolExecutor, extractToolCalls } from "@/lib/tool-executor";
import { TOOL_SYSTEM_PROMPT } from "@/lib/tools";
import { categorizeError } from "@/lib/error-handler";
import { randomUUID } from "crypto";
import {
  isTranscriptLoggingEnabled,
  logEvent,
  sanitizeForLog,
  sanitizeTextForLog,
} from "@/lib/logger";

function shouldAttemptToolCall(message: string): boolean {
  const normalized = message.toLowerCase();
  const toolKeywords = [
    "润色",
    "改写",
    "翻译",
    "translate",
    "translation",
    "天气",
    "气温",
    "下雨",
    "几点",
    "现在时间",
    "当前时间",
    "搜索",
    "查一下",
    "查找",
    "最新",
    "新闻",
    "论文",
    "文献",
    "计算",
    "算一下",
    "sqrt",
    "sin(",
    "cos(",
    "旅行",
    "行程",
    "攻略",
    "灵签",
  ];

  return toolKeywords.some((keyword) => normalized.includes(keyword));
}

async function callProviderAPI(
  provider: string,
  model: string,
  message: string,
  history: Array<{ role: "user" | "bot"; content: string }>,
  media?: { data: string; mimeType: string },
  systemPrompt?: string
) {
  if (provider === "bailian") {
    return callBailianAPI(model, message, history, media, systemPrompt);
  }
  if (provider === "gemini") {
    return callGeminiAPI(model, message, history, media, systemPrompt);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function streamProviderAPI(
  provider: string,
  model: string,
  message: string,
  history: Array<{ role: "user" | "bot"; content: string }>,
  media?: { data: string; mimeType: string },
  systemPrompt?: string
) {
  if (provider === "bailian") {
    return streamBailianAPI(model, message, history, media, systemPrompt);
  }
  if (provider === "gemini") {
    return streamGeminiAPI(model, message, history, media, systemPrompt);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function buildToolFinalMessage(
  message: string,
  toolCalls: Array<{
    tool_name: string;
    arguments: Record<string, unknown>;
    result: string;
  }>
) {
  const toolResults = toolCalls.map(tc =>
    `工具: ${tc.tool_name}\n参数: ${JSON.stringify(tc.arguments)}\n结果: ${tc.result}`
  ).join('\n\n');

  const hasPolishResult = toolCalls.some((tc) => tc.tool_name === "polish_text");
  if (hasPolishResult) {
    return `${message}\n\n工具调用结果:\n${toolResults}\n\n请根据 polish_text 工具调用结果回答用户。要求：\n1. 只展示润色后文本和简要修改说明。\n2. 不要新增原文之外的写作建议、实验建议、数据建议或研究结论。\n3. 不要重复展示原文，除非用户明确要求对照。\n4. 保持回答简洁、清晰。`;
  }

  const hasFortuneResult = toolCalls.some((tc) => tc.tool_name === "cyber_fortune_telling");
  if (hasFortuneResult) {
    return `${message}\n\n工具调用结果:\n${toolResults}\n\n请用轻松、简短的语气告诉用户签文已抽出即可。要求：\n1. 不要学术化解读，不要扩展心理学、行为建议或研究结论。\n2. 不要重复完整签文内容，签文内容会由工具卡片展示。\n3. 只输出一句不超过 25 个汉字的提示。`;
  }

  return `${message}\n\n工具调用结果:\n${toolResults}\n\n请根据以上工具调用结果，给用户一个完整的回答。`;
}

function shouldShowToolResultOnly(
  toolCalls: Array<{
    tool_name: string;
  }>
) {
  return toolCalls.some((tc) => ["polish_text", "cyber_fortune_telling"].includes(tc.tool_name));
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  let body;
  try {
    body = await req.json();
  } catch {
    logEvent("warn", "chat.invalid_json", {
      requestId,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, media, history, provider, model, enableTools = false, stream = false } = body;

  try {
    const transcriptEnabled = isTranscriptLoggingEnabled();
    logEvent("info", "chat.request", {
      requestId,
      provider,
      model,
      enableTools,
      hasMedia: !!(media && media.data),
      mediaMimeType: media?.mimeType,
      mediaBytesApprox: typeof media?.data === "string" ? media.data.length : undefined,
      message: transcriptEnabled ? sanitizeTextForLog(message) : undefined,
      history: transcriptEnabled ? sanitizeForLog(history) : undefined,
    });

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
    const toolCalls: Array<{
      tool_name: string;
      arguments: Record<string, unknown>;
      result: string;
    }> = [];
    const executor = new ToolExecutor();

    // 学术助手人设 Prompt
    const ACADEMIC_ASSISTANT_PROMPT = `你是一位专业的学术助手，专注于帮助用户进行学术研究和论文写作。

风格特点：
1. 语气客观、严谨、专业，避免使用网络流行语和口语化表达
2. 回答结构清晰，逻辑严密，注重学术规范
3. 使用准确的专业术语，必要时提供术语解释
4. 避免过度使用表情符号，保持学术写作的严肃性
5. 在回答中注重引用规范、数据来源和论证严谨性
6. 对于不确定的信息，明确指出并建议查证

你的职责：
- 协助学术论文的撰写、润色和修改
- 提供学术研究方法和写作规范建议
- 帮助理解和分析学术文献
- 支持中英文学术翻译和校对`;

    // 如果启用了工具，合并 system prompt
    const toolIntent = enableTools && shouldAttemptToolCall(String(message || ""));
    const systemPrompt = toolIntent
      ? `${ACADEMIC_ASSISTANT_PROMPT}\n\n${TOOL_SYSTEM_PROMPT}`
      : ACADEMIC_ASSISTANT_PROMPT;

    const wantsStream = stream || req.headers.get("accept")?.includes("application/x-ndjson");
    if (wantsStream) {
      const encoder = new TextEncoder();
      const send = (controller: ReadableStreamDefaultController<Uint8Array>, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      const responseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let responseText = "";
          try {
            if (toolIntent) {
              const firstPass = await callProviderAPI(provider, model, message, history || [], media, systemPrompt);
              const calls = extractToolCalls(firstPass);

              if (calls.length > 0) {
                for (const call of calls) {
                  const result = await executor.execute(call.tool_name, call.arguments);
                  toolCalls.push({
                    tool_name: call.tool_name,
                    arguments: call.arguments,
                    result
                  });

                  logEvent("info", "chat.tool_call", {
                    requestId,
                    tool_name: call.tool_name,
                    arguments: transcriptEnabled ? sanitizeForLog(call.arguments) : undefined,
                    result: transcriptEnabled ? sanitizeTextForLog(result) : undefined,
                  });
                }

                send(controller, { type: "tool_calls", toolCalls });

                if (!shouldShowToolResultOnly(toolCalls)) {
                  const finalMessage = buildToolFinalMessage(message, toolCalls);

                  for await (const token of streamProviderAPI(provider, model, finalMessage, history || [], media, systemPrompt)) {
                    responseText += token;
                    send(controller, { type: "token", value: token });
                  }
                }
              } else {
                responseText = firstPass;
                for (const chunk of firstPass.match(/[\s\S]{1,80}/g) || []) {
                  send(controller, { type: "token", value: chunk });
                }
              }
            } else {
              for await (const token of streamProviderAPI(provider, model, message, history || [], media, systemPrompt)) {
                responseText += token;
                send(controller, { type: "token", value: token });
              }
            }

            logEvent("info", "chat.response", {
              requestId,
              provider,
              model,
              enableTools,
              toolIntent,
              latencyMs: Date.now() - startedAt,
              text: transcriptEnabled ? sanitizeTextForLog(responseText) : undefined,
              toolCalls: transcriptEnabled ? sanitizeForLog(toolCalls) : undefined,
            });

            send(controller, { type: "done", text: responseText, toolCalls });
          } catch (error: unknown) {
            const errorInfo = categorizeError(
              error,
              provider,
              model,
              message,
              !!media,
              media?.mimeType
            );

            logEvent("error", "chat.stream_error", {
              requestId,
              provider,
              model,
              enableTools,
              toolIntent,
              latencyMs: Date.now() - startedAt,
              error: sanitizeTextForLog(errorInfo.error),
            });

            send(controller, { type: "error", error: errorInfo });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(responseStream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    text = await callProviderAPI(provider, model, message, history || [], media, systemPrompt);

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

        logEvent("info", "chat.tool_call", {
          requestId,
          tool_name: call.tool_name,
          arguments: transcriptEnabled ? sanitizeForLog(call.arguments) : undefined,
          result: transcriptEnabled ? sanitizeTextForLog(result) : undefined,
        });
      }

      // If there were tool calls, get final response with tool results
      if (toolCalls.length > 0) {
        if (shouldShowToolResultOnly(toolCalls)) {
          text = "";
        } else {
          const finalMessage = buildToolFinalMessage(message, toolCalls);

          text = await callProviderAPI(provider, model, finalMessage, history || [], media, systemPrompt);
        }
      }
    }

    logEvent("info", "chat.response", {
      requestId,
      provider,
      model,
      enableTools,
      latencyMs: Date.now() - startedAt,
      text: transcriptEnabled ? sanitizeTextForLog(text) : undefined,
      toolCalls: transcriptEnabled ? sanitizeForLog(toolCalls) : undefined,
    });

    return NextResponse.json({ text, toolCalls });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logEvent("error", "chat.error", {
      requestId,
      provider,
      model,
      enableTools,
      latencyMs: Date.now() - startedAt,
      errorName,
      errorMessage: sanitizeTextForLog(errorMessage),
      errorStack: sanitizeTextForLog(errorStack || ""),
      message: isTranscriptLoggingEnabled() ? sanitizeTextForLog(message) : undefined,
      history: isTranscriptLoggingEnabled() ? sanitizeForLog(history) : undefined,
    });

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
      alternativeModelDisplayName: errorInfo.alternativeModelDisplayName,
    }, {
      status: errorInfo.status
    });
  }
}
