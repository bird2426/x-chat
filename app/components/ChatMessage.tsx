import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ChatMessage.module.css';
import { Message, ToolCall } from '@/app/types';

interface ChatMessageProps {
    message: Message;
    onQuote?: (message: Message) => void;
    onQuickSwitch?: (provider: string, model: string) => void;
    onManualSwitch?: () => void;
}

export function ChatMessage({ message, onQuote, onQuickSwitch, onManualSwitch }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const modelLabel = !isUser && (message.providerName || message.modelName)
        ? `${message.providerName || 'AI'}${message.modelName ? ` · ${message.modelName}` : ''}`
        : '';
    const avatarLabel = message.provider === 'deepseek'
        ? 'DS'
        : message.provider === 'gemini'
            ? 'G'
            : message.provider === 'bailian'
                ? 'Q'
                : 'AI';

    return (
        <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowBot}`}>
            {/* AI Avatar (Left) */}
            {!isUser && (
                <div className={styles.avatar}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: 'white',
                        fontSize: avatarLabel.length > 1 ? '14px' : '16px',
                        fontWeight: 'bold'
                    }}>
                        {avatarLabel}
                    </div>
                </div>
            )}

            <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
                {modelLabel && (
                    <div className={styles.modelLabel}>
                        {message.mention ? `@${message.mention}` : modelLabel}
                        <span>{modelLabel}</span>
                    </div>
                )}

                {message.quote && (
                    <div className={styles.quoteBlock}>
                        <div className={styles.quoteAuthor}>{message.quote.author}</div>
                        <div className={styles.quoteText}>{message.quote.content}</div>
                    </div>
                )}

                {/* Media Preview (Image/Video) */}
                {message.media && (
                    <div className={styles.bubbleMedia}>
                        {message.media.type === 'video' ? (
                            <video
                                src={message.media.preview}
                                className={styles.media}
                                controls
                                playsInline
                                preload="metadata"
                            />
                        ) : (
                            <img
                                src={message.media.preview}
                                className={styles.media}
                                alt="uploaded"
                                loading="lazy"
                                onClick={() => window.open(message.media?.preview, '_blank')}
                            />
                        )}
                    </div>
                )}

                {/* Tool Results (Weather, Search, etc.) */}
                {message.toolCalls?.map((tc, i) => (
                    <ToolResult key={i} toolCall={tc} />
                ))}

                {/* Message Content */}
                {message.content && (
                    <div className={styles.bubbleText}>
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                )}

                {/* Error Actions */}
                {message.error && (
                    <div className={styles.errorActions}>
                        {message.error.alternativeProvider && message.error.alternativeModel && (
                            <button
                                className={styles.quickSwitchButton}
                                onClick={() => onQuickSwitch?.(
                                    message.error!.alternativeProvider!,
                                    message.error!.alternativeModel!
                                )}
                            >
                                🔄 切换到 {message.error.alternativeProvider === 'bailian'
                                    ? '阿里云百炼'
                                    : message.error.alternativeProvider === 'gemini'
                                        ? 'Google Gemini'
                                        : message.error.alternativeProvider === 'deepseek'
                                            ? 'DeepSeek'
                                            : message.error.alternativeProvider}
                                {message.error.alternativeModelDisplayName ? ` - ${message.error.alternativeModelDisplayName}` : ''}
                            </button>
                        )}
                        <button
                            className={styles.manualSwitchButton}
                            onClick={() => onManualSwitch?.()}
                        >
                            ⚙️ {message.error.alternativeProvider ? '手动选择' : '选择其他模型'}
                        </button>
                    </div>
                )}

                {message.content && (
                    <div className={styles.messageActions}>
                        <button
                            type="button"
                            className={styles.quoteButton}
                            onClick={() => onQuote?.(message)}
                            title="引用这条消息"
                        >
                            引用
                        </button>
                    </div>
                )}
            </div>

            {/* User Avatar (Right) */}
            {isUser && <div className={styles.avatarUser}>ME</div>}

        </div>
    );
}

function ToolResult({ toolCall }: { toolCall: ToolCall }) {
    const toolName = toolCall.tool_name.toLowerCase();
    let data;

    try {
        data = JSON.parse(toolCall.result);
    } catch (e) {
        return null;
    }

    // 1. Web Search Result
    if (toolName === 'search_web' && data?.results) {
        return (
            <div className={`${styles.toolCard} ${styles.searchCard}`}>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    🔍 搜索: "{data.query}" {data.is_simulated ? '(模拟)' : ''}
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

    // 2. Weather Result
    if (toolName === 'get_weather' && data.current) {
        let bgClass = styles.weatherBgClear;
        const cond = data.current.condition;
        if (cond.includes('雨') || cond.includes('雪')) bgClass = styles.weatherBgRain;
        else if (cond.includes('阴') || cond.includes('多云')) bgClass = styles.weatherBgCloud;

        return (
            <div className={`${styles.toolCard} ${styles.weatherCard} ${bgClass}`}>
                <div className={styles.weatherHeader}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>📍 {data.location}</div>
                    <div style={{ opacity: 0.8, fontSize: '12px' }}>7日预报</div>
                </div>
                <div className={styles.weatherMain}>
                    <div className={styles.weatherIcon}>{data.current.icon}</div>
                    <div>
                        <div className={styles.weatherTemp}>{data.current.temp}°</div>
                        <div className={styles.weatherDetail}>
                            <span>{data.current.condition}</span>
                            <span style={{ marginLeft: '10px', fontSize: '13px' }}>湿度 {data.current.humidity}%</span>
                        </div>
                    </div>
                </div>
                <div className={styles.weatherForecast}>
                    {data.forecast.map((day: any, idx: number) => (
                        <div key={idx} className={styles.forecastItem}>
                            <div style={{ opacity: 0.8 }}>{day.date}</div>
                            <div style={{ fontSize: '20px' }}>{day.icon}</div>
                            <div style={{ fontWeight: 600 }}>{day.max_temp}° / {day.min_temp}°</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 3. Polish Text Result
    if (toolName === 'polish_text' && data?.polished_text) {
        return (
            <div className={`${styles.toolCard} ${styles.polishCard}`}>
                <div className={styles.polishHeader}>
                    <span className={styles.polishIcon}>✏️</span>
                    <span className={styles.polishTitle}>
                        文本润色
                        {data.mode && <span className={styles.polishMode}> · {data.mode}</span>}
                    </span>
                </div>

                {data.field && data.field !== '通用' && (
                    <div className={styles.polishField}>
                        学科领域: {data.field}
                    </div>
                )}

                <div className={styles.polishSection}>
                    <div className={styles.polishLabel}>原文</div>
                    <div className={styles.originalText}>{data.original_text}</div>
                </div>

                <div className={styles.polishSection}>
                    <div className={styles.polishLabel}>润色后</div>
                    <div className={styles.polishedText}>{data.polished_text}</div>
                </div>

                {data.changes && data.changes.length > 0 && (
                    <div className={styles.polishSection}>
                        <div className={styles.polishLabel}>修改说明</div>
                        <ul className={styles.changesList}>
                            {data.changes.map((change: string, idx: number) => (
                                <li key={idx} className={styles.changeItem}>{change}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.key_improvements && (
                    <div className={styles.polishSection}>
                        <div className={styles.polishLabel}>主要改进</div>
                        <div className={styles.keyImprovements}>{data.key_improvements}</div>
                    </div>
                )}

                <div className={styles.polishActions}>
                    <button
                        className={styles.copyButton}
                        onClick={() => {
                            navigator.clipboard.writeText(data.polished_text);
                        }}
                    >
                        复制润色结果
                    </button>
                </div>
            </div>
        );
    }

    if (toolName === 'plan_trip' && data.daily_itinerary) {
        return (
            <div className={`${styles.toolCard} ${styles.travelCard}`}>
                <div className={styles.travelHeader}>
                    <div className={styles.travelTitle}>
                        ✈️ {data.destination} {data.duration}
                    </div>
                    <div className={styles.travelBadge}>
                       {data.total_budget}
                    </div>
                </div>
                
                <div className={styles.travelBody}>
                    <div className={styles.travelHighlights}>
                         {data.highlights?.map((h: string, i: number) => (
                             <span key={i} className={styles.highlightTag}>✨ {h}</span>
                         ))}
                    </div>

                    <div className={styles.travelTimeline}>
                        {data.daily_itinerary.map((day: any, i: number) => (
                            <div key={i} className={styles.travelDay}>
                                <div className={styles.dayHeader}>
                                    Day {day.day}: {day.theme}
                                </div>
                                {day.activities.map((act: any, j: number) => (
                                    <div key={j} className={styles.activityItem}>
                                        <div className={styles.activityTime}>{act.time}</div>
                                        <div className={styles.activityContent}>
                                            <div className={styles.activityName}>{act.activity}</div>
                                            <div className={styles.activityDesc}>{act.desc}</div>
                                            {act.cost && <div className={styles.activityCost}>💰 {act.cost}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.travelFooter}>
                    💡 {data.tips || "祝你旅途愉快！"}
                </div>
            </div>
        );
    }

    if (toolName === 'cyber_fortune_telling' && data?.fortune_level) {
        return (
            <div className={`${styles.toolCard} ${styles.fortuneCard}`}>
                <div className={styles.fortuneHeader}>
                    <div>
                        <div className={styles.fortuneTitle}>赛博灵签</div>
                        <div className={styles.fortuneKicker}>今日签文已生成</div>
                    </div>
                    <div className={styles.fortuneCategory}>{data.category || '综合'}</div>
                </div>

                <div className={styles.fortuneReveal}>
                    <div className={styles.fortuneSeal} aria-hidden="true">签</div>
                    <div>
                        <div className={styles.fortuneLevel}>{data.fortune_level}</div>
                        <div className={styles.fortuneResultTitle}>{data.title}</div>
                        <div className={styles.fortuneText}>{data.interpretation}</div>
                    </div>
                </div>

                <div className={styles.fortuneFooter}>
                    <div>
                        <span className={styles.fortuneFooterLabel}>幸运物</span>
                        <span className={styles.fortuneFooterValue}>{data.lucky_item || '一杯热饮'}</span>
                    </div>
                    {data.tips && <div className={styles.fortuneTip}>{data.tips}</div>}
                </div>
            </div>
        );
    }

    return null;
}
