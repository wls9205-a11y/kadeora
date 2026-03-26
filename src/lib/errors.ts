/**
 * Structured error handling — Torvalds: "catch {} 빈 블록은 범죄"
 * 에러를 타입별로 분류하고 구조화된 로그 생성
 */

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DB_ERROR"
  | "PAYMENT_FAILED"
  | "UPLOAD_FAILED"
  | "EXTERNAL_API_ERROR"
  | "INTERNAL_ERROR";

export interface AppError {
  code: ErrorCode;
  message: string;
  messageKo: string;
  statusCode: number;
  context?: Record<string, any>;
}

const ERROR_MAP: Record<ErrorCode, Omit<AppError, "context">> = {
  AUTH_REQUIRED:      { code: "AUTH_REQUIRED",      message: "Authentication required",      messageKo: "로그인이 필요합니다.",             statusCode: 401 },
  AUTH_EXPIRED:       { code: "AUTH_EXPIRED",        message: "Session expired",              messageKo: "세션이 만료되었습니다. 다시 로그인해주세요.", statusCode: 401 },
  RATE_LIMITED:       { code: "RATE_LIMITED",        message: "Too many requests",            messageKo: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", statusCode: 429 },
  VALIDATION_ERROR:   { code: "VALIDATION_ERROR",    message: "Invalid input",                messageKo: "입력값을 확인해주세요.",            statusCode: 400 },
  NOT_FOUND:          { code: "NOT_FOUND",           message: "Resource not found",           messageKo: "요청한 정보를 찾을 수 없습니다.",   statusCode: 404 },
  DB_ERROR:           { code: "DB_ERROR",            message: "Database error",               messageKo: "데이터 처리 중 오류가 발생했습니다.", statusCode: 500 },
  PAYMENT_FAILED:     { code: "PAYMENT_FAILED",      message: "Payment processing failed",    messageKo: "결제 처리에 실패했습니다.",          statusCode: 500 },
  UPLOAD_FAILED:      { code: "UPLOAD_FAILED",       message: "File upload failed",           messageKo: "파일 업로드에 실패했습니다.",        statusCode: 500 },
  EXTERNAL_API_ERROR: { code: "EXTERNAL_API_ERROR",  message: "External service unavailable", messageKo: "외부 서비스에 일시적 문제가 있습니다.", statusCode: 502 },
  INTERNAL_ERROR:     { code: "INTERNAL_ERROR",      message: "Internal server error",        messageKo: "서버 오류가 발생했습니다.",          statusCode: 500 },
};

/** Create a typed AppError */
export function createAppError(code: ErrorCode, context?: Record<string, any>): AppError {
  return { ...ERROR_MAP[code], context };
}

/** Log error with structured context — Sentry-ready */
export function logError(error: unknown, context?: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    ...(error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 5) }
      : { raw: String(error) }),
    ...context,
  };

  // Production: Sentry.captureException(error, { extra: context });
  console.error("[KADEORA_ERROR]", JSON.stringify(errorInfo));
}

/** Convert AppError to NextResponse-compatible JSON */
export function errorResponse(appError: AppError) {
  return {
    error: {
      code: appError.code,
      message: appError.message,
      messageKo: appError.messageKo,
    },
    status: appError.statusCode,
  };
}
