import styles from './ModelSelector.module.css';
import { AI_PROVIDERS } from '@/lib/ai-providers';

interface ModelSelectorProps {
    selectedProvider: string;
    selectedModel: string;
    onSelect: (provider: string, model: string) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export function ModelSelector({ selectedProvider, selectedModel, onSelect, isOpen, setIsOpen }: ModelSelectorProps) {
    // Find info for current selection to display in header
    const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);
    const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleSelect = (providerId: string, modelId: string) => {
        onSelect(providerId, modelId);
        setIsOpen(false);
    };

    return (
        <>
            {/* Clickable Title Area */}
            <div
                className={styles.titleContainer}
                onClick={toggleOpen}
                title="点击切换模型"
            >
                <div className={styles.titleName}>
                    {currentProvider?.name}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', opacity: 0.6 }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div className={styles.titleSubtitle}>{currentModel?.name}</div>
            </div>

            {/* Toggle Button */}
            <button
                className={styles.headerButton}
                onClick={toggleOpen}
                title="切换模型"
            >
                切换模型
            </button>

            {/* Model Dropdown */}
            {isOpen && (
                <>
                    <div className={styles.selectorOverlay} onClick={() => setIsOpen(false)} />
                    <div className={styles.selectorDropdown}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>选择 AI 模型</h3>

                        {AI_PROVIDERS.map((provider) => (
                            <div key={provider.id} className={styles.providerGroup}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', opacity: 0.8 }}>
                                    {provider.name}
                                </div>
                                {provider.models.map((model) => (
                                    <button
                                        key={model.id}
                                        className={`${styles.modelOption} ${selectedProvider === provider.id && selectedModel === model.id ? styles.active : ''
                                            }`}
                                        onClick={() => handleSelect(provider.id, model.id)}
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
                </>
            )}
        </>
    );
}
