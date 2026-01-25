import { useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';
import { MediaFile } from '@/app/types';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    media: MediaFile | null;
    setMedia: (media: MediaFile | null) => void;
    isLoading: boolean;
    onSubmit: () => void;
    onStop: () => void;
}

export function ChatInput({ input, setInput, media, setMedia, isLoading, onSubmit, onStop }: ChatInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize input
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = '0px';
        const next = Math.min(el.scrollHeight, 160);
        el.style.height = `${next}px`;
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.nativeEvent as any)?.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isLoading) return; // Loading state prevents submission
            onSubmit();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
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
                preview: URL.createObjectURL(file), // create local preview
                type: file.type.startsWith('video') ? 'video' : 'image'
            });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // reset
    };

    const clearMedia = () => {
        if (media?.preview?.startsWith('blob:')) {
            URL.revokeObjectURL(media.preview);
        }
        setMedia(null);
    };

    const handleFortuneClick = () => {
        if (isLoading) return;
        setInput("帮我抽个赛博灵签 (扭动)");
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    return (
        <footer className={styles.composer}>

            {/* Media Preview Area */}
            {media && (
                <div className={styles.preview}>
                    <div className={styles.previewThumb}>
                        {media.type === 'video' ? (
                            <video src={media.preview} className={styles.previewMedia} controls playsInline />
                        ) : (
                            <img src={media.preview} className={styles.previewMedia} alt="preview" />
                        )}
                    </div>
                    <button className={styles.previewRemove} onClick={clearMedia} aria-label="Remove media">×</button>
                </div>
            )}

            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); isLoading ? onStop() : onSubmit(); }}>
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
                    disabled={isLoading}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </button>

                <button
                    type="button"
                    className={styles.fortuneButton}
                    onClick={handleFortuneClick}
                    title="赛博灵签"
                    disabled={isLoading}
                >
                    🥠
                </button>

                <textarea
                    ref={inputRef}
                    className={styles.input}
                    placeholder={isLoading ? "正在思考..." : "输入消息..."}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />

                {isLoading ? (
                    <button
                        type="button"
                        className={styles.send}
                        onClick={onStop}
                        title="停止生成"
                        style={{ backgroundColor: '#ef4444' }} // Red color for stop
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                    </button>
                ) : (
                    <button
                        type="submit"
                        className={styles.send}
                        disabled={!input.trim() && !media}
                        title="发送"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                )}
            </form>
        </footer>
    );
}
