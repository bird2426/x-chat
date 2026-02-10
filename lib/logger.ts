type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined ? undefined : String(v);
}

function envBool(name: string, defaultValue: boolean): boolean {
  const v = getEnv(name);
  if (v === undefined) return defaultValue;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

function envInt(name: string, defaultValue: number): number {
  const v = getEnv(name);
  if (v === undefined) return defaultValue;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function envLogLevel(defaultValue: LogLevel): LogLevel {
  const v = getEnv("CHAT_LOG_LEVEL");
  const s = v?.trim().toLowerCase();
  if (s === "debug" || s === "info" || s === "warn" || s === "error") return s;
  return defaultValue;
}

export function isTranscriptLoggingEnabled(): boolean {
  const defaultOn = process.env.NODE_ENV !== "production";
  return envBool("CHAT_LOG_TRANSCRIPT", defaultOn);
}

export function getChatLogMaxChars(): number {
  return envInt("CHAT_LOG_MAX_CHARS", 8000);
}

export function isRedactionEnabled(): boolean {
  return envBool("CHAT_LOG_REDACT", true);
}

function shouldLog(level: LogLevel): boolean {
  const defaultLevel: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";
  const configured = envLogLevel(defaultLevel);
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configured];
}

function truncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 13)) + "...[truncated]";
}

function redact(text: string): string {
  // Broad, best-effort redaction. This does not guarantee removal of all sensitive data.
  let t = text;

  // Authorization bearer tokens
  t = t.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, "Bearer [REDACTED]");
  // Common API key patterns
  t = t.replace(/\bsk-[A-Za-z0-9]{20,}\b/g, "sk-[REDACTED]");
  t = t.replace(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "AIza[REDACTED]");
  // Emails
  t = t.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
  // CN mobile numbers (best-effort)
  t = t.replace(/\b1[3-9]\d{9}\b/g, "[REDACTED_PHONE]");

  return t;
}

export function sanitizeTextForLog(text: string | undefined, maxChars = getChatLogMaxChars()): string | undefined {
  if (text === undefined) return undefined;
  const base = isRedactionEnabled() ? redact(text) : text;
  return truncate(base, maxChars);
}

export function sanitizeForLog(value: unknown, maxChars = getChatLogMaxChars()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeTextForLog(value, maxChars);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForLog(v, maxChars));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const looksLikeMedia =
      typeof obj.data === "string" &&
      typeof obj.mimeType === "string" &&
      Object.keys(obj).every((k) => ["data", "mimeType", "type", "preview"].includes(k));

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Never log raw media payloads (can be base64 and extremely large).
      if (looksLikeMedia && k === "data") {
        out[k] = "[OMITTED]";
        continue;
      }
      out[k] = sanitizeForLog(v, maxChars);
    }
    return out;
  }

  try {
    return sanitizeTextForLog(String(value), maxChars);
  } catch {
    return "[UNSERIALIZABLE]";
  }
}

export function logEvent(level: LogLevel, event: string, data: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const line = JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}
