/**
 * @fileoverview 클라이언트 측 기본 타입 정의
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

/**
 * 채팅 메시지 타입
 */
export interface ChatMessage {
  /** 메시지 고유 ID */
  id: string;
  /** 메시지 타입 */
  type: 'user' | 'ai' | 'system' | 'error';
  /** 메시지 내용 */
  content: string;
  /** 타임스탬프 */
  timestamp: Date;
  /** 메타데이터 */
  metadata?: {
    /** 실행 시간 (ms) */
    executionTime?: number;
    /** 명령어 타입 */
    commandType?: string;
    /** 에러 코드 */
    errorCode?: string;
  };
}

/**
 * 브라우저 상태 타입
 */
export interface BrowserState {
  /** 연결 상태 */
  isConnected: boolean;
  /** 현재 URL */
  currentUrl?: string;
  /** 페이지 제목 */
  pageTitle?: string;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 상태 */
  error?: string;
  /** 마지막 업데이트 시간 */
  lastUpdate: Date;
}

/**
 * 소켓 상태 타입
 */
export interface SocketState {
  /** 소켓 연결 상태 */
  isConnected: boolean;
  /** 연결 시도 중 */
  isConnecting: boolean;
  /** 재연결 시도 횟수 */
  reconnectAttempts: number;
  /** 마지막 연결 시간 */
  lastConnected?: Date;
  /** 연결 에러 */
  connectionError?: string;
}

/**
 * 명령어 실행 상태 타입
 */
export interface CommandExecutionState {
  /** 실행 중 여부 */
  isExecuting: boolean;
  /** 현재 실행 중인 명령어 */
  currentCommand?: string;
  /** 진행률 (0-100) */
  progress: number;
  /** 현재 단계 */
  currentStep?: string;
  /** 시작 시간 */
  startTime?: Date;
  /** 예상 완료 시간 */
  estimatedCompletion?: Date;
}

/**
 * 스크린샷 상태 타입
 */
