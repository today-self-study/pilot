/**
 * @fileoverview 서버 측 기본 타입 정의
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import { Socket } from 'socket.io';

/**
 * 브라우저 명령어 타입
 */
export interface BrowserCommand {
  /** 실행할 액션 유형 */
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'scroll' | 'wait' | 'extract' | 'evaluate';
  /** CSS 선택자 (요소 대상 명령어용) */
  selector?: string;
  /** 입력값 (type 명령어용) */
  value?: string;
  /** 이동할 URL (navigate 명령어용) */
  url?: string;
  /** 대기 시간 (ms) */
  timeout?: number;
  /** 스크롤 옵션 */
  scrollOptions?: {
    x?: number;
    y?: number;
    behavior?: 'auto' | 'smooth';
  };
  /** 대기 조건 */
  waitCondition?: 'visible' | 'hidden' | 'stable' | 'networkidle';
  /** 추가 옵션 */
  options?: Record<string, any>;
}

/**
 * 브라우저 응답 타입
 */
export interface BrowserResponse {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: any;
  /** 에러 메시지 */
  error?: string;
  /** 스크린샷 (base64) */
  screenshot?: string;
  /** 실행 시간 (ms) */
  executionTime?: number;
  /** 추가 메타데이터 */
  metadata?: Record<string, any>;
}

/**
 * AI 파싱 요청 타입
 */
export interface AIParseRequest {
  /** 사용자 입력 */
  userInput: string;
  /** 현재 스크린샷 */
  currentScreenshot?: string;
  /** 컨텍스트 정보 */
  context?: {
    currentUrl?: string;
    pageTitle?: string;
    previousCommands?: BrowserCommand[];
  };
}

/**
 * AI 파싱 응답 타입
 */
export interface AIParseResponse {
  /** 성공 여부 */
  success: boolean;
  /** 파싱된 명령어 목록 */
  commands?: BrowserCommand[];
  /** 에러 메시지 */
  error?: string;
  /** 실행 계획 설명 */
  explanation?: string;
  /** 신뢰도 점수 (0-1) */
  confidence?: number;
}

/**
 * 소켓 이벤트 타입
 */
export interface SocketEvents {
  /** 명령어 실행 요청 */
  execute_command: (data: { userInput: string; context?: any }) => void;
  /** 스크린샷 요청 */
  get_screenshot: () => void;
  /** 브라우저 리셋 요청 */
  reset_browser: () => void;
  /** 명령어 진행 상황 */
  command_progress: (data: { status: string; progress: number; currentStep?: string }) => void;
  /** 명령어 실행 결과 */
  command_result: (data: BrowserResponse) => void;
  /** 에러 발생 */
  error: (data: { message: string; code?: string; details?: any }) => void;
  /** 스크린샷 업데이트 */
  screenshot_update: (data: { screenshot: string; timestamp: number }) => void;
  /** 브라우저 상태 업데이트 */
  browser_status: (data: { status: 'ready' | 'busy' | 'error' | 'disconnected' }) => void;
}

/**
 * 브라우저 인스턴스 상태 타입
 */
export interface BrowserInstanceState {
  /** 인스턴스 ID */
  id: string;
  /** 소켓 ID */
  socketId: string;
  /** 브라우저 상태 */
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'closed';
  /** 현재 URL */
  currentUrl?: string;
  /** 페이지 제목 */
  pageTitle?: string;
  /** 생성 시간 */
  createdAt: Date;
  /** 마지막 활동 시간 */
  lastActivity: Date;
  /** 실행 중인 명령어 */
  currentCommand?: BrowserCommand;
  /** 에러 정보 */
  error?: {
    message: string;
    code?: string;
    timestamp: Date;
  };
}

/**
 * 확장된 소켓 인터페이스
 */
export interface ExtendedSocket extends Socket {
  /** 브라우저 인스턴스 ID */
  browserInstanceId?: string;
  /** 사용자 정보 */
  user?: {
    id: string;
    name?: string;
    role?: string;
  };
  /** 세션 정보 */
  session?: {
    id: string;
    startTime: Date;
    commandHistory: BrowserCommand[];
  };
}

/**
 * 로그 레벨 타입
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * 로그 엔트리 타입
 */
export interface LogEntry {
  /** 로그 레벨 */
  level: LogLevel;
  /** 로그 메시지 */
  message: string;
  /** 타임스탬프 */
  timestamp: Date;
  /** 메타데이터 */
  metadata?: Record<string, any>;
  /** 에러 객체 */
  error?: Error;
}

/**
 * 설정 타입
 */
export interface ServerConfig {
  /** 서버 포트 */
  port: number;
  /** CORS 설정 */
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  /** OpenAI API 설정 */
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  /** Puppeteer 설정 */
  puppeteer: {
    headless: boolean;
    args: string[];
    timeout: number;
    userDataDir?: string;
  };
  /** 로깅 설정 */
  logging: {
    level: LogLevel;
    file: boolean;
    console: boolean;
    maxFiles: number;
    maxSize: string;
  };
  /** 보안 설정 */
  security: {
    rateLimit: {
      windowMs: number;
      max: number;
    };
    allowedOrigins: string[];
    sessionTimeout: number;
  };
}

/**
 * 에러 코드 타입
 */
export enum ErrorCode {
  BROWSER_NOT_FOUND = 'BROWSER_NOT_FOUND',
  BROWSER_INIT_FAILED = 'BROWSER_INIT_FAILED',
  COMMAND_EXECUTION_FAILED = 'COMMAND_EXECUTION_FAILED',
  AI_PARSING_FAILED = 'AI_PARSING_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * API 응답 타입
 */
export interface ApiResponse<T = any> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 에러 정보 */
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
  /** 메타데이터 */
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

/**
 * 페이지 정보 타입
 */
export interface PageInfo {
  /** 페이지 URL */
  url: string;
  /** 페이지 제목 */
  title: string;
  /** 페이지 메타데이터 */
  metadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
    viewport?: {
      width: number;
      height: number;
    };
  };
  /** 페이지 성능 정보 */
  performance?: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
}

/**
 * 명령어 실행 컨텍스트 타입
 */
export interface ExecutionContext {
  /** 실행 ID */
  executionId: string;
  /** 사용자 입력 */
  userInput: string;
  /** 파싱된 명령어 목록 */
  commands: BrowserCommand[];
  /** 현재 명령어 인덱스 */
  currentCommandIndex: number;
  /** 시작 시간 */
  startTime: Date;
  /** 결과 목록 */
  results: BrowserResponse[];
  /** 컨텍스트 정보 */
  context: {
    initialUrl?: string;
    initialScreenshot?: string;
    pageInfo?: PageInfo;
  };
}

// 타입들은 이미 named export로 내보내졌으므로 default export는 불필요 