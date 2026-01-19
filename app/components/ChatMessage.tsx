import ReactMarkdown from 'react-markdown';
import styles from './ChatMessage.module.css';
import { Message, ToolCall } from '@/app/types';

interface ChatMessageProps {
    message: Message;
    onQuickSwitch?: (provider: string, model: string) => void;
    onManualSwitch?: () => void;
}

export function ChatMessage({ message, onQuickSwitch, onManualSwitch }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowBot}`}>
            {!isUser && <div className={styles.avatar}>AI</div>}

            <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
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
                                🔄 切换到 {message.error.alternativeProvider === 'google' ? 'Google' : 'Qwen'}
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
            </div>
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

    return null;
}
