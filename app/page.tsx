'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';
import { AI_PROVIDERS } from '@/lib/ai-providers';
import { Message, MediaFile } from '@/app/types';
import { ChatMessage } from '@/app/components/ChatMessage';
import { ModelSelector } from '@/app/components/ModelSelector';
import { ChatInput } from '@/app/components/ChatInput';
import { Toast } from '@/app/components/Toast';

const STORAGE_KEY = 'x-chat-history-v1';
const STORAGE_PROVIDER_KEY = 'x-chat-provider';
const STORAGE_MODEL_KEY = 'x-chat-model';
const HISTORY_LIMIT = 60;

const NAGANO_QUOTES = [
  "哎呀真拿你没办法捏~ (扭动) 🍙",
  "唔... 肚子饿了，想吃糯米团子... 🍚",
  "人生就是... 稍微自嘲一下然后继续前进捏 ✨",
  "脑子空空，只剩下可爱了... 🍐",
  "你是在拍我吗？(害羞) 🐻",
  "虽然很累，但是为了你... 熊熊可以再坚持一下！💦",
  "唔... 这种感觉... 是要长草了吗？🌿",
  "只要能吃饱睡好，就是最幸福的小熊啦~ 💤",
  "哎嘿~ 刚才是在想我吗？(搓手手)",
  "唔唔唔... 这种问题熊熊要思考很久捏... 🍵"
];

export default function Home() {
  // --- 状态管理 ---
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: '嗨！我是熊熊（自嘲熊）捏~ 🍙 请问有什么我可以帮你的吗？虽然我很懒，但如果是陪你聊天的话... 唔，我会努力不睡着的！💤 ✨' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);

  // 模型选择状态
  const [selectedProvider, setSelectedProvider] = useState(AI_PROVIDERS[0].id);
  const [selectedModel, setSelectedModel] = useState(AI_PROVIDERS[0].models[0].id);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // 提示框状态
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- 辅助函数 ---

  // 显示 Toast 提示
  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000); // 3秒后自动消失
  };

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 自嘲熊点击互动
  const handleNaganoClick = () => {
    const randomQuote = NAGANO_QUOTES[Math.floor(Math.random() * NAGANO_QUOTES.length)];
    showToastNotification(randomQuote);
  };

  // 格式化错误信息（针对前端显示的兜底逻辑）
  const formatErrorMessage = (errorData: any): string => {
    if (!errorData) return '未知错误';

    // 如果后端已经确返回了 userMessage，直接使用
    if (errorData.userMessage) {
      let msg = `❌ **${errorData.userMessage}**\n\n💡 ${errorData.suggestion || ''}`;

      // 添加切换建议
      if (errorData.alternativeProvider && errorData.alternativeModel) {
        const providerName = errorData.alternativeProvider === 'google' ? 'Google Gemini' : '通义千问';
        msg += `\n\n🔄 建议切换到：**${providerName}**`;
      }
      return msg;
    }

    // 兜底逻辑
    return `❌ **请求失败**\n\n错误信息: ${errorData.message || JSON.stringify(errorData)}`;
  };

  // --- Effects (生命周期) ---

  // 1. 初始化加载历史记录和设置
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Pick<Message, 'role' | 'content'>[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed.slice(-HISTORY_LIMIT));
        }
      }

      const savedProvider = localStorage.getItem(STORAGE_PROVIDER_KEY);
      const savedModel = localStorage.getItem(STORAGE_MODEL_KEY);
      if (savedProvider) {
        const provider = AI_PROVIDERS.find(p => p.id === savedProvider);
        if (provider) {
          setSelectedProvider(savedProvider);
          const modelExists = savedModel && provider.models.find(m => m.id === savedModel);
          setSelectedModel(modelExists ? savedModel : provider.models[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load cached data', err);
    }
  }, []);

  // 2. 保存设置
  useEffect(() => {
    localStorage.setItem(STORAGE_PROVIDER_KEY, selectedProvider);
    localStorage.setItem(STORAGE_MODEL_KEY, selectedModel);
  }, [selectedProvider, selectedModel]);

  // 3. 保存历史记录 (仅文本)
  useEffect(() => {
    const payload = messages
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [messages]);

  // 4. 自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- 事件处理 ---

  const handleModelChange = (providerId: string, modelId: string) => {
    // 如果真的改变了才提示
    if (selectedProvider !== providerId || selectedModel !== modelId) {
      const provider = AI_PROVIDERS.find(p => p.id === providerId);
      const model = provider?.models.find(m => m.id === modelId);
      showToastNotification(`已切换到 ${provider?.name} - ${model?.name}`);
    }
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);

      // 添加一条"已停止"的消息或仅停止loading
      setMessages(prev => [...prev, {
        role: 'bot',
        content: '⏹️ **生成已停止**'
      }]);
    }
  };

  const handleSubmit = async () => {
    if ((!input.trim() && !media) || isLoading) return;

    const userMessage = input.trim();
    const currentMedia = media;

    // 检查媒体支持
    const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);
    const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

    if (currentMedia) {
      const isVideo = currentMedia.type === 'video';
      if (isVideo && !currentModel?.supportsVideo) {
        alert(`❌ 模型 ${currentModel?.name} 不支持视频，请切换模型。`);
        return;
      }
      if (!isVideo && !currentModel?.supportsVision) {
        alert(`❌ 模型 ${currentModel?.name} 不支持图片，请切换模型。`);
        return;
      }
    }

    // 立即显示用户消息
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
    setMedia(null); // 清空输入框媒体，但保留 history 中的
    setIsLoading(true);

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 准备请求历史
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          media: currentMedia ? { data: currentMedia.data, mimeType: currentMedia.mimeType } : null,
          history,
          provider: selectedProvider,
          model: selectedModel,
          enableTools: true,
        }),
        signal: abortController.signal
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = formatErrorMessage(data);
        setMessages(prev => [...prev, {
          role: 'bot',
          content: errorText,
          error: data // 保存原始错误数据以便 CheckMessage 渲染按钮
        }]);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        content: data.text,
        toolCalls: data.toolCalls
      }]);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: '🌐 **网络请求失败**\n\n请检查您的网络连接是否正常。'
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // --- 渲染 ---
  return (
    <div className={styles.page}>
      <Toast message={toastMessage} isVisible={showToast} />

      <div className={styles.panel}>
        <header className={styles.header}>
          <ModelSelector
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelect={handleModelChange}
            isOpen={showModelSelector}
            setIsOpen={setShowModelSelector}
          />
        </header>

        <main className={styles.chat}>
          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              message={msg}
              onQuickSwitch={(p, m) => handleModelChange(p, m)}
              onManualSwitch={() => setShowModelSelector(true)}
              onAvatarClick={handleNaganoClick}
            />
          ))}

          {isLoading && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div
                className={styles.avatar}
                onClick={handleNaganoClick}
                title="点点我捏~"
              >
                <img
                  src="/images/nagano.png"
                  alt="Nagano Bear"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
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
          onSubmit={handleSubmit}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
