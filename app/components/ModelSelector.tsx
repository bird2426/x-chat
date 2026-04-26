import styles from './ModelSelector.module.css';
import { AI_PROVIDERS } from '@/lib/ai-models';

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
    const totalModels = AI_PROVIDERS.reduce((sum, provider) => sum + provider.models.length, 0);

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
                        <div className={styles.selectorHeader}>
                            <div>
                                <div className={styles.selectorTitle}>选择 AI 模型</div>
                                <div className={styles.selectorMeta}>{AI_PROVIDERS.length} 个服务商 · {totalModels} 个可用模型</div>
                            </div>
                            <div className={styles.currentPill}>
                                {currentProvider?.name} · {currentModel?.name}
                            </div>
                        </div>

                        {AI_PROVIDERS.map((provider) => (
                            <div key={provider.id} className={styles.providerGroup}>
                                <div className={styles.providerHeader}>
                                    <div className={styles.providerName}>{provider.name}</div>
                                    <div className={styles.providerCount}>{provider.models.length} 个模型</div>
                                </div>
                                <div className={styles.modelGrid}>
                                    {provider.models.map((model) => {
                                        const isActive = selectedProvider === provider.id && selectedModel === model.id;
                                        const capability = model.supportsVideo ? '视频' : model.supportsVision ? '图片' : '文本';

                                        return (
                                            <button
                                                key={model.id}
                                                className={`${styles.modelOption} ${isActive ? styles.active : ''}`}
                                                onClick={() => handleSelect(provider.id, model.id)}
                                                title={`${provider.name} - ${model.name}`}
                                            >
                                                <div className={styles.modelName}>{model.name}</div>
                                                <div className={styles.modelMeta}>
                                                    <span className={styles.capability}>{capability}</span>
                                                    {isActive && <span className={styles.activeBadge}>当前</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
