'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ChatSession, ErrorInfo, Message, MediaFile, QuoteReference, ToolCall } from '@/app/types';
import { ChatMessage } from '@/app/components/ChatMessage';
import { ModelSelector } from '@/app/components/ModelSelector';
import { ChatInput } from '@/app/components/ChatInput';
import { Toast } from '@/app/components/Toast';
import { getIndexedSessions, syncIndexedSessions } from '@/app/session-store';

const LEGACY_STORAGE_KEY = 'x-chat-history-v1';
const STORAGE_SESSIONS_KEY = 'x-chat-sessions-v2';
const STORAGE_ACTIVE_SESSION_KEY = 'x-chat-active-session-v2';
const STORAGE_PROVIDER_KEY = 'x-chat-provider';
const STORAGE_MODEL_KEY = 'x-chat-model';
const HISTORY_LIMIT = 80;
const SESSION_LIMIT = 40;

const WELCOME_MESSAGE: Message = {
  role: 'bot',
  content: '您好！我是您的学术助手，专注于协助学术研究和论文写作。我可以帮您润色文本、搜索文献、解答学术问题等。请问有什么可以帮您的吗？',
};

function getDefaultProviderModel() {
  const provider = AI_PROVIDERS[0];
  return {
    provider: provider.id,
    model: provider.models[0].id,
  };
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  const now = Date.now();
  const defaults = getDefaultProviderModel();

  return {
    id: createId(),
    title: '新会话',
    messages: [WELCOME_MESSAGE],
    provider: defaults.provider,
    model: defaults.model,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function normalizeMessage(value: any): Message | null {
  if (!value || (value.role !== 'user' && value.role !== 'bot')) return null;
  if (typeof value.content !== 'string') return null;

  const message: Message = {
    id: typeof value.id === 'string' ? value.id : undefined,
    role: value.role,
    content: value.content,
  };

  if (Array.isArray(value.toolCalls)) {
    message.toolCalls = value.toolCalls;
  }
  if (value.quote && typeof value.quote === 'object' && typeof value.quote.content === 'string') {
    message.quote = {
      id: typeof value.quote.id === 'string' ? value.quote.id : undefined,
      role: value.quote.role === 'user' ? 'user' : 'bot',
      content: value.quote.content,
      author: typeof value.quote.author === 'string' ? value.quote.author : '引用消息',
      modelName: typeof value.quote.modelName === 'string' ? value.quote.modelName : undefined,
    };
  }
  if (value.error && typeof value.error === 'object') {
    message.error = value.error;
  }
  if (typeof value.provider === 'string') message.provider = value.provider;
  if (typeof value.model === 'string') message.model = value.model;
  if (typeof value.providerName === 'string') message.providerName = value.providerName;
  if (typeof value.modelName === 'string') message.modelName = value.modelName;
  if (typeof value.mention === 'string') message.mention = value.mention;

  return message;
}

function normalizeSession(value: any): ChatSession | null {
  if (!value || typeof value !== 'object') return null;

  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter(Boolean) as Message[]
    : [];
  if (!messages.length) return null;

  const defaults = getDefaultProviderModel();
  const provider = AI_PROVIDERS.find((p) => p.id === value.provider) ? value.provider : defaults.provider;
  const modelList = AI_PROVIDERS.find((p) => p.id === provider)?.models ?? [];
  const model = modelList.some((m) => m.id === value.model) ? value.model : modelList[0]?.id ?? defaults.model;
  const now = Date.now();

  return {
    id: typeof value.id === 'string' ? value.id : createId(),
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : deriveTitle(messages),
    messages: messages.slice(-HISTORY_LIMIT),
    provider,
    model,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : now,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : now,
  };
}

function deriveTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return '新会话';

  const compact = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact;
}

function formatSessionTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function compactQuoteContent(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) return '这条消息没有文本内容';
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

function getMessageAuthor(message: Message) {
  if (message.role === 'user') return '我';
  return message.modelName || message.providerName || 'AI';
}

function createQuoteReference(message: Message): QuoteReference {
  return {
    id: message.id,
    role: message.role,
    content: compactQuoteContent(message.content),
    author: getMessageAuthor(message),
    modelName: message.modelName,
  };
}

function buildMessageWithQuote(message: string, quote?: QuoteReference | null) {
  if (!quote) return message;

  return `用户正在引用一条历史消息继续对话。请优先结合引用内容回答当前问题。\n\n【被引用消息】\n来源：${quote.author}\n内容：${quote.content}\n\n【当前消息】\n${message}`;
}

interface MentionTarget {
  provider: string;
  model: string;
  providerName: string;
  modelName: string;
  mention: string;
  instruction: string;
  supportsVision: boolean;
  supportsVideo: boolean;
}

function normalizeMentionToken(value: string) {
  return value.toLowerCase().replace(/[\s._-]+/g, '');
}

function getMentionCandidates() {
  return AI_PROVIDERS.flatMap((provider) => provider.models.map((model) => {
    const aliases = [
      provider.name,
      provider.id,
      model.name,
      model.id,
      ...(model.mentionAliases ?? []),
    ];

    return {
      provider,
      model,
      aliases: aliases.map((alias) => normalizeMentionToken(alias)).filter(Boolean),
    };
  }));
}

function findMentionTarget(rawName: string, instruction: string): MentionTarget | null {
  const token = normalizeMentionToken(rawName);
  if (!token) return null;

  const matched = getMentionCandidates().find(({ aliases }) => aliases.includes(token))
    ?? getMentionCandidates().find(({ aliases }) => aliases.some((alias) => alias.includes(token) || token.includes(alias)));

  if (!matched) return null;

  return {
    provider: matched.provider.id,
    model: matched.model.id,
    providerName: matched.provider.name,
    modelName: matched.model.name,
    mention: rawName,
    instruction: instruction.trim(),
    supportsVision: matched.model.supportsVision,
    supportsVideo: matched.model.supportsVideo,
  };
}

function parseMentionTargets(message: string): MentionTarget[] {
  const mentionRegex = /@([^\s@，。；;:,：、]+)/g;
  const matches = [...message.matchAll(mentionRegex)];
  if (!matches.length) return [];

  const targets: MentionTarget[] = [];
  const seen = new Set<string>();

  matches.forEach((match, index) => {
    const rawName = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? message.length;
    const instruction = message.slice(start, end).trim();
    const target = findMentionTarget(rawName, instruction);
    if (!target) return;

    const key = `${target.provider}/${target.model}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  });

  return targets;
}

function buildMentionMessage(originalMessage: string, target: MentionTarget, isGroupChat: boolean) {
  if (!isGroupChat) return originalMessage;

  const specificInstruction = target.instruction || originalMessage;
  return `这是一次点名模型任务。用户完整消息如下：\n${originalMessage}\n\n你是 ${target.providerName} - ${target.modelName}，用户 @你的具体任务是：\n${specificInstruction}\n\n请只完成你被 @ 的任务；如果任务是评价其他模型输出，但当前上下文还没有对方输出，请先给出评价维度、检查清单或需要对方输出后再评价的说明。`;
}

function serializeSessions(sessions: ChatSession[]) {
  return sessions
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SESSION_LIMIT)
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-HISTORY_LIMIT).map(({ id, role, content, quote, toolCalls, error, provider, model, providerName, modelName, mention }) => ({
        id,
        role,
        content,
        quote,
        toolCalls,
        error,
        provider,
        model,
        providerName,
        modelName,
        mention,
      })),
    }));
}

function loadLocalStorageSessions() {
  const savedSessions = localStorage.getItem(STORAGE_SESSIONS_KEY);
  if (savedSessions) {
    const parsed = JSON.parse(savedSessions);
    const sessions = Array.isArray(parsed)
      ? parsed.map(normalizeSession).filter(Boolean) as ChatSession[]
      : [];
    if (sessions.length) {
      return {
        sessions,
        activeSessionId: localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY) || sessions[0].id,
      };
    }
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    const parsed = JSON.parse(legacy);
    const messages = Array.isArray(parsed)
      ? parsed.map(normalizeMessage).filter(Boolean) as Message[]
      : [];
    if (messages.length) {
      const session = createSession({
        title: deriveTitle(messages),
        messages: messages.slice(-HISTORY_LIMIT),
      });
      return {
        sessions: [session],
        activeSessionId: session.id,
      };
    }
  }

  const session = createSession();
  return {
    sessions: [session],
    activeSessionId: session.id,
  };
}

async function loadStoredSessions() {
  const indexedSessions = (await getIndexedSessions())
    .map(normalizeSession)
    .filter(Boolean) as ChatSession[];

  if (indexedSessions.length) {
    return {
      sessions: indexedSessions,
      activeSessionId: localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY) || indexedSessions[0].id,
    };
  }

  const localSessions = loadLocalStorageSessions();
  await syncIndexedSessions(serializeSessions(localSessions.sessions));
  return localSessions;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<QuoteReference | null>(null);

  const defaults = useMemo(() => getDefaultProviderModel(), []);
  const [selectedProvider, setSelectedProvider] = useState(defaults.provider);
  const [selectedModel, setSelectedModel] = useState(defaults.model);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllersRef = useRef<AbortController[]>([]);
  const saveVersionRef = useRef(0);

  const sortedSessions = useMemo(
    () => sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions]
  );
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages ?? [WELCOME_MESSAGE];

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
  };

  const updateSessionMessages = (sessionId: string, updater: (messages: Message[]) => Message[]) => {
    updateSession(sessionId, (session) => {
      const nextMessages = updater(session.messages).slice(-HISTORY_LIMIT);
      return {
        ...session,
        title: session.title === '新会话' ? deriveTitle(nextMessages) : session.title,
        messages: nextMessages,
        updatedAt: Date.now(),
      };
    });
  };

  const formatErrorMessage = (errorData: any): string => {
    if (!errorData) return '未知错误';

    const rawMessage = typeof errorData.message === 'string' ? errorData.message : '';
    if (/^\s*<!doctype html/i.test(rawMessage) || /^\s*<html/i.test(rawMessage)) {
      return `**请求失败**\n\n聊天接口返回了 HTML 页面，而不是预期的数据流。通常是开发服务器热更新或构建状态异常导致的，请刷新页面；如果仍然出现，请重启 3000 端口的开发服务。`;
    }

    if (errorData.userMessage) {
      let msg = `**${errorData.userMessage}**\n\n${errorData.suggestion || ''}`;

      if (errorData.alternativeProvider && errorData.alternativeModel) {
        const providerName = errorData.alternativeProvider === 'bailian'
          ? '阿里云百炼'
          : errorData.alternativeProvider === 'gemini'
            ? 'Google Gemini'
            : errorData.alternativeProvider;
        const modelName = errorData.alternativeModelDisplayName || errorData.alternativeModel;
        msg += `\n\n建议切换到：**${providerName} - ${modelName}**`;
      }
      return msg;
    }

    return `**请求失败**\n\n错误信息: ${rawMessage || errorData.error || JSON.stringify(errorData)}`;
  };

  const normalizeErrorInfo = (errorData: any): ErrorInfo | undefined => {
    if (!errorData || typeof errorData !== 'object') return undefined;

    const type = typeof errorData.type === 'string'
      ? errorData.type
      : typeof errorData.errorType === 'string'
        ? errorData.errorType
        : 'UNKNOWN';
    const userMessage = typeof errorData.userMessage === 'string'
      ? errorData.userMessage
      : '服务暂时不可用';
    const suggestion = typeof errorData.suggestion === 'string'
      ? errorData.suggestion
      : '请稍后重试或切换其他模型';

    return {
      type,
      userMessage,
      suggestion,
      alternativeProvider: typeof errorData.alternativeProvider === 'string' ? errorData.alternativeProvider : undefined,
      alternativeModel: typeof errorData.alternativeModel === 'string' ? errorData.alternativeModel : undefined,
      alternativeModelDisplayName: typeof errorData.alternativeModelDisplayName === 'string'
        ? errorData.alternativeModelDisplayName
        : undefined,
    };
  };

  const readErrorResponse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }

    return {
      message: await res.text(),
      status: res.status,
      contentType,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const loaded = await loadStoredSessions();
        if (!isMounted) return;

        const active = loaded.sessions.find((session) => session.id === loaded.activeSessionId) || loaded.sessions[0];

        setSessions(loaded.sessions);
        setActiveSessionId(active.id);
        setSelectedProvider(active.provider);
        setSelectedModel(active.model);
      } catch (err) {
        console.warn('Failed to load cached sessions', err);
        if (!isMounted) return;

        const session = createSession();
        setSessions([session]);
        setActiveSessionId(session.id);
        setSelectedProvider(session.provider);
        setSelectedModel(session.model);
      } finally {
        if (isMounted) setHasHydrated(true);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || !sessions.length) return;
    const saveVersion = saveVersionRef.current + 1;
    saveVersionRef.current = saveVersion;

    const save = async () => {
      try {
        await syncIndexedSessions(serializeSessions(sessions));
        if (saveVersion !== saveVersionRef.current) return;

        localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, activeSessionId);
        localStorage.setItem(STORAGE_PROVIDER_KEY, selectedProvider);
        localStorage.setItem(STORAGE_MODEL_KEY, selectedModel);
      } catch (err) {
        console.warn('Failed to save sessions', err);
        showToastNotification('IndexedDB 历史保存失败，请检查浏览器站点存储权限');
      }
    };

    void save();
  }, [activeSessionId, hasHydrated, selectedModel, selectedProvider, sessions]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModelChange = (providerId: string, modelId: string) => {
    if (selectedProvider !== providerId || selectedModel !== modelId) {
      const provider = AI_PROVIDERS.find((p) => p.id === providerId);
      const model = provider?.models.find((m) => m.id === modelId);
      showToastNotification(`已切换到 ${provider?.name} - ${model?.name}`);
    }

    setSelectedProvider(providerId);
    setSelectedModel(modelId);

    if (activeSessionId) {
      updateSession(activeSessionId, (session) => ({
        ...session,
        provider: providerId,
        model: modelId,
        updatedAt: Date.now(),
      }));
    }
  };

  const handleNewSession = () => {
    if (isLoading) return;

    const session = createSession({
      provider: selectedProvider,
      model: selectedModel,
    });
    setSessions((prev) => [session, ...prev].slice(0, SESSION_LIMIT));
    setActiveSessionId(session.id);
    setInput('');
    setMedia(null);
    setQuoteTarget(null);
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    if (isLoading) return;

    setActiveSessionId(session.id);
    setSelectedProvider(session.provider);
    setSelectedModel(session.model);
    setQuoteTarget(null);
    setIsSidebarOpen(false);
  };

  const handleRenameSession = (session: ChatSession) => {
    const nextTitle = window.prompt('重命名会话', session.title)?.trim();
    if (!nextTitle) return;

    updateSession(session.id, (current) => ({
      ...current,
      title: nextTitle.slice(0, 48),
      updatedAt: Date.now(),
    }));
  };

  const handleDeleteSession = (sessionId: string) => {
    if (isLoading) return;
    if (!window.confirm('删除这个会话？')) return;

    setSessions((prev) => {
      const rest = prev.filter((session) => session.id !== sessionId);
      if (rest.length) {
        if (sessionId === activeSessionId) {
          const next = rest.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setActiveSessionId(next.id);
          setSelectedProvider(next.provider);
          setSelectedModel(next.model);
        }
        return rest;
      }

      const session = createSession({
        provider: selectedProvider,
        model: selectedModel,
      });
      setActiveSessionId(session.id);
      return [session];
    });
  };

  const handleClearActiveSession = () => {
    if (!activeSession || isLoading) return;
    if (!window.confirm('清空当前会话内容？')) return;

    updateSession(activeSession.id, (session) => ({
      ...session,
      title: '新会话',
      messages: [WELCOME_MESSAGE],
      updatedAt: Date.now(),
    }));
    setQuoteTarget(null);
  };

  const handleQuoteMessage = (message: Message) => {
    if (!message.content.trim()) return;
    setQuoteTarget(createQuoteReference(message));
    setTimeout(() => {
      const composer = document.querySelector('textarea');
      if (composer instanceof HTMLTextAreaElement) composer.focus();
    }, 0);
  };

  const handleStop = () => {
    if (!abortControllersRef.current.length || !activeSessionId) return;

    const sessionId = activeSessionId;
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];
    setIsLoading(false);

    updateSessionMessages(sessionId, (prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'bot' && !last.content) {
        next[next.length - 1] = { ...last, content: '**生成已停止**' };
        return next;
      }

      return [
        ...next,
        {
          role: 'bot',
          content: '**生成已停止**',
        },
      ];
    });
  };

  const updateStreamingBotMessage = (
    sessionId: string,
    botId: string,
    content: string,
    toolCalls?: ToolCall[],
    error?: ErrorInfo
  ) => {
    updateSessionMessages(sessionId, (prev) => {
      const next = [...prev];
      const targetIndex = next.findIndex((message) => message.id === botId && message.role === 'bot');
      if (targetIndex < 0) return prev;
      const existing = next[targetIndex];
      next[targetIndex] = {
        ...existing,
        content,
        toolCalls: toolCalls ?? existing.toolCalls,
        error: error ?? existing.error,
      };
      return next;
    });
  };

  const readStreamingResponse = async (res: Response, sessionId: string, botId: string) => {
    if (!res.body) throw new Error('ReadableStream is not available');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantContent = '';
    let toolCalls: ToolCall[] | undefined;
    let hasStreamError = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const event = JSON.parse(line);
        if (event.type === 'token') {
          assistantContent += event.value || '';
          updateStreamingBotMessage(sessionId, botId, assistantContent, toolCalls);
        } else if (event.type === 'tool_calls') {
          toolCalls = event.toolCalls || [];
          updateStreamingBotMessage(sessionId, botId, assistantContent || '正在整理工具调用结果...', toolCalls);
        } else if (event.type === 'error') {
          hasStreamError = true;
          updateStreamingBotMessage(
            sessionId,
            botId,
            formatErrorMessage(event.error),
            toolCalls,
            normalizeErrorInfo(event.error)
          );
        } else if (event.type === 'done') {
          updateStreamingBotMessage(sessionId, botId, assistantContent || event.text || '', toolCalls);
        }
      }
    }

    if (buffer.trim()) {
      const event = JSON.parse(buffer.trim());
      if (event.type === 'token') {
        assistantContent += event.value || '';
      }
    }

    if (!hasStreamError) {
      updateStreamingBotMessage(sessionId, botId, assistantContent, toolCalls);
    }
  };

  const handleSubmit = async () => {
    if ((!input.trim() && !media) || isLoading || !activeSession) return;

    const userMessage = input.trim();
    const currentMedia = media;
    const currentQuote = quoteTarget;
    const sessionId = activeSession.id;
    const selectedProviderInfo = AI_PROVIDERS.find((p) => p.id === selectedProvider);
    const selectedModelInfo = selectedProviderInfo?.models.find((m) => m.id === selectedModel);
    const mentionTargets = parseMentionTargets(userMessage);
    const targets: MentionTarget[] = mentionTargets.length
      ? mentionTargets
      : selectedProviderInfo && selectedModelInfo
        ? [{
            provider: selectedProviderInfo.id,
            model: selectedModelInfo.id,
            providerName: selectedProviderInfo.name,
            modelName: selectedModelInfo.name,
            mention: selectedModelInfo.name,
            instruction: userMessage,
            supportsVision: selectedModelInfo.supportsVision,
            supportsVideo: selectedModelInfo.supportsVideo,
          }]
        : [];

    if (!targets.length) {
      showToastNotification('没有找到可用模型，请先选择模型。');
      return;
    }

    if (currentMedia) {
      const isVideo = currentMedia.type === 'video';
      const unsupported = targets.find((target) => isVideo ? !target.supportsVideo : !target.supportsVision);
      if (unsupported) {
        showToastNotification(`模型 ${unsupported.modelName} 不支持${isVideo ? '视频' : '图片'}，请调整 @ 模型。`);
        return;
      }
    }

    const userEntry: Message = {
      id: createId(),
      role: 'user',
      content: userMessage,
      quote: currentQuote || undefined,
      media: currentMedia ? { ...currentMedia } : undefined,
    };
    const newMessages = [...messages, userEntry];
    const botEntries: Message[] = targets.map((target) => ({
      id: createId(),
      role: 'bot',
      content: targets.length > 1 ? `正在等待 ${target.modelName} 回复...` : '',
      provider: target.provider,
      model: target.model,
      providerName: target.providerName,
      modelName: target.modelName,
      mention: target.mention,
    }));

    updateSession(sessionId, (session) => ({
      ...session,
      title: session.title === '新会话' ? deriveTitle(newMessages) : session.title,
      messages: [...newMessages, ...botEntries].slice(-HISTORY_LIMIT),
      provider: selectedProvider,
      model: selectedModel,
      updatedAt: Date.now(),
    }));
    setInput('');
    setMedia(null);
    setQuoteTarget(null);
    setIsLoading(true);

    const history = messages.slice(1).map((message) => {
      const speaker = message.role === 'bot' && message.modelName ? `${message.modelName}: ` : '';
      return { role: message.role, content: `${speaker}${message.content}` };
    });
    const controllers = targets.map(() => new AbortController());
    abortControllersRef.current = controllers;

    try {
      await Promise.all(targets.map(async (target, index) => {
        const botId = botEntries[index].id!;
        try {
          const quotedUserMessage = buildMessageWithQuote(userMessage, currentQuote);
          const targetMessage = buildMentionMessage(quotedUserMessage, target, mentionTargets.length > 0);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/x-ndjson',
            },
            body: JSON.stringify({
              message: targetMessage,
              media: currentMedia ? { data: currentMedia.data, mimeType: currentMedia.mimeType } : null,
              history,
              provider: target.provider,
              model: target.model,
              enableTools: mentionTargets.length === 0,
              stream: true,
            }),
            signal: controllers[index].signal,
          });

          const contentType = res.headers.get('content-type') || '';
          if (!res.ok) {
            const data = await readErrorResponse(res);
            updateStreamingBotMessage(sessionId, botId, formatErrorMessage(data), undefined, normalizeErrorInfo(data));
            return;
          }

          if (contentType.includes('application/x-ndjson')) {
            await readStreamingResponse(res, sessionId, botId);
          } else if (contentType.includes('application/json')) {
            const data = await res.json();
            updateStreamingBotMessage(sessionId, botId, data.text, data.toolCalls);
          } else {
            const data = await readErrorResponse(res);
            updateStreamingBotMessage(sessionId, botId, formatErrorMessage(data));
          }
        } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error(error);
          updateStreamingBotMessage(sessionId, botId, '**网络请求失败**\n\n请检查您的网络连接是否正常。');
        }
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error(error);
      botEntries.forEach((botEntry) => {
        if (botEntry.id) {
          updateStreamingBotMessage(sessionId, botEntry.id, '**网络请求失败**\n\n请检查您的网络连接是否正常。');
        }
      });
    } finally {
      setIsLoading(false);
      abortControllersRef.current = [];
    }
  };

  return (
    <div className={styles.page}>
      <Toast message={toastMessage} isVisible={showToast} />

      {isSidebarOpen && <button className={styles.sidebarScrim} onClick={() => setIsSidebarOpen(false)} aria-label="关闭侧边栏" />}
      {showHelp && (
        <div className={styles.helpOverlay} role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section
            className={styles.helpDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.helpHeader}>
              <div>
                <div id="help-title" className={styles.helpTitle}>使用说明</div>
                <div className={styles.helpSubtitle}>简要了解 X-Chat 的主要用法</div>
              </div>
              <button className={styles.helpCloseButton} onClick={() => setShowHelp(false)} aria-label="关闭使用说明">
                ×
              </button>
            </div>

            <div className={styles.helpContent}>
              <p>
                X-Chat 是一个面向学术研究和论文写作的 AI 助手。你可以直接输入问题，也可以让它帮助润色论文段落、
                翻译学术文本、检索资料、分析图片或视频内容。
              </p>

              <h3>常用方式</h3>
              <ul>
                <li>论文润色：输入“帮我润色这段文字……”“调整为更正式的学术表达”等请求。</li>
                <li>学术翻译：输入“翻译成学术英语”“英译中并保持论文语气”等请求。</li>
                <li>文献与资料检索：输入“搜索……相关文献”“查一下……最新研究”等请求。</li>
                <li>多模型群聊：在消息中使用 @DeepSeek、@Gemini、@Qwen3.6-Plus 等提及模型，系统会让被 @ 的模型并行回复。</li>
                <li>多模态输入：点击输入框左侧的图片按钮上传图片或视频，系统会根据当前模型能力处理。</li>
                <li>赛博灵签：点击灵签按钮，或输入“帮我抽个赛博灵签”。</li>
              </ul>

              <h3>模型与历史</h3>
              <p>
                顶部可以切换模型。若某个模型因限额、拥挤或能力不支持而失败，错误提示里会给出可切换的备用模型。
                左侧会保存本地会话历史；历史存放在当前浏览器中，清除站点数据或更换浏览器后不会同步。
              </p>

              <h3>快捷键</h3>
              <p>
                按 <strong>Enter</strong> 发送，按 <strong>Shift + Enter</strong> 换行。生成过程中可以点击红色停止按钮中断回复。
              </p>
            </div>
          </section>
        </div>
      )}

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div>
            <div className={styles.sidebarTitle}>历史会话</div>
            <div className={styles.sidebarMeta}>{sortedSessions.length} 个本地会话</div>
          </div>
          <button className={styles.newChatButton} onClick={handleNewSession} disabled={isLoading}>
            新建
          </button>
        </div>

        <div className={styles.sessionList}>
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.sessionItem} ${session.id === activeSessionId ? styles.sessionItemActive : ''}`}
            >
              <button
                className={styles.sessionMain}
                onClick={() => handleSelectSession(session)}
                disabled={isLoading}
                title={session.title}
              >
                <span className={styles.sessionName}>{session.title}</span>
                <span className={styles.sessionInfo}>
                  {formatSessionTime(session.updatedAt)} · {Math.max(0, session.messages.length - 1)} 条
                </span>
              </button>
              <div className={styles.sessionActions}>
                <button onClick={() => handleRenameSession(session)} title="重命名" aria-label="重命名会话">
                  ✎
                </button>
                <button onClick={() => handleDeleteSession(session.id)} title="删除" aria-label="删除会话" disabled={isLoading}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className={styles.panel}>
        <header className={styles.header}>
          <button className={styles.sidebarToggle} onClick={() => setIsSidebarOpen(true)} aria-label="打开历史会话">
            ☰
          </button>

          <ModelSelector
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelect={handleModelChange}
            isOpen={showModelSelector}
            setIsOpen={setShowModelSelector}
          />

          <div className={styles.headerSpacer} />
          <button className={styles.helpButton} onClick={() => setShowHelp(true)}>
            使用说明
          </button>
          <button className={styles.clearButton} onClick={handleClearActiveSession} disabled={isLoading || !activeSession}>
            清空当前
          </button>
        </header>

        <main className={styles.chat}>
          {messages.map((msg, idx) => {
            const isPendingBot = isLoading && idx === messages.length - 1 && msg.role === 'bot' && !msg.content;
            if (isPendingBot) return null;

            return (
              <ChatMessage
                key={`${activeSession?.id || 'session'}-${idx}`}
                message={msg}
                onQuote={handleQuoteMessage}
                onQuickSwitch={(p, m) => handleModelChange(p, m)}
                onManualSwitch={() => setShowModelSelector(true)}
              />
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'bot' && !messages[messages.length - 1]?.content && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>
                <div className={styles.aiAvatar}>AI</div>
              </div>
              <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typing}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <ChatInput
          input={input}
          setInput={setInput}
          media={media}
          setMedia={setMedia}
          isLoading={isLoading}
          quote={quoteTarget}
          onClearQuote={() => setQuoteTarget(null)}
          onSubmit={handleSubmit}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
