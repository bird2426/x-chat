'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';
import { AI_PROVIDERS } from '@/lib/ai-providers';

// 工具调用的接口定义
interface ToolCall {
  tool_name: string;           // 工具名称
  arguments: Record<string, any>;  // 工具参数
  result: string;              // 工具执行结果
}

// 错误信息的接口定义
interface ErrorInfo {
  type: string;                     // 错误类型
  userMessage: string;              // 用户友好的错误描述
  suggestion: string;               // 解决建议
  alternativeProvider?: string;     // 推荐的备用 provider
  alternativeModel?: string;        // 推荐的备用 model
}

// 消息的接口定义
interface Message {
  role: 'user' | 'bot';        // 消息角色：用户或机器人
  content: string;             // 消息内容
  media?: {                    // 可选的媒体文件
    data: string;              // base64 编码的数据
    mimeType: string;          // 文件类型
    preview: string;           // 预览 URL
    type: 'image' | 'video';   // 媒体类型
  };
  toolCalls?: ToolCall[];      // 可选的工具调用记录
  error?: ErrorInfo;           // 可选的错误信息
}

interface MediaFile {
  data: string; // base64
  mimeType: string;
  preview: string; // blob url for preview
  type: 'image' | 'video';
}

const STORAGE_KEY = 'x-chat-history-v1';
const STORAGE_PROVIDER_KEY = 'x-chat-provider';
const STORAGE_MODEL_KEY = 'x-chat-model';
const HISTORY_LIMIT = 60;

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: '你好！我是你的 AI 助手，很高兴为你服务。' }
  ]);
  const messagesRef = useRef<Message[]>(messages);
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Provider and model state
  const [selectedProvider, setSelectedProvider] = useState(AI_PROVIDERS[0].id);
  const [selectedModel, setSelectedModel] = useState(AI_PROVIDERS[0].models[0].id);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // 工具开关状态 - 默认开启，用户无感
  const [enableTools, setEnableTools] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load cached text history on first render
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Pick<Message, 'role' | 'content'>[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed.slice(-HISTORY_LIMIT));
        }
      }

      // Load saved provider and model
      const savedProvider = localStorage.getItem(STORAGE_PROVIDER_KEY);
      const savedModel = localStorage.getItem(STORAGE_MODEL_KEY);
      if (savedProvider) {
        const provider = AI_PROVIDERS.find(p => p.id === savedProvider);
        if (provider) {
          setSelectedProvider(savedProvider);
          if (savedModel && provider.models.find(m => m.id === savedModel)) {
            setSelectedModel(savedModel);
          } else {
            setSelectedModel(provider.models[0].id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load cached data', err);
    }
  }, []);

  // Persist provider and model selection
  useEffect(() => {
    localStorage.setItem(STORAGE_PROVIDER_KEY, selectedProvider);
    localStorage.setItem(STORAGE_MODEL_KEY, selectedModel);
  }, [selectedProvider, selectedModel]);

  // Persist text-only history (avoid storing large media blobs)
  useEffect(() => {
    const payload = messages
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save chat history', err);
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) { // 20MB limit for inline
      alert("为了演示方便，请上传小于 20MB 的文件。");
      return;
    }

    if (media?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(media.preview);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setMedia({
        data: base64String,
        mimeType: file.type,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('video') ? 'video' : 'image'
      });
    };
    reader.readAsDataURL(file);
  };

  const clearMedia = (options?: { revokePreview?: boolean }) => {
    const revokePreview = options?.revokePreview ?? true;
    if (revokePreview && media?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(media.preview);
    }
    setMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const autosizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
  };

  useEffect(() => {
    autosizeInput();
  }, [input]);

  useEffect(() => {
    return () => {
      for (const msg of messagesRef.current) {
        const preview = msg.media?.preview;
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !media) || isLoading) return;

    const userMessage = input.trim();
    const currentMedia = media;

    // Validate media support
    const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);
    const currentModel = currentProvider?.models.find(m => m.id === selectedModel);
    
    if (currentMedia) {
      const isVideo = currentMedia.type === 'video';
      if (isVideo && !currentModel?.supportsVideo) {
        alert(`模型 ${currentModel?.name} 不支持视频，请选择支持视频的模型或移除视频。`);
        return;
      }
      if (!isVideo && !currentModel?.supportsVision) {
        alert(`模型 ${currentModel?.name} 不支持图片，请选择支持图片的模型或移除图片。`);
        return;
      }
    }

    // Add user message to state
    const newMessages: Message[] = [
      ...messages,
      {
        role: 'user',
        content: userMessage,
        media: currentMedia ? { ...currentMedia } : undefined
      }
    ];
    setMessages(newMessages);
    setInput('');
    clearMedia({ revokePreview: false });
    setIsLoading(true);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = '';
    });

    try {
      // Prepare history for API (exclude current message as it will be sent separately, or just send text history)
      // Filter out the initial greeting if it's purely frontend
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

      // 发送请求到后端 API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          media: currentMedia ? { data: currentMedia.data, mimeType: currentMedia.mimeType } : null,
          history,
          provider: selectedProvider,
          model: selectedModel,
          enableTools,  // 传递工具开关状态
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 如果响应不成功，data 已经包含了错误信息
        const errorMessage = formatErrorMessage(data);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: errorMessage,
          error: data
        }]);
        return;
      }

      // 添加 AI 回复（包含工具调用记录）
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: data.text,
        toolCalls: data.toolCalls  // 保存工具调用记录
      }]);
    } catch (error) {
      console.error(error);
      
      // 网络错误或其他异常
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: '🌐 **网络连接失败**\n\n💡 请检查网络连接后重试\n\n建议：\n- 检查网络连接\n- 切换到其他模型\n- 稍后重试'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化错误消息为用户友好的文本
  const formatErrorMessage = (errorData: any): string => {
    const icons: Record<string, string> = {
      'API_KEY_MISSING': '🔑',
      'QUOTA_EXCEEDED': '📊',
      'NETWORK_ERROR': '🌐',
      'MODEL_CAPABILITY': '⚙️',
      'RATE_LIMIT': '⏱️',
      'UNKNOWN': '❌'
    };
    
    let message = `${icons[errorData.errorType] || '❌'} **${errorData.userMessage}**\n\n`;
    message += `💡 ${errorData.suggestion}`;
    
    if (errorData.alternativeProvider && errorData.alternativeModel) {
      const providerName = errorData.alternativeProvider === 'google' ? 'Google Gemini' : '通义千问';
      message += `\n\n🔄 建议切换到：**${providerName}**`;
    }
    
    return message;
  };

  // 快速切换到推荐的模型
  const handleQuickSwitch = (provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    setShowModelSelector(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Avoid breaking IME input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e.nativeEvent as any)?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Get current provider and model info
  const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headerTitle} onClick={() => setShowModelSelector(!showModelSelector)} style={{ cursor: 'pointer', flex: 1 }} title="点击切换模型">
            <div className={styles.headerName}>
              {currentProvider?.name}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginLeft: '6px', opacity: 0.6 }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            <div className={styles.headerSubtitle}>{currentModel?.name}</div>
          </div>
          
          <button 
            className={styles.headerButton}
            onClick={() => setShowModelSelector(!showModelSelector)}
            title="切换模型"
          >
            切换模型
          </button>
          {showModelSelector && (
            <div className={styles.modelSelector}>
              <div className={styles.modelSelectorContent}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>选择 AI 模型</h3>
                {AI_PROVIDERS.map((provider) => (
                  <div key={provider.id} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', opacity: 0.8 }}>
                      {provider.name}
                    </div>
                    {provider.models.map((model) => (
                      <button
                        key={model.id}
                        className={`${styles.modelOption} ${selectedProvider === provider.id && selectedModel === model.id ? styles.modelOptionActive : ''}`}
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setSelectedModel(model.id);
                          setShowModelSelector(false);
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>{model.name}</div>
                          <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
                            {model.supportsVideo ? '📹 视频' : model.supportsVision ? '🖼️ 图片' : '💬 文本'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        <main className={styles.chat} aria-label="Chat">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`${styles.row} ${isUser ? styles.rowUser : styles.rowBot}`}
              >
                {!isUser && <div className={styles.avatar} aria-hidden="true">AI</div>}
                <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
                  {msg.media && (
                    <div className={styles.bubbleMedia}>
                      {msg.media.type === 'video' ? (
                        <video
                          src={msg.media.preview}
                          className={styles.media}
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={msg.media.preview}
                          className={styles.media}
                          alt="uploaded"
                          loading="lazy"
                          onClick={() => window.open(msg.media?.preview, '_blank')}
                        />
                      )}
                    </div>
                  )}
                  {/* 工具调用结果可视化展示 */}
                  {msg.toolCalls && msg.toolCalls.map((tc, i) => {
                    const toolName = tc.tool_name.toLowerCase();

                    // 尝试解析 JSON 结果
                    let data;
                    try {
                      data = JSON.parse(tc.result);
                    } catch (e) {
                      return null;
                    }

                    if (toolName === 'search_web' && data?.results) {
                      return (
                        <div key={i} className={`${styles.toolCard} ${styles.searchCard}`}>
                          <div style={{ fontSize: '12px', opacity: 0.7, padding: '0 4px', marginBottom: '8px' }}>
                            🔍 搜索: &quot;{data.query}&quot; {data.is_simulated ? '(模拟)' : ''}
                          </div>
                          {data.results.map((item: any, idx: number) => (
                            <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className={styles.searchItem}>
                              <div className={styles.searchTitle}>{item.title}</div>
                              <div className={styles.searchUrl}>{item.url}</div>
                              <div className={styles.searchSnippet}>{item.content}</div>
                            </a>
                          ))}
                        </div>
                      );
                    }

                    // 只为天气工具提供特殊 UI，其他工具（搜索、计算、时间）直接由 AI 文本回答
                    if (toolName === 'get_weather' && data.current) {
                      // 根据天气代码决定背景色 (简单映射)
                      let bgClass = styles.weatherBgClear;
                      const cond = data.current.condition;
                      if (cond.includes('雨') || cond.includes('雪')) bgClass = styles.weatherBgRain;
                      else if (cond.includes('阴') || cond.includes('多云')) bgClass = styles.weatherBgCloud;

                      return (
                        <div key={i} className={`${styles.toolCard} ${styles.weatherCard} ${bgClass}`}>
                          <div className={styles.weatherHeader}>
                            <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              📍 {data.location} 
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.8, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '12px' }}>7日预报</div>
                          </div>
                          <div className={styles.weatherMain}>
                            <div className={styles.weatherIcon}>{data.current.icon}</div>
                            <div>
                              <div className={styles.weatherTemp}>{data.current.temp}°</div>
                              <div className={styles.weatherDetail}>
                                <span style={{fontSize: '16px', fontWeight: 500}}>{data.current.condition}</span>
                                <span style={{fontSize: '13px', opacity: 0.9}}>湿度 {data.current.humidity}%</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles.weatherForecast}>
                            {data.forecast.map((day: any, idx: number) => (
                              <div key={idx} className={styles.forecastItem}>
                                <div className={styles.forecastDate}>{day.date}</div>
                                <div className={styles.forecastIcon}>{day.icon}</div>
                                <div className={styles.forecastTemp}>{day.max_temp}° / {day.min_temp}°</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}

                  {msg.content && (
                    <div className={styles.bubbleText}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  
                  {/* 错误消息的快速操作按钮 */}
                  {msg.error && (
                    <div className={styles.errorActions}>
                      {msg.error.alternativeProvider && msg.error.alternativeModel && (
                        <>
                          <button
                            className={styles.quickSwitchButton}
                            onClick={() => handleQuickSwitch(
                              msg.error!.alternativeProvider!, 
                              msg.error!.alternativeModel!
                            )}
                          >
                            🔄 切换到 {msg.error.alternativeProvider === 'google' ? 'Google' : 'Qwen'}
                          </button>
                          <button
                            className={styles.manualSwitchButton}
                            onClick={() => setShowModelSelector(true)}
                          >
                            ⚙️ 手动选择
                          </button>
                        </>
                      )}
                      {!msg.error.alternativeProvider && (
                        <button
                          className={styles.manualSwitchButton}
                          onClick={() => setShowModelSelector(true)}
                        >
                          ⚙️ 选择其他模型
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar} aria-hidden="true">AI</div>
              <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typing}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        <footer className={styles.composer}>
          {media && (
            <div className={styles.preview} aria-label="Media preview">
              <div className={styles.previewThumb}>
                {media.type === 'video' ? (
                  <video src={media.preview} className={styles.previewMedia} controls playsInline />
                ) : (
                  <img src={media.preview} className={styles.previewMedia} alt="preview" />
                )}
              </div>
              <button
                type="button"
                className={styles.previewRemove}
                onClick={() => clearMedia({ revokePreview: true })}
                aria-label="Remove media"
              >
                ×
              </button>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className={styles.fileInput}
            />

            {/* 上传图片/视频按钮 */}
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => fileInputRef.current?.click()}
              title="上传图片/视频"
              aria-label="Upload image or video"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>

            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder="输入消息..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              enterKeyHint="send"
            />

            <button
              type="submit"
              className={styles.send}
              disabled={(!input.trim() && !media) || isLoading}
              aria-label="Send"
              title="发送"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
