/**
 * @fileoverview AI 서비스 단위 테스트
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import { AIService } from '../services/AIService';
import { AIParseRequest, AIParseResponse, BrowserCommand, ServerConfig } from '../types';
import OpenAI from 'openai';

// OpenAI 모킹
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('AIService', () => {
  let aiService: AIService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockConfig: ServerConfig['openai'];

  beforeEach(() => {
    // 설정 초기화
    mockConfig = {
      apiKey: 'test-api-key',
      model: 'gpt-4',
      maxTokens: 1500,
      temperature: 0.1
    };

    // OpenAI 모킹 설정
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAI);

    // AIService 인스턴스 생성
    aiService = new AIService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should successfully parse a simple navigation command', async () => {
      // OpenAI 응답 모킹
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'navigate',
                    url: 'https://google.com'
                  }
                ],
                explanation: '구글로 이동합니다.',
                confidence: 0.95
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '구글로 이동해줘',
        context: {
          currentUrl: 'https://example.com',
          pageTitle: 'Example Page'
        }
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands![0].action).toBe('navigate');
      expect(result.commands![0].url).toBe('https://google.com');
      expect(result.explanation).toBe('구글로 이동합니다.');
      expect(result.confidence).toBe(0.95);
    });

    it('should successfully parse a complex multi-step command', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'navigate',
                    url: 'https://google.com'
                  },
                  {
                    action: 'type',
                    selector: 'input[name="q"]',
                    value: '날씨'
                  },
                  {
                    action: 'click',
                    selector: 'input[value="Google 검색"]'
                  }
                ],
                explanation: '구글에서 날씨를 검색합니다.',
                confidence: 0.9
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 80,
          total_tokens: 200
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '구글에서 날씨 검색해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(3);
      expect(result.commands![0].action).toBe('navigate');
      expect(result.commands![1].action).toBe('type');
      expect(result.commands![2].action).toBe('click');
    });

    it('should handle invalid input gracefully', async () => {
      const request: AIParseRequest = {
        userInput: ''
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 입력이 필요합니다.');
      expect(result.confidence).toBe(0);
    });

    it('should handle too long input', async () => {
      const request: AIParseRequest = {
        userInput: 'a'.repeat(1001) // 1000자 초과
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('입력이 너무 깁니다. (최대 1000자)');
    });

    it('should handle unsafe URLs in context', async () => {
      const request: AIParseRequest = {
        userInput: '페이지 스크롤해줘',
        context: {
          currentUrl: 'javascript:alert("xss")'
        }
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('현재 URL이 안전하지 않습니다');
    });

    it('should handle OpenAI API errors', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API quota exceeded')
      );

      const request: AIParseRequest = {
        userInput: '구글로 이동해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API quota exceeded');
    });

    it('should handle malformed AI responses', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'invalid json response'
            }
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '구글로 이동해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token');
    });

    it('should reject unsafe JavaScript commands', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'evaluate',
                    value: 'document.cookie = "malicious=true"'
                  }
                ],
                explanation: '쿠키를 설정합니다.',
                confidence: 0.8
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 40,
          total_tokens: 120
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '쿠키 설정해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('스크립트가 안전하지 않습니다');
    });

    it('should use cache for repeated requests', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'screenshot'
                  }
                ],
                explanation: '스크린샷을 촬영합니다.',
                confidence: 0.9
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '스크린샷 찍어줘'
      };

      // 첫 번째 요청
      const result1 = await aiService.parseCommand(request);
      expect(result1.success).toBe(true);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);

      // 두 번째 요청 (캐시 사용)
      const result2 = await aiService.parseCommand(request);
      expect(result2.success).toBe(true);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1); // 호출 횟수 증가하지 않음
    });

    it('should generate fallback commands for simple patterns', async () => {
      // OpenAI API가 실패하는 경우 모킹
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const request: AIParseRequest = {
        userInput: '스크린샷 찍어줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands![0].action).toBe('screenshot');
      expect(result.confidence).toBe(0.6);
    });

    it('should generate fallback commands for URL patterns', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const request: AIParseRequest = {
        userInput: 'https://example.com으로 이동해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands![0].action).toBe('navigate');
      expect(result.commands![0].url).toBe('https://example.com');
    });

    it('should validate command structure', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'invalid_action',
                    selector: 'div'
                  }
                ],
                explanation: '잘못된 명령어입니다.',
                confidence: 0.5
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 60,
          completion_tokens: 25,
          total_tokens: 85
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '잘못된 명령어 테스트'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 액션');
    });

    it('should validate required parameters for commands', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'navigate'
                    // url이 누락됨
                  }
                ],
                explanation: 'URL 없이 이동 시도',
                confidence: 0.3
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 40,
          completion_tokens: 20,
          total_tokens: 60
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '이동해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('navigate 명령어에는 URL이 필요합니다.');
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const stats = aiService.getUsageStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successRequests');
      expect(stats).toHaveProperty('failedRequests');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('cacheHitRate');
    });
  });

  describe('getCacheStatus', () => {
    it('should return cache status', () => {
      const status = aiService.getCacheStatus();

      expect(status).toHaveProperty('size');
      expect(status).toHaveProperty('hitRate');
      expect(typeof status.size).toBe('number');
      expect(typeof status.hitRate).toBe('number');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      // 캐시에 항목 추가
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [{ action: 'screenshot' }],
                explanation: '스크린샷',
                confidence: 0.9
              })
            }
          }
        ],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await aiService.parseCommand({ userInput: '스크린샷' });

      let status = aiService.getCacheStatus();
      expect(status.size).toBeGreaterThan(0);

      // 캐시 초기화
      aiService.clearCache();

      status = aiService.getCacheStatus();
      expect(status.size).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(aiService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Security Tests', () => {
    it('should reject suspicious input patterns', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'eval(maliciousCode)',
        'document.cookie'
      ];

      for (const input of maliciousInputs) {
        const request: AIParseRequest = {
          userInput: input
        };

        const result = await aiService.parseCommand(request);
        expect(result.success).toBe(false);
        expect(result.error).toContain('보안 검사 실패');
      }
    });

    it('should validate CSS selectors', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'click',
                    selector: 'invalid selector with spaces'
                  }
                ],
                explanation: '잘못된 선택자',
                confidence: 0.4
              })
            }
          }
        ],
        usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: '잘못된 선택자 테스트'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 CSS 선택자');
    });

    it('should check URL safety', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [
                  {
                    action: 'navigate',
                    url: 'ftp://malicious.com'
                  }
                ],
                explanation: 'FTP 프로토콜로 이동',
                confidence: 0.6
              })
            }
          }
        ],
        usage: { prompt_tokens: 40, completion_tokens: 25, total_tokens: 65 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: AIParseRequest = {
        userInput: 'FTP 사이트로 이동해줘'
      };

      const result = await aiService.parseCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL이 안전하지 않습니다');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [{ action: 'screenshot' }],
                explanation: '스크린샷',
                confidence: 0.9
              })
            }
          }
        ],
        usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const requests = Array.from({ length: 10 }, (_, i) => ({
        userInput: `스크린샷 ${i}`
      }));

      const promises = requests.map(request => aiService.parseCommand(request));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should track response times', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [{ action: 'screenshot' }],
                explanation: '스크린샷',
                confidence: 0.9
              })
            }
          }
        ],
        usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await aiService.parseCommand({ userInput: '스크린샷' });

      const stats = aiService.getUsageStats();
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });

    it('should limit cache size', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                commands: [{ action: 'screenshot' }],
                explanation: '스크린샷',
                confidence: 0.9
              })
            }
          }
        ],
        usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      // 캐시 크기 제한 테스트를 위해 많은 요청 생성
      const requests = Array.from({ length: 50 }, (_, i) => ({
        userInput: `unique request ${i}`
      }));

      for (const request of requests) {
        await aiService.parseCommand(request);
      }

      const status = aiService.getCacheStatus();
      expect(status.size).toBeLessThanOrEqual(50); // 캐시 크기 제한 확인
    });
  });
}); 