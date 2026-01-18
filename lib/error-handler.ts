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
  const providerName = provider === 'google' ? 'Google Gemini' : '通义千问';
  const envVarName = provider === 'google' ? 'GOOGLE_API_KEY' : 'QWEN_API_KEY';
  
  return {
    error,
    type: ErrorType.API_KEY_MISSING,
    userMessage: `${providerName} API Key 未配置`,
    suggestion: `请在项目根目录创建 .env.local 文件，添加：\n${envVarName}=your_api_key_here`,
    alternativeProvider: provider === 'google' ? 'qwen' : 'google',
    alternativeModel: provider === 'google' ? 'qwen-flash' : 'gemini-2.5-flash',
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
  
  const modelName = model.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  
  return {
    error: error || 'Quota exceeded',
    type: ErrorType.QUOTA_EXCEEDED,
    userMessage: `${modelName} 配额已用完`,
    suggestion: `建议切换到免费的 ${alternative.modelDisplayName} 模型继续使用`,
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
    alternativeProvider: provider === 'google' ? 'qwen' : 'google',
    alternativeModel: provider === 'google' ? 'qwen-flash' : 'gemini-2.5-flash',
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
    alternativeProvider: 'google',
    alternativeModel: 'gemini-2.5-flash',
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
  // 如果有视频，只能用 Google Gemini
  if (mediaType?.startsWith('video')) {
    return {
      provider: 'google',
      model: 'gemini-2.5-flash',
      modelDisplayName: 'Gemini 2.5 Flash'
    };
  }
  
  // 如果有图片
  if (hasMedia && mediaType?.startsWith('image')) {
    if (currentProvider === 'google') {
      return {
        provider: 'qwen',
        model: 'qwen-vl-plus',
        modelDisplayName: 'Qwen VL Plus'
      };
    } else {
      return {
        provider: 'google',
        model: 'gemini-2.5-flash',
        modelDisplayName: 'Gemini 2.5 Flash'
      };
    }
  }
  
  // 根据消息内容判断任务类型
  const isCode = isCodeRelated(message);
  const isTranslation = isTranslationRelated(message);
  
  // Google 失败 → 推荐 Qwen
  if (currentProvider === 'google') {
    if (isCode) {
      return {
        provider: 'qwen',
        model: 'deepseek-v3.2',
        modelDisplayName: 'DeepSeek V3.2'
      };
    } else if (isTranslation) {
      return {
        provider: 'qwen',
        model: 'qwen-mt-flash',
        modelDisplayName: 'Qwen MT Flash'
      };
    } else {
      return {
        provider: 'qwen',
        model: 'qwen-flash',
        modelDisplayName: 'Qwen Flash'
      };
    }
  }
  
  // Qwen 失败 → 推荐 Google
  if (currentProvider === 'qwen') {
    return {
      provider: 'google',
      model: 'gemini-2.5-flash',
      modelDisplayName: 'Gemini 2.5 Flash'
    };
  }
  
  // 默认推荐
  return {
    provider: 'qwen',
    model: 'qwen-flash',
    modelDisplayName: 'Qwen Flash'
  };
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
    case 'google':
      return 'Google Gemini';
    case 'qwen':
      return '通义千问';
    default:
      return provider;
  }
}
