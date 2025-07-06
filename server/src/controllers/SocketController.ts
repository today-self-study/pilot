/**
 * @fileoverview Socket.io 기반 웹소켓 서버 컨트롤러
 * @description 실시간 브라우저 제어 및 클라이언트 연결 관리
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { BrowserService } from '../services/BrowserService';
import { AIService } from '../services/AIService';
import { Logger } from '../utils/Logger';
import { InputValidator } from '../utils/InputValidator';
import { SecurityManager } from '../utils/SecurityManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import {
  ExtendedSocket,
  BrowserInstanceState,
  SocketEvents,
  BrowserCommand,
  BrowserResponse,
  AIParseRequest,
  ServerConfig,
  ErrorCode
} from '../types';

/**
 * 클라이언트 세션 정보
 */
interface ClientSession {
  /** 세션 ID */
  id: string;
  /** 소켓 ID */
  socketId: string;
  /** 클라이언트 IP */
  clientIp: string;
  /** 연결 시간 */
  connectedAt: Date;
  /** 마지막 활동 시간 */
  lastActivity: Date;
  /** 실행한 명령어 수 */
  commandCount: number;
  /** 브라우저 인스턴스 ID */
  browserInstanceId?: string;
  /** 사용자 정보 */
  user?: {
    id: string;
    name?: string;
    role?: string;
  };
}

/**
 * 실행 중인 명령어 정보
 */
interface ExecutionContext {
  /** 실행 ID */
  id: string;
  /** 클라이언트 세션 ID */
  sessionId: string;
  /** 사용자 입력 */
  userInput: string;
  /** 파싱된 명령어 목록 */
  commands: BrowserCommand[];
  /** 현재 실행 중인 명령어 인덱스 */
  currentIndex: number;
  /** 시작 시간 */
  startTime: Date;
  /** 결과 목록 */
  results: BrowserResponse[];
  /** 상태 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Socket.io 웹소켓 서버 컨트롤러
 * 실시간 브라우저 제어 및 클라이언트 연결 관리
 */
export class SocketController {
  private io: SocketIOServer;
  private logger: Logger;
  private browserService: BrowserService;
  private aiService: AIService;
  private validator: InputValidator;
  private securityManager: SecurityManager;
  private performanceMonitor: PerformanceMonitor;
  private config: ServerConfig;
  
  // 상태 관리
  private clientSessions: Map<string, ClientSession>;
  private browserInstances: Map<string, BrowserInstanceState>;
  private executionQueue: Map<string, ExecutionContext>;
  
  // 통계 및 모니터링
  private connectionStats: {
    totalConnections: number;
    activeConnections: number;
    totalCommands: number;
    failedCommands: number;
    averageExecutionTime: number;
  };

  /**
   * SocketController 생성자
   * @param httpServer HTTP 서버 인스턴스
   * @param config 서버 설정
   */
  constructor(httpServer: HttpServer, config: ServerConfig) {
    this.config = config;
    this.logger = new Logger('SocketController');
    this.validator = new InputValidator();
    this.securityManager = new SecurityManager();
    this.performanceMonitor = new PerformanceMonitor();
    
    // 서비스 초기화
    this.browserService = new BrowserService(config.puppeteer);
    this.aiService = new AIService(config.openai);
    
    // 상태 관리 초기화
    this.clientSessions = new Map();
    this.browserInstances = new Map();
    this.executionQueue = new Map();
    
    // 통계 초기화
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalCommands: 0,
      failedCommands: 0,
      averageExecutionTime: 0
    };
    
    // Socket.io 서버 초기화
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    // 이벤트 핸들러 등록
    this.setupEventHandlers();
    
    // 정리 작업 스케줄러
    this.setupCleanupTasks();
    
