/**
 * 错误处理器 - 智能识别错误类型并提供友好的用户提示
 */

// 错误类型枚举
export enum ErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',      // API Key 未配置
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',        // 配额用完
  NETWORK_ERROR = 'NETWORK_ERROR',          // 网络错误
  MODEL_CAPABILITY = 'MODEL_CAPABILITY',    // 模型能力不支持
  RATE_LIMIT = 'RATE_LIMIT',                // 请求频率限制
  UNKNOWN = 'UNKNOWN'                       // 未知错误
}

// 错误信息接口
export interface ErrorInfo {
  error: string;                    // 原始错误信息
  type: ErrorType;                  // 错误类型
  userMessage: string;              // 用户友好的错误描述
  suggestion: string;               // 解决建议
  alternativeProvider?: string;     // 推荐的备用 provider
  alternativeModel?: string;        // 推荐的备用 model
  status: number;                   // HTTP 状态码
}

/**
 * 分类错误并生成友好的错误信息
 */
export function categorizeError(
  error: any, 
  provider: string, 
  model: string,
  message?: string,
  hasMedia?: boolean,
  mediaType?: string
): ErrorInfo {
  const errorMessage = error.message || String(error);
  
  // 1. API Key 未配置
  if (isApiKeyMissing(errorMessage)) {
    return handleApiKeyMissing(provider, errorMessage);
  }
  
  // 2. 配额超限
  if (isQuotaExceeded(errorMessage)) {
    return handleQuotaExceeded(provider, model, message, hasMedia, mediaType, errorMessage);
  }
  
  // 3. 请求频率限制
  if (isRateLimited(errorMessage)) {
    return handleRateLimit(provider, model, errorMessage);
  }
  
  // 4. 网络错误
  if (isNetworkError(errorMessage)) {
    return handleNetworkError(errorMessage);
  }
  
  // 5. 模型能力不支持
  if (isModelCapability(errorMessage)) {
    return handleModelCapability(provider, errorMessage);
  }
  
  // 6. 未知错误
  return handleUnknownError(errorMessage);
}

// ============ 错误识别函数 ============

function isApiKeyMissing(error: string): boolean {
  return /api_key.*not defined|unauthorized|401|invalid.*key/i.test(error);
}

function isQuotaExceeded(error: string): boolean {
  return /quota|exceeded|429|too many requests/i.test(error);
}

function isRateLimited(error: string): boolean {
  return /rate limit|throttle/i.test(error);
}

function isNetworkError(error: string): boolean {
  return /fetch failed|network|timeout|econnrefused|enotfound/i.test(error);
}

function isModelCapability(error: string): boolean {
  return /does not support|not supported|unsupported/i.test(error);
}

// ============ 错误处理函数 ============

function handleApiKeyMissing(provider: string, error: string): ErrorInfo {
  const providerName = provider === 'bailian' ? '阿里云百炼' : provider;
  const envVarName = 'BAILIAN_API_KEY';

  return {
    error,
    type: ErrorType.API_KEY_MISSING,
    userMessage: `${providerName} API Key 未配置`,
    suggestion: `请在项目根目录创建 .env.local 文件，添加：\n${envVarName}=your_api_key_here`,
    alternativeProvider: 'bailian',
    alternativeModel: 'qwen3.6-plus',
    status: 401
  };
}

function handleQuotaExceeded(
  provider: string,
  model: string,
  message?: string,
  hasMedia?: boolean,
  mediaType?: string,
  error?: string
): ErrorInfo {
  // 获取推荐的备用模型
  const alternative = getAlternativeModel(provider, model, message, hasMedia, mediaType);

  const modelName = model;

  return {
    error: error || 'Quota exceeded',
    type: ErrorType.QUOTA_EXCEEDED,
    userMessage: `${modelName} 配额已用完`,
    suggestion: `建议切换到 ${alternative.modelDisplayName} 模型继续使用`,
    alternativeProvider: alternative.provider,
    alternativeModel: alternative.model,
    status: 429
  };
}

