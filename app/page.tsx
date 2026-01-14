'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: '你好! 我是你的 AI 助手。你可以发送文字、图片或视频给我，我们来聊聊吧！' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) { // 20MB limit for inline
      alert("为了演示方便，请上传小于 20MB 的文件。");
      return;
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

  const clearMedia = () => {
    setMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    clearMedia();
    setIsLoading(true);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="container">
      <div className="glass-panel" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        margin: '20px 0',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%' }}></div>
          <div style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '50%' }}></div>
          <div style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '50%' }}></div>
          <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>Gemini Chat</span>
        </div>

        {/* Chat Area */}
        <div className="chat-container" style={{ padding: '20px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              {msg.role === 'bot' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>AI</div>
              )}
              <div className={`message-content ${msg.role === 'user' ? 'message-user' : 'message-bot'}`}>
                {msg.media && (
                  <div className="message-media">
                    {msg.media.type === 'video' ? (
                      <video src={msg.media.preview} className="chat-media video-player" controls playsInline />
                    ) : (
                      <img src={msg.media.preview} className="chat-media" alt="chat" onClick={() => window.open(msg.media?.preview, '_blank')} />
                    )}
                  </div>
                )}
                {msg.content && <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-wrapper bot">
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>AI</div>
              <div className="message-content message-bot typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.6)' }}>
          {media && (
            <div className="media-preview-container" style={{ position: 'relative', width: 'fit-content', marginBottom: '10px' }}>
              {media.type === 'video' ? (
                <video src={media.preview} className="media-preview" style={{ height: '100px', width: 'auto' }} controls />
              ) : (
                <img src={media.preview} className="media-preview" style={{ height: '100px', width: 'auto' }} alt="upload preview" />
              )}
              <button className="remove-btn" onClick={clearMedia} style={{ borderRadius: '50%' }}>×</button>
            </div>
          )}

          <form className="input-form" onSubmit={handleSubmit}>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="file-upload"
            />

            <button type="button" className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Upload Image/Video">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>

            <textarea
              className="chat-input"
              placeholder="输入消息... (支持图片/视频)"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button type="submit" className="btn" disabled={(!input.trim() && !media) || isLoading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
