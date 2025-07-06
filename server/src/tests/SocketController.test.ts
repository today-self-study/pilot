/**
 * @fileoverview SocketController 단위 테스트
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { SocketController } from '../controllers/SocketController';
import { BrowserService } from '../services/BrowserService';
import { AIService } from '../services/AIService';
import { ServerConfig } from '../types';

// 모킹
jest.mock('../services/BrowserService');
jest.mock('../services/AIService');
jest.mock('../utils/Logger');
jest.mock('../utils/InputValidator');
jest.mock('../utils/SecurityManager');
jest.mock('../utils/PerformanceMonitor');

const MockedBrowserService = BrowserService as jest.MockedClass<typeof BrowserService>;
const MockedAIService = AIService as jest.MockedClass<typeof AIService>;

describe('SocketController', () => {
  let httpServer: any;
  let socketController: SocketController;
  let clientSocket: ClientSocket;
  let serverAddress: string;
  let mockConfig: ServerConfig;
  let mockBrowserService: jest.Mocked<BrowserService>;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(async () => {
    // HTTP 서버 생성
    httpServer = createServer();
    
    // 설정 모킹
    mockConfig = {
      port: 0,
      cors: {
        origin: '*',
        credentials: true
      },
      openai: {
        apiKey: 'test-key',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.1
      },
      puppeteer: {
        headless: true,
        args: ['--no-sandbox'],
        timeout: 30000
      },
      logging: {
        level: 'info',
        file: false,
        console: true,
        maxFiles: 5,
        maxSize: '10MB'
      },
      security: {
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 100
        },
        allowedOrigins: ['*'],
        sessionTimeout: 30 * 60 * 1000
      }
    };

    // 서비스 모킹
    mockBrowserService = {
      initializeBrowser: jest.fn(),
      executeCommand: jest.fn(),
      takeScreenshot: jest.fn(),
      getCurrentUrl: jest.fn(),
      getPageTitle: jest.fn(),
      resetBrowser: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockAIService = {
      parseCommand: jest.fn(),
      getUsageStats: jest.fn(),
      getCacheStatus: jest.fn(),
      clearCache: jest.fn(),
      shutdown: jest.fn()
    } as any;

    MockedBrowserService.mockImplementation(() => mockBrowserService);
    MockedAIService.mockImplementation(() => mockAIService);

    // SocketController 생성
    socketController = new SocketController(httpServer, mockConfig);
    
    // 서버 시작
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const port = (httpServer.address() as AddressInfo).port;
        serverAddress = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // 클라이언트 연결 종료
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    // 서버 종료
    await socketController.shutdown();
    httpServer.close();
  });

  describe('Connection Management', () => {
    it('should handle client connection successfully', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          expect(data.status).toBe('ready');
          resolve();
        });
      });

      expect(mockBrowserService.initializeBrowser).toHaveBeenCalled();
      expect(socketController.getActiveSessionCount()).toBe(1);
    });

    it('should handle browser initialization failure', async () => {
      mockBrowserService.initializeBrowser.mockRejectedValue(new Error('Browser init failed'));
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('error', (error) => {
          expect(error.message).toBe('Connection setup failed');
          resolve();
        });
      });
    });

    it('should handle client disconnection', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.cleanup.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', () => {
          resolve();
        });
      });

      expect(socketController.getActiveSessionCount()).toBe(1);
      
      clientSocket.disconnect();
      
      // 잠시 대기 후 세션 정리 확인
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockBrowserService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Command Execution', () => {
    beforeEach(async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.takeScreenshot.mockResolvedValue('screenshot-data');
      mockBrowserService.getCurrentUrl.mockResolvedValue('https://example.com');
      mockBrowserService.getPageTitle.mockResolvedValue('Example Page');
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });
    });

    it('should execute commands successfully', async () => {
      const mockCommands = [
        { action: 'navigate', url: 'https://example.com' },
        { action: 'click', selector: 'button' }
      ];

      mockAIService.parseCommand.mockResolvedValue({
        success: true,
        commands: mockCommands,
        explanation: 'Test commands',
        confidence: 0.9
      });

      mockBrowserService.executeCommand.mockResolvedValue({
        success: true,
        data: 'Command executed',
        executionTime: 100
      });

      let progressCount = 0;
      let finalResult: any = null;

      clientSocket.on('command_progress', (data) => {
        progressCount++;
        expect(data.progress).toBeGreaterThan(0);
        expect(data.currentStep).toBeDefined();
      });

      clientSocket.on('command_result', (data) => {
        finalResult = data;
      });

      clientSocket.emit('execute_command', {
        userInput: 'Navigate to example.com and click button',
        context: {}
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('command_result', () => {
          resolve();
        });
      });

      expect(progressCount).toBeGreaterThan(0);
      expect(finalResult.success).toBe(true);
      expect(finalResult.data).toHaveLength(2);
      expect(mockAIService.parseCommand).toHaveBeenCalled();
      expect(mockBrowserService.executeCommand).toHaveBeenCalledTimes(2);
    });

    it('should handle AI parsing failure', async () => {
      mockAIService.parseCommand.mockResolvedValue({
        success: false,
        error: 'Parsing failed'
      });

      let errorResult: any = null;

      clientSocket.on('command_result', (data) => {
        errorResult = data;
      });

      clientSocket.emit('execute_command', {
        userInput: 'Invalid command',
        context: {}
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('command_result', () => {
          resolve();
        });
      });

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('Parsing failed');
    });

    it('should handle command execution failure', async () => {
      const mockCommands = [
        { action: 'navigate', url: 'https://example.com' }
      ];

      mockAIService.parseCommand.mockResolvedValue({
        success: true,
        commands: mockCommands,
        explanation: 'Test command',
        confidence: 0.9
      });

      mockBrowserService.executeCommand.mockResolvedValue({
        success: false,
        error: 'Navigation failed'
      });

      let errorResult: any = null;

      clientSocket.on('command_result', (data) => {
        errorResult = data;
      });

      clientSocket.emit('execute_command', {
        userInput: 'Navigate to example.com',
        context: {}
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('command_result', () => {
          resolve();
        });
      });

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
    });

    it('should validate input before execution', async () => {
      let errorResult: any = null;

      clientSocket.on('command_result', (data) => {
        errorResult = data;
      });

      // 빈 입력 테스트
      clientSocket.emit('execute_command', {
        userInput: '',
        context: {}
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('command_result', () => {
          resolve();
        });
      });

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('Invalid input');
    });

    it('should handle too long input', async () => {
      let errorResult: any = null;

      clientSocket.on('command_result', (data) => {
        errorResult = data;
      });

      // 너무 긴 입력 테스트
      clientSocket.emit('execute_command', {
        userInput: 'a'.repeat(1001),
        context: {}
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('command_result', () => {
          resolve();
        });
      });

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('Input too long');
    });
  });

  describe('Screenshot Handling', () => {
    beforeEach(async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.takeScreenshot.mockResolvedValue('screenshot-data');
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });
    });

    it('should handle screenshot request successfully', async () => {
      let screenshotData: any = null;

      clientSocket.on('screenshot_update', (data) => {
        screenshotData = data;
      });

      clientSocket.emit('get_screenshot');

      await new Promise<void>((resolve) => {
        clientSocket.on('screenshot_update', () => {
          resolve();
        });
      });

      expect(screenshotData.screenshot).toBe('screenshot-data');
      expect(screenshotData.timestamp).toBeDefined();
      expect(mockBrowserService.takeScreenshot).toHaveBeenCalled();
    });

    it('should handle screenshot failure', async () => {
      mockBrowserService.takeScreenshot.mockRejectedValue(new Error('Screenshot failed'));
      
      let errorData: any = null;

      clientSocket.on('error', (data) => {
        errorData = data;
      });

      clientSocket.emit('get_screenshot');

      await new Promise<void>((resolve) => {
        clientSocket.on('error', () => {
          resolve();
        });
      });

      expect(errorData.message).toBe('Screenshot capture failed');
      expect(errorData.code).toBeDefined();
    });
  });

  describe('Browser Reset', () => {
    beforeEach(async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.resetBrowser.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });
    });

    it('should reset browser successfully', async () => {
      const statusUpdates: any[] = [];

      clientSocket.on('browser_status', (data) => {
        statusUpdates.push(data);
      });

      clientSocket.emit('reset_browser');

      await new Promise<void>((resolve) => {
        let readyCount = 0;
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            readyCount++;
            if (readyCount === 2) { // 초기 ready + 리셋 후 ready
              resolve();
            }
          }
        });
      });

      expect(mockBrowserService.resetBrowser).toHaveBeenCalled();
      expect(statusUpdates.some(update => update.status === 'initializing')).toBe(true);
      expect(statusUpdates.some(update => update.status === 'ready')).toBe(true);
    });

    it('should handle browser reset failure', async () => {
      mockBrowserService.resetBrowser.mockRejectedValue(new Error('Reset failed'));
      
      let errorData: any = null;

      clientSocket.on('error', (data) => {
        errorData = data;
      });

      clientSocket.emit('reset_browser');

      await new Promise<void>((resolve) => {
        clientSocket.on('error', () => {
          resolve();
        });
      });

      expect(errorData.message).toBe('Browser reset failed');
      expect(errorData.code).toBeDefined();
    });
  });

  describe('Security', () => {
    beforeEach(async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });
    });

    it('should validate suspicious input', async () => {
      // SecurityManager 모킹이 필요하지만 현재 구조에서는 직접 테스트하기 어려움
      // 대신 결과를 통해 검증
      
      const suspiciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'eval(maliciousCode)'
      ];

      for (const input of suspiciousInputs) {
        let errorResult: any = null;

        clientSocket.on('command_result', (data) => {
          errorResult = data;
        });

        clientSocket.emit('execute_command', {
          userInput: input,
          context: {}
        });

        await new Promise<void>((resolve) => {
          clientSocket.on('command_result', () => {
            resolve();
          });
        });

        // 보안 검사에서 차단되어야 함
        expect(errorResult.success).toBe(false);
      }
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track connection statistics', () => {
      const stats = socketController.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('totalCommands');
      expect(stats).toHaveProperty('failedCommands');
      expect(stats).toHaveProperty('averageExecutionTime');
    });

    it('should return server status', () => {
      const status = socketController.getServerStatus();
      
      expect(status).toHaveProperty('activeSessions');
      expect(status).toHaveProperty('browserInstances');
      expect(status).toHaveProperty('executionQueue');
      expect(status).toHaveProperty('connectionStats');
    });

    it('should track active sessions', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      
      expect(socketController.getActiveSessionCount()).toBe(0);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });

      expect(socketController.getActiveSessionCount()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle socket errors gracefully', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });

      // 소켓 에러 시뮬레이션
      let errorHandled = false;
      
      clientSocket.on('error', (error) => {
        errorHandled = true;
        expect(error.message).toBeDefined();
      });

      // 강제로 에러 발생
      (clientSocket as any).emit('error', new Error('Test error'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(errorHandled).toBe(true);
    });

    it('should handle browser not ready state', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });

      // 브라우저 상태를 강제로 busy로 변경 (실제로는 private 멤버라 접근 불가)
      // 대신 동시에 여러 명령어를 실행하여 busy 상태 시뮬레이션
      
      let errorResults: any[] = [];
      
      clientSocket.on('command_result', (data) => {
        errorResults.push(data);
      });

      // 여러 명령어 동시 실행
      for (let i = 0; i < 5; i++) {
        clientSocket.emit('execute_command', {
          userInput: `command ${i}`,
          context: {}
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 최소한 하나의 에러가 발생해야 함 (브라우저 busy 상태로 인해)
      expect(errorResults.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should shutdown gracefully', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.cleanup.mockResolvedValue(undefined);
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });

      expect(socketController.getActiveSessionCount()).toBe(1);
      
      await socketController.shutdown();
      
      expect(mockBrowserService.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockBrowserService.initializeBrowser.mockResolvedValue(undefined);
      mockBrowserService.cleanup.mockRejectedValue(new Error('Cleanup failed'));
      
      clientSocket = Client(serverAddress);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('browser_status', (data) => {
          if (data.status === 'ready') {
            resolve();
          }
        });
      });

      // shutdown이 에러를 던지지 않아야 함
      await expect(socketController.shutdown()).resolves.not.toThrow();
    });
  });
}); 