function handleRateLimit(provider: string, model: string, error: string): ErrorInfo {
  return {
    error,
    type: ErrorType.RATE_LIMIT,
    userMessage: '请求过于频繁',
    suggestion: '请稍等片刻后再试，或切换到其他模型',
    alternativeProvider: 'bailian',
    alternativeModel: 'qwen3.5-plus',
    status: 429
  };
}

function handleNetworkError(error: string): ErrorInfo {
  return {
    error,
    type: ErrorType.NETWORK_ERROR,
    userMessage: '网络连接失败',
    suggestion: '请检查网络连接后重试',
    status: 503
  };
}

function handleModelCapability(provider: string, error: string): ErrorInfo {
  return {
    error,
    type: ErrorType.MODEL_CAPABILITY,
    userMessage: error.includes('video') ? '该模型不支持视频' : '该模型不支持此功能',
    suggestion: '请选择支持该功能的模型',
    alternativeProvider: 'bailian',
    alternativeModel: error.includes('video') ? 'qwen3.6-plus' : 'qwen3.6-plus',
    status: 400
  };
}

function handleUnknownError(error: string): ErrorInfo {
  return {
    error,
    type: ErrorType.UNKNOWN,
    userMessage: '服务暂时不可用',
    suggestion: '请稍后重试或切换其他模型',
    status: 500
  };
}

// ============ 智能推荐函数 ============

interface AlternativeModel {
  provider: string;
  model: string;
  modelDisplayName: string;
}

/**
 * 根据当前场景智能推荐备用模型
 */
function getAlternativeModel(
  currentProvider: string,
  currentModel: string,
  message?: string,
  hasMedia?: boolean,
  mediaType?: string
): AlternativeModel {
  // 当前可用模型不支持视频，推荐最通用的视觉模型，让前端继续阻止视频上传。
  if (mediaType?.startsWith('video')) {
    return {
      provider: 'bailian',
      model: 'qwen3.6-plus',
      modelDisplayName: 'Qwen3.6-Plus'
    };
  }

  // 如果有图片
  if (hasMedia && mediaType?.startsWith('image')) {
    return {
      provider: 'bailian',
      model: 'qwen3.6-plus',
      modelDisplayName: 'Qwen3.6-Plus'
    };
  }

  // 根据消息内容判断任务类型
  const isCode = isCodeRelated(message);
  const isTranslation = isTranslationRelated(message);

  if (isCode) {
    return {
      provider: 'bailian',
      model: 'qwen3-coder-plus',
      modelDisplayName: 'Qwen3-Coder-Plus'
    };
  } else if (isTranslation) {
    return {
      provider: 'bailian',
      model: 'qwen3.6-plus',
      modelDisplayName: 'Qwen3.6-Plus'
    };
  } else {
    return {
      provider: 'bailian',
      model: 'qwen3.5-plus',
      modelDisplayName: 'Qwen3.5-Plus'
    };
  }
}

/**
 * 检测是否为代码相关任务
 */
function isCodeRelated(message?: string): boolean {
  if (!message) return false;
  
  const codeKeywords = [
    '代码', 'code', '函数', 'function', '算法', 'algorithm',
    '编程', 'program', 'bug', '调试', 'debug', '实现', 'implement',
    'class', 'interface', 'api', '脚本', 'script', 'python', 'javascript',
    'typescript', 'java', 'c++', 'golang', 'rust', '写个', '帮我写'
  ];
  
  return codeKeywords.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 检测是否为翻译相关任务
 */
function isTranslationRelated(message?: string): boolean {
  if (!message) return false;
  
  const translationKeywords = [
    '翻译', 'translate', 'translation', '英译中', '中译英',
    '日译中', '法译中', '翻成', 'translate to', 'translate into'
  ];
  
  return translationKeywords.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 获取 Provider 的显示名称
 */
export function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case 'bailian':
      return '阿里云百炼';
    default:
      return provider;
  }
}