    this.logger.info('SocketController initialized', {
      cors: config.cors,
      transports: ['websocket', 'polling']
    });
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket as ExtendedSocket);
    });

    // 서버 종료 시 정리 작업
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * 클라이언트 연결 처리
   * @param socket 소켓 인스턴스
   */
  private async handleConnection(socket: ExtendedSocket): Promise<void> {
    const sessionId = uuidv4();
    const clientIp = socket.handshake.address;
    
    try {
      // Rate limiting 검사
      const rateLimitCheck = await this.securityManager.checkRateLimit(clientIp);
      if (!rateLimitCheck.allowed) {
        this.logger.warn('Rate limit exceeded', { clientIp, socketId: socket.id });
        socket.emit('error', {
          message: 'Too many connections. Please try again later.',
          code: ErrorCode.PERMISSION_DENIED
        });
        socket.disconnect(true);
        return;
      }

      // 클라이언트 세션 생성
      const session: ClientSession = {
        id: sessionId,
        socketId: socket.id,
        clientIp,
        connectedAt: new Date(),
        lastActivity: new Date(),
        commandCount: 0
      };

      this.clientSessions.set(sessionId, session);
      socket.browserInstanceId = sessionId;
      
      // 통계 업데이트
      this.connectionStats.totalConnections++;
      this.connectionStats.activeConnections++;
      
      this.logger.info('Client connected', { 
        sessionId, 
        socketId: socket.id, 
        clientIp,
        activeConnections: this.connectionStats.activeConnections
      });

      // 브라우저 인스턴스 초기화
      await this.initializeBrowserInstance(sessionId, socket);

      // 소켓 이벤트 핸들러 등록
      this.registerSocketEvents(socket, sessionId);

      // 연결 성공 알림
      socket.emit('browser_status', { status: 'ready' });

    } catch (error) {
      this.logger.error('Connection setup failed', { error, sessionId, socketId: socket.id });
      socket.emit('error', {
        message: 'Connection setup failed',
        code: ErrorCode.SERVER_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.disconnect(true);
    }
  }

  /**
   * 브라우저 인스턴스 초기화
   * @param sessionId 세션 ID
   * @param socket 소켓 인스턴스
   */
  private async initializeBrowserInstance(sessionId: string, socket: ExtendedSocket): Promise<void> {
    const browserState: BrowserInstanceState = {
      id: sessionId,
      socketId: socket.id,
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.browserInstances.set(sessionId, browserState);

    try {
      // 브라우저 인스턴스 생성
      await this.browserService.initializeBrowser();
      
      // 상태 업데이트
      browserState.status = 'ready';
      browserState.lastActivity = new Date();
      
      this.logger.info('Browser instance initialized', { sessionId });

    } catch (error) {
      browserState.status = 'error';
      browserState.error = {
        message: error instanceof Error ? error.message : 'Browser initialization failed',
        code: ErrorCode.BROWSER_INIT_FAILED,
        timestamp: new Date()
      };
      
      this.logger.error('Browser initialization failed', { error, sessionId });
      throw error;
    }
  }

  /**
   * 소켓 이벤트 핸들러 등록
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   */
  private registerSocketEvents(socket: ExtendedSocket, sessionId: string): void {
    // 명령어 실행 요청
    socket.on('execute_command', async (data: { userInput: string; context?: any }) => {
      await this.handleExecuteCommand(socket, sessionId, data);
    });

    // 스크린샷 요청
    socket.on('get_screenshot', async () => {
      await this.handleGetScreenshot(socket, sessionId);
    });

    // 브라우저 리셋 요청
    socket.on('reset_browser', async () => {
      await this.handleResetBrowser(socket, sessionId);
    });

    // 연결 해제 처리
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, sessionId, reason);
    });

    // 에러 처리
    socket.on('error', (error: Error) => {
      this.handleSocketError(socket, sessionId, error);
    });
  }

  /**
   * 명령어 실행 처리
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   * @param data 명령어 데이터
   */
  private async handleExecuteCommand(
    socket: ExtendedSocket, 
    sessionId: string, 
    data: { userInput: string; context?: any }
  ): Promise<void> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      // 세션 및 브라우저 상태 확인
      const session = this.clientSessions.get(sessionId);
      const browserState = this.browserInstances.get(sessionId);
      
      if (!session || !browserState) {
        throw new Error('Session or browser instance not found');
      }

      if (browserState.status !== 'ready') {
        throw new Error(`Browser not ready. Status: ${browserState.status}`);
      }

      // 입력 검증
      const validationResult = await this.validateCommandInput(data.userInput);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Invalid input');
      }

      // 진행 상황 알림
      socket.emit('command_progress', { 
        status: 'parsing', 
        progress: 10,
        currentStep: 'AI 명령어 파싱 중...'
      });

      // AI 명령어 파싱
      const currentScreenshot = await this.browserService.takeScreenshot();
      const parseRequest: AIParseRequest = {
        userInput: data.userInput,
        currentScreenshot,
        context: {
          ...data.context,
          currentUrl: browserState.currentUrl,
          pageTitle: browserState.pageTitle
        }
      };

      const parseResult = await this.aiService.parseCommand(parseRequest);
      if (!parseResult.success || !parseResult.commands) {
        throw new Error(parseResult.error || 'Command parsing failed');
      }

      // 실행 컨텍스트 생성
      const execution: ExecutionContext = {
        id: executionId,
        sessionId,
        userInput: data.userInput,
        commands: parseResult.commands,
        currentIndex: 0,
        startTime: new Date(),
        results: [],
        status: 'running'
      };

      this.executionQueue.set(executionId, execution);

      // 명령어 실행
      await this.executeCommands(socket, sessionId, execution);

      // 통계 업데이트
      session.commandCount++;
      session.lastActivity = new Date();
      this.connectionStats.totalCommands++;
      
      const executionTime = Date.now() - startTime;
      this.updateAverageExecutionTime(executionTime);

    } catch (error) {
      this.connectionStats.failedCommands++;
      this.logger.error('Command execution failed', { 
        error, 
        sessionId, 
        executionId,
        userInput: data.userInput
      });
      
      socket.emit('command_result', {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        executionTime: Date.now() - startTime
      });
    } finally {
      // 실행 컨텍스트 정리
      this.executionQueue.delete(executionId);
    }
  }

  /**
   * 명령어 실행
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   * @param execution 실행 컨텍스트
   */
  private async executeCommands(
    socket: ExtendedSocket, 
    sessionId: string, 
    execution: ExecutionContext
  ): Promise<void> {
    const browserState = this.browserInstances.get(sessionId);
    if (!browserState) {
      throw new Error('Browser instance not found');
    }

    browserState.status = 'busy';
    browserState.currentCommand = execution.commands[execution.currentIndex];
    
    try {
      for (let i = 0; i < execution.commands.length; i++) {
        execution.currentIndex = i;
        const command = execution.commands[i];
        
        // 진행 상황 알림
        const progress = Math.round(((i + 1) / execution.commands.length) * 80) + 20;
        socket.emit('command_progress', { 
          status: 'executing', 
          progress,
          currentStep: `명령어 실행 중: ${command.action}`
        });

        // 명령어 실행
        const result = await this.browserService.executeCommand(command);
        execution.results.push(result);

        // 실행 실패 시 중단
        if (!result.success) {
          execution.status = 'failed';
          throw new Error(result.error || 'Command execution failed');
        }

        // 스크린샷 업데이트 (주요 액션 후)
        if (['navigate', 'click', 'type'].includes(command.action)) {
          const screenshot = await this.browserService.takeScreenshot();
          socket.emit('screenshot_update', { 
            screenshot, 
            timestamp: Date.now() 
          });
        }

        // 브라우저 상태 업데이트
        await this.updateBrowserState(sessionId);
      }

      execution.status = 'completed';
      browserState.status = 'ready';
      browserState.currentCommand = undefined;

      // 완료 알림
      socket.emit('command_progress', { 
        status: 'completed', 
        progress: 100,
        currentStep: '실행 완료'
      });

      // 최종 결과 전송
      socket.emit('command_result', {
        success: true,
        data: execution.results,
        executionTime: Date.now() - execution.startTime.getTime()
      });

    } catch (error) {
      execution.status = 'failed';
      browserState.status = 'error';
      browserState.error = {
        message: error instanceof Error ? error.message : 'Command execution failed',
        code: ErrorCode.COMMAND_EXECUTION_FAILED,
        timestamp: new Date()
      };
      
      throw error;
    }
  }

  /**
   * 브라우저 상태 업데이트
   * @param sessionId 세션 ID
   */
  private async updateBrowserState(sessionId: string): Promise<void> {
    const browserState = this.browserInstances.get(sessionId);
    if (!browserState) return;

    try {
      // 현재 페이지 정보 가져오기
      const currentUrl = await this.browserService.getCurrentUrl();
      const pageTitle = await this.browserService.getPageTitle();
      
      browserState.currentUrl = currentUrl;
      browserState.pageTitle = pageTitle;
      browserState.lastActivity = new Date();

    } catch (error) {
      this.logger.error('Browser state update failed', { error, sessionId });
    }
  }

  /**
   * 스크린샷 요청 처리
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   */
  private async handleGetScreenshot(socket: ExtendedSocket, sessionId: string): Promise<void> {
    try {
      const browserState = this.browserInstances.get(sessionId);
      if (!browserState || browserState.status !== 'ready') {
        throw new Error('Browser not ready');
      }

      const screenshot = await this.browserService.takeScreenshot();
      socket.emit('screenshot_update', { 
        screenshot, 
        timestamp: Date.now() 
      });

    } catch (error) {
      this.logger.error('Screenshot request failed', { error, sessionId });
      socket.emit('error', {
        message: 'Screenshot capture failed',
        code: ErrorCode.COMMAND_EXECUTION_FAILED,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 브라우저 리셋 처리
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   */
  private async handleResetBrowser(socket: ExtendedSocket, sessionId: string): Promise<void> {
    try {
      const browserState = this.browserInstances.get(sessionId);
      if (!browserState) {
        throw new Error('Browser instance not found');
      }

      browserState.status = 'initializing';
      socket.emit('browser_status', { status: 'initializing' });

      // 브라우저 리셋
      await this.browserService.resetBrowser();
      
      // 상태 업데이트
      browserState.status = 'ready';
      browserState.currentUrl = undefined;
      browserState.pageTitle = undefined;
      browserState.lastActivity = new Date();
      browserState.error = undefined;

      socket.emit('browser_status', { status: 'ready' });
      
      this.logger.info('Browser reset completed', { sessionId });

    } catch (error) {
      this.logger.error('Browser reset failed', { error, sessionId });
      socket.emit('error', {
        message: 'Browser reset failed',
        code: ErrorCode.BROWSER_INIT_FAILED,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 연결 해제 처리
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   * @param reason 연결 해제 사유
   */
  private handleDisconnection(socket: ExtendedSocket, sessionId: string, reason: string): void {
    try {
      // 세션 정리
      const session = this.clientSessions.get(sessionId);
      if (session) {
        this.clientSessions.delete(sessionId);
        this.connectionStats.activeConnections--;
      }

      // 브라우저 인스턴스 정리
      const browserState = this.browserInstances.get(sessionId);
      if (browserState) {
        this.browserInstances.delete(sessionId);
        // 브라우저 정리는 백그라운드에서 수행
        this.browserService.cleanup().catch(error => {
          this.logger.error('Browser cleanup failed', { error, sessionId });
        });
      }

      // 실행 중인 명령어 취소
      for (const [executionId, execution] of this.executionQueue.entries()) {
        if (execution.sessionId === sessionId) {
          execution.status = 'cancelled';
          this.executionQueue.delete(executionId);
        }
      }

      this.logger.info('Client disconnected', { 
        sessionId, 
        socketId: socket.id, 
        reason,
        activeConnections: this.connectionStats.activeConnections
      });

    } catch (error) {
      this.logger.error('Disconnection cleanup failed', { error, sessionId, reason });
    }
  }

  /**
   * 소켓 에러 처리
   * @param socket 소켓 인스턴스
   * @param sessionId 세션 ID
   * @param error 에러 객체
   */
  private handleSocketError(socket: ExtendedSocket, sessionId: string, error: Error): void {
    this.logger.error('Socket error occurred', { 
      error, 
      sessionId, 
      socketId: socket.id 
    });

    // 클라이언트에 에러 알림
    socket.emit('error', {
      message: 'Socket error occurred',
      code: ErrorCode.NETWORK_ERROR,
      details: error.message
    });
  }

  /**
   * 명령어 입력 검증
   * @param userInput 사용자 입력
   * @returns 검증 결과
   */
  private async validateCommandInput(userInput: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // 기본 입력 검증
      if (!userInput || typeof userInput !== 'string') {
        return { isValid: false, error: 'Invalid input format' };
      }

      if (userInput.length > 1000) {
        return { isValid: false, error: 'Input too long' };
      }

      // 보안 검증
      const securityCheck = await this.securityManager.checkSuspiciousContent(userInput);
      if (!securityCheck.safe) {
        return { 
          isValid: false, 
          error: `Security check failed: ${securityCheck.reasons.join(', ')}` 
        };
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error('Input validation failed', { error, userInput });
      return { isValid: false, error: 'Validation error' };
    }
  }

  /**
   * 평균 실행 시간 업데이트
   * @param executionTime 실행 시간
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const totalTime = this.connectionStats.averageExecutionTime * this.connectionStats.totalCommands;
    this.connectionStats.averageExecutionTime = 
      (totalTime + executionTime) / this.connectionStats.totalCommands;
  }

  /**
   * 정리 작업 스케줄러 설정
   */
  private setupCleanupTasks(): void {
    // 비활성 세션 정리 (5분마다)
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);

    // 오래된 브라우저 인스턴스 정리 (10분마다)
    setInterval(() => {
      this.cleanupOldBrowserInstances();
    }, 10 * 60 * 1000);

    // 실행 큐 정리 (1분마다)
    setInterval(() => {
      this.cleanupExecutionQueue();
    }, 60 * 1000);
  }

  /**
   * 비활성 세션 정리
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const timeout = this.config.security.sessionTimeout;
    let cleanedCount = 0;

    for (const [sessionId, session] of this.clientSessions.entries()) {
      if (now - session.lastActivity.getTime() > timeout) {
        this.clientSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Inactive sessions cleaned up', { count: cleanedCount });
    }
  }

  /**
   * 오래된 브라우저 인스턴스 정리
   */
  private cleanupOldBrowserInstances(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30분
    let cleanedCount = 0;

    for (const [instanceId, instance] of this.browserInstances.entries()) {
      if (now - instance.lastActivity.getTime() > maxAge) {
        this.browserInstances.delete(instanceId);
        cleanedCount++;
        
        // 브라우저 정리 (백그라운드)
        this.browserService.cleanup().catch(error => {
          this.logger.error('Browser cleanup failed', { error, instanceId });
        });
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Old browser instances cleaned up', { count: cleanedCount });
    }
  }

  /**
   * 실행 큐 정리
   */
  private cleanupExecutionQueue(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10분
    let cleanedCount = 0;

    for (const [executionId, execution] of this.executionQueue.entries()) {
      if (now - execution.startTime.getTime() > maxAge) {
        execution.status = 'cancelled';
        this.executionQueue.delete(executionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Execution queue cleaned up', { count: cleanedCount });
    }
  }

  /**
   * 연결 통계 조회
   * @returns 연결 통계
   */
  public getConnectionStats(): typeof this.connectionStats {
    return { ...this.connectionStats };
  }

  /**
   * 활성 세션 수 조회
   * @returns 활성 세션 수
   */
  public getActiveSessionCount(): number {
    return this.clientSessions.size;
  }

  /**
   * 브라우저 인스턴스 수 조회
   * @returns 브라우저 인스턴스 수
   */
  public getBrowserInstanceCount(): number {
    return this.browserInstances.size;
  }

  /**
   * 실행 큐 크기 조회
   * @returns 실행 큐 크기
   */
  public getExecutionQueueSize(): number {
    return this.executionQueue.size;
  }

  /**
   * 서버 상태 조회
   * @returns 서버 상태
   */
  public getServerStatus(): {
    activeSessions: number;
    browserInstances: number;
    executionQueue: number;
    connectionStats: typeof this.connectionStats;
  } {
    return {
      activeSessions: this.clientSessions.size,
      browserInstances: this.browserInstances.size,
      executionQueue: this.executionQueue.size,
      connectionStats: this.getConnectionStats()
    };
  }

  /**
   * 서버 종료
   */
  public async shutdown(): Promise<void> {
    this.logger.info('SocketController shutdown initiated');
    
    try {
      // 모든 클라이언트 연결 종료
      this.io.disconnectSockets(true);
      
      // 브라우저 인스턴스 정리
      for (const [instanceId] of this.browserInstances.entries()) {
        await this.browserService.cleanup();
      }
      
      // 상태 초기화
      this.clientSessions.clear();
      this.browserInstances.clear();
      this.executionQueue.clear();
      
      // Socket.io 서버 종료
      this.io.close();
      
      this.logger.info('SocketController shutdown completed');

    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }
} 