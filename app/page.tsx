'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

interface Message {
  role: 'user' | 'bot';
  content: string;
  media?: {
    data: string;
    mimeType: string;
    preview: string;
    type: 'image' | 'video';
  };
}

interface MediaFile {
  data: string; // base64
  mimeType: string;
  preview: string; // blob url for preview
  type: 'image' | 'video';
}

const STORAGE_KEY = 'x-chat-history-v1';
const HISTORY_LIMIT = 60;

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: '你好! 我是杨村 AI 助手。你可以发送文字、图片或视频给我，我们来聊聊吧！' }
  ]);
  const messagesRef = useRef<Message[]>(messages);
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load cached text history on first render
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as Pick<Message, 'role' | 'content'>[];
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed.slice(-HISTORY_LIMIT));
      }
    } catch (err) {
      console.warn('Failed to load cached chat history', err);
    }
  }, []);

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

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          media: currentMedia ? { data: currentMedia.data, mimeType: currentMedia.mimeType } : null,
          history
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch');

      setMessages(prev => [...prev, { role: 'bot', content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: '抱歉，出了一点问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.windowDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.headerTitle}>
            <div className={styles.headerName}>杨村 AI 助手</div>
            <div className={styles.headerSubtitle}>Gemini Chat</div>
          </div>
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
                  {msg.content && (
                    <div className={styles.bubbleText}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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
              placeholder="输入消息…（支持图片/视频）"
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
