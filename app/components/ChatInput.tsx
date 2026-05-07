import { useRef, useEffect, useMemo, useState } from 'react';
import styles from './ChatInput.module.css';
import { MediaFile, QuoteReference } from '@/app/types';
import { AI_PROVIDERS } from '@/lib/ai-models';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    media: MediaFile | null;
    setMedia: (media: MediaFile | null) => void;
    isLoading: boolean;
    quote?: QuoteReference | null;
    onClearQuote?: () => void;
    onSubmit: () => void;
    onStop: () => void;
}

export function ChatInput({ input, setInput, media, setMedia, isLoading, quote, onClearQuote, onSubmit, onStop }: ChatInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const mentionOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [caretPosition, setCaretPosition] = useState(0);
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    const [isMentionDismissed, setIsMentionDismissed] = useState(false);

    const mentionOptions = useMemo(() => AI_PROVIDERS.flatMap((provider) => provider.models.map((model) => {
        const mention = model.name.replace(/\s+/g, '-');

        return {
            providerName: provider.name,
            modelName: model.name,
            mention,
            aliases: [
                provider.name,
                provider.id,
                model.name,
                mention,
                model.id,
                ...(model.mentionAliases || []),
            ],
            capability: model.supportsVideo ? '视频' : model.supportsVision ? '图片' : '文本',
        };
    })), []);

    const activeMention = useMemo(() => {
        const beforeCaret = input.slice(0, caretPosition);
        const atIndex = beforeCaret.lastIndexOf('@');
        if (atIndex < 0) return null;

        const token = beforeCaret.slice(atIndex + 1);
        if (/[\s@，。；;:,：、]/.test(token)) return null;
        return {
            start: atIndex,
            end: caretPosition,
            query: token,
        };
    }, [caretPosition, input]);

    const filteredMentions = useMemo(() => {
        if (!activeMention) return [];
        const query = activeMention.query.toLowerCase().replace(/[\s._-]+/g, '');

        return mentionOptions
            .filter((option) => {
                if (!query) return true;
                return option.aliases.some((alias) => alias.toLowerCase().replace(/[\s._-]+/g, '').includes(query));
            });
    }, [activeMention, mentionOptions]);

    const showMentionMenu = !isLoading && !isMentionDismissed && !!activeMention && filteredMentions.length > 0;

    // Auto-resize input
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = '0px';
        const next = Math.min(el.scrollHeight, 160);
        el.style.height = `${next}px`;
    }, [input]);

    useEffect(() => {
        setActiveMentionIndex(0);
        setIsMentionDismissed(false);
    }, [activeMention?.query]);

    useEffect(() => {
        if (!filteredMentions.length) return;
        setActiveMentionIndex((idx) => Math.min(idx, filteredMentions.length - 1));
    }, [filteredMentions.length]);

    useEffect(() => {
        if (!showMentionMenu) return;
        mentionOptionRefs.current[activeMentionIndex]?.scrollIntoView({
            block: 'nearest',
        });
    }, [activeMentionIndex, showMentionMenu]);

    const syncCaretPosition = () => {
        const el = inputRef.current;
        if (!el) return;
        setCaretPosition(el.selectionStart);
    };

    const insertMention = (mention: string) => {
        if (!activeMention) return;

        const replacement = `@${mention} `;
        const nextInput = `${input.slice(0, activeMention.start)}${replacement}${input.slice(activeMention.end)}`;
        const nextCaret = activeMention.start + replacement.length;
        setInput(nextInput);
        setCaretPosition(nextCaret);
        setIsMentionDismissed(false);

        requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.nativeEvent as any)?.isComposing) return;
        if (showMentionMenu) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveMentionIndex((idx) => (idx + 1) % filteredMentions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveMentionIndex((idx) => (idx - 1 + filteredMentions.length) % filteredMentions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredMentions[activeMentionIndex]?.mention || filteredMentions[0].mention);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsMentionDismissed(true);
                return;
            }
        }

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
        setInput("帮我抽个赛博灵签");
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
                        <button className={styles.previewRemove} onClick={clearMedia} aria-label="Remove media">×</button>
                    </div>
                </div>
            )}

            {quote && (
                <div className={styles.quotePreview}>
                    <div className={styles.quotePreviewBody}>
                        <div className={styles.quotePreviewAuthor}>引用 {quote.author}</div>
                        <div className={styles.quotePreviewText}>{quote.content}</div>
                    </div>
                    <button
                        type="button"
                        className={styles.quotePreviewClose}
                        onClick={onClearQuote}
                        aria-label="取消引用"
                        disabled={isLoading}
                    >
                        ×
                    </button>
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a5 5 0 0 1 0 10 5 5 0 0 0 0 10" />
                        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
                    </svg>
                </button>

                {showMentionMenu && (
                    <div className={styles.mentionMenu} role="listbox" aria-label="选择要 @ 的模型">
                        {filteredMentions.map((option, index) => (
                            <button
                                key={`${option.providerName}-${option.modelName}`}
                                ref={(node) => {
                                    mentionOptionRefs.current[index] = node;
                                }}
                                type="button"
                                className={`${styles.mentionOption} ${index === activeMentionIndex ? styles.mentionOptionActive : ''}`}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertMention(option.mention);
                                }}
                                role="option"
                                aria-selected={index === activeMentionIndex}
                            >
                                <span className={styles.mentionName}>@{option.mention}</span>
                                <span className={styles.mentionMeta}>{option.providerName} · {option.modelName} · {option.capability}</span>
                            </button>
                        ))}
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    className={styles.input}
                    placeholder={isLoading ? "正在思考..." : "输入消息，@ 选择模型..."}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setCaretPosition(e.target.selectionStart);
                    }}
                    onClick={syncCaretPosition}
                    onKeyUp={syncCaretPosition}
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