export interface ScreenshotState {
  /** 현재 스크린샷 (base64) */
  current?: string;
  /** 이전 스크린샷 (base64) */
  previous?: string;
  /** 로딩 중 */
  isLoading: boolean;
  /** 마지막 업데이트 시간 */
  lastUpdate?: Date;
  /** 스크린샷 크기 */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * 앱 상태 타입
 */
export interface AppState {
  /** 소켓 상태 */
  socket: SocketState;
  /** 브라우저 상태 */
  browser: BrowserState;
  /** 명령어 실행 상태 */
  execution: CommandExecutionState;
  /** 스크린샷 상태 */
  screenshot: ScreenshotState;
  /** 채팅 메시지 목록 */
  messages: ChatMessage[];
  /** UI 상태 */
  ui: {
    /** 사이드바 열림 상태 */
    sidebarOpen: boolean;
    /** 전체화면 모드 */
    fullscreen: boolean;
    /** 다크 모드 */
    darkMode: boolean;
    /** 확대/축소 레벨 */
    zoomLevel: number;
  };
}

/**
 * 소켓 이벤트 데이터 타입
 */
export interface SocketEventData {
  /** 명령어 실행 요청 */
  execute_command: {
    userInput: string;
    context?: any;
  };
  /** 명령어 진행 상황 */
  command_progress: {
    status: string;
    progress: number;
    currentStep?: string;
  };
  /** 명령어 실행 결과 */
  command_result: {
    success: boolean;
    data?: any;
    error?: string;
    screenshot?: string;
    executionTime?: number;
    metadata?: Record<string, any>;
  };
  /** 에러 발생 */
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  /** 스크린샷 업데이트 */
  screenshot_update: {
    screenshot: string;
    timestamp: number;
  };
  /** 브라우저 상태 업데이트 */
  browser_status: {
    status: 'ready' | 'busy' | 'error' | 'disconnected';
  };
}

/**
 * 사용자 입력 검증 타입
 */
export interface InputValidation {
  /** 검증 성공 여부 */
  isValid: boolean;
  /** 에러 메시지 */
  errors: string[];
  /** 경고 메시지 */
  warnings: string[];
}

/**
 * 명령어 히스토리 타입
 */
export interface CommandHistory {
  /** 명령어 목록 */
  commands: string[];
  /** 현재 인덱스 */
  currentIndex: number;
  /** 최대 히스토리 개수 */
  maxLength: number;
}

/**
 * 설정 타입
 */
export interface ClientConfig {
  /** 서버 URL */
  serverUrl: string;
  /** 소켓 URL */
  socketUrl: string;
  /** 자동 재연결 */
  autoReconnect: boolean;
  /** 재연결 시도 간격 (ms) */
  reconnectInterval: number;
  /** 최대 재연결 시도 횟수 */
  maxReconnectAttempts: number;
  /** 메시지 최대 개수 */
  maxMessages: number;
  /** 스크린샷 자동 새로고침 간격 (ms) */
  screenshotRefreshInterval: number;
  /** 애니메이션 효과 */
  animations: boolean;
  /** 접근성 모드 */
  accessibilityMode: boolean;
}

/**
 * 키보드 이벤트 핸들러 타입
 */
export interface KeyboardEventHandlers {
  /** Enter 키 */
  onEnter: (event: KeyboardEvent) => void;
  /** Escape 키 */
  onEscape: (event: KeyboardEvent) => void;
  /** 위 화살표 키 */
  onArrowUp: (event: KeyboardEvent) => void;
  /** 아래 화살표 키 */
  onArrowDown: (event: KeyboardEvent) => void;
  /** Tab 키 */
  onTab: (event: KeyboardEvent) => void;
}

/**
 * 브라우저 뷰어 옵션 타입
 */
export interface BrowserViewerOptions {
  /** 확대/축소 활성화 */
  zoomEnabled: boolean;
  /** 전체화면 지원 */
  fullscreenSupported: boolean;
  /** 터치 제스처 지원 */
  touchGesturesEnabled: boolean;
  /** 키보드 단축키 지원 */
  keyboardShortcuts: boolean;
  /** 스크린샷 품질 (0-1) */
  screenshotQuality: number;
  /** 최대 스크린샷 크기 */
  maxScreenshotSize: {
    width: number;
    height: number;
  };
}

/**
 * 에러 경계 상태 타입
 */
export interface ErrorBoundaryState {
  /** 에러 발생 여부 */
  hasError: boolean;
  /** 에러 객체 */
  error?: Error;
  /** 에러 정보 */
  errorInfo?: {
    componentStack: string;
  };
  /** 에러 발생 시간 */
  errorTime?: Date;
}

/**
 * 성능 메트릭 타입
 */
export interface PerformanceMetrics {
  /** 컴포넌트 렌더링 시간 */
  renderTime: number;
  /** 메모리 사용량 */
  memoryUsage: {
    used: number;
    total: number;
  };
  /** 네트워크 지연 시간 */
  networkLatency: number;
  /** 소켓 연결 시간 */
  socketConnectionTime: number;
}

/**
 * 테마 타입
 */
export interface Theme {
  /** 테마 이름 */
  name: string;
  /** 기본 색상 */
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
  };
  /** 폰트 */
  fonts: {
    body: string;
    heading: string;
    monospace: string;
  };
  /** 간격 */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** 브레이크포인트 */
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

/**
 * 로컬 스토리지 키 타입
 */
export enum LocalStorageKeys {
  COMMAND_HISTORY = 'ai-browser-controller:command-history',
  USER_PREFERENCES = 'ai-browser-controller:user-preferences',
  THEME = 'ai-browser-controller:theme',
  WINDOW_SIZE = 'ai-browser-controller:window-size',
  SIDEBAR_STATE = 'ai-browser-controller:sidebar-state'
}

/**
 * 사용자 설정 타입
 */
export interface UserPreferences {
  /** 테마 설정 */
  theme: 'light' | 'dark' | 'auto';
  /** 언어 설정 */
  language: 'ko' | 'en' | 'ja' | 'zh';
  /** 알림 설정 */
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  /** 접근성 설정 */
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
  };
  /** 성능 설정 */
  performance: {
    animationsEnabled: boolean;
    autoRefreshScreenshot: boolean;
    maxMessageHistory: number;
  };
} 