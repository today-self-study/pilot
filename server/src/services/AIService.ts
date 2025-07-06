/**
 * @fileoverview AI 명령어 파싱 서비스
 * @description OpenAI API를 사용하여 자연어 명령어를 브라우저 명령어로 파싱
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import OpenAI from 'openai';
import { Logger } from '../utils/Logger';
import { InputValidator } from '../utils/InputValidator';
import { SecurityManager } from '../utils/SecurityManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { 
  AIParseRequest, 
  AIParseResponse, 
  BrowserCommand, 
  ServerConfig, 
  ErrorCode,
  AIUsageStats,
  AIPromptTemplate,
  AIParseCache,
  AIValidationResult
} from '../types';

/**
 * AI 명령어 파싱 서비스
 * OpenAI API를 사용하여 자연어 명령어를 브라우저 명령어로 파싱
 */
export class AIService {
  private openai: OpenAI;
  private logger: Logger;
  private validator: InputValidator;
  private securityManager: SecurityManager;
  private performanceMonitor: PerformanceMonitor;
  private config: ServerConfig['openai'];
  private parseCache: Map<string, ParseCache>;
  private usageStats: AIUsageStats;
  private promptTemplate: PromptTemplate;

  /**
   * AIService 생성자
   * @param config OpenAI 설정
   */
  constructor(config: ServerConfig['openai']) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
    this.logger = new Logger('AIService');
    this.validator = new InputValidator();
    this.securityManager = new SecurityManager();
    this.performanceMonitor = new PerformanceMonitor();
    this.parseCache = new Map();
    this.usageStats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      cacheHitRate: 0
    };
    this.promptTemplate = this.initializePromptTemplate();
    
    // 캐시 정리 스케줄러 (5분마다 실행)
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
  }

  /**
   * 자연어 명령어를 브라우저 명령어로 파싱
   * @param request 파싱 요청
   * @returns 파싱 결과
   */
  @PerformanceMonitor.measure('ai_parse_command')
  public async parseCommand(request: AIParseRequest): Promise<AIParseResponse> {
    const taskId = this.performanceMonitor.startTask('ai_parse_command');
    
    try {
      // 입력 검증
      const validationResult = await this.validateInput(request);
      if (!validationResult.isValid) {
        this.usageStats.failedRequests++;
        return {
          success: false,
          error: validationResult.error || '입력이 유효하지 않습니다.',
          confidence: 0
        };
      }

      // 캐시 확인
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.usageStats.totalRequests++;
        this.logger.info('Cache hit for AI parsing', { cacheKey });
        return cachedResult;
      }

      // AI 파싱 실행
      const result = await this.executeAIParsing(request);
      
      // 결과 캐싱
      if (result.success && result.commands) {
        this.saveToCache(cacheKey, result);
      }

      this.usageStats.totalRequests++;
      if (result.success) {
        this.usageStats.successRequests++;
      } else {
        this.usageStats.failedRequests++;
      }

      return result;

    } catch (error) {
      this.usageStats.failedRequests++;
      this.logger.error('AI parsing failed', { error, request });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        confidence: 0
      };
    } finally {
      this.performanceMonitor.endTask(taskId);
    }
  }

  /**
   * 입력 검증
   * @param request 파싱 요청
   * @returns 검증 결과
   */
  private async validateInput(request: AIParseRequest): Promise<{ isValid: boolean; error?: string }> {
    try {
      // 기본 입력 검증
      if (!request.userInput || typeof request.userInput !== 'string') {
        return { isValid: false, error: '사용자 입력이 필요합니다.' };
      }

      // 입력 길이 검증
      if (request.userInput.length > 1000) {
        return { isValid: false, error: '입력이 너무 깁니다. (최대 1000자)' };
      }

      // 보안 검증
      const cleanInput = this.validator.sanitizeInput(request.userInput);
      if (cleanInput !== request.userInput) {
        this.logger.warn('Input sanitized for AI parsing', { 
          original: request.userInput, 
          sanitized: cleanInput 
        });
      }

      // 의심스러운 콘텐츠 검사
      const contentCheck = await this.securityManager.checkSuspiciousContent(request.userInput);
      if (!contentCheck.safe) {
        return { 
          isValid: false, 
          error: `보안 검사 실패: ${contentCheck.reasons.join(', ')}` 
        };
      }

      // 컨텍스트 정보 검증
      if (request.context?.currentUrl) {
        const urlCheck = await this.securityManager.checkUrlSafety(request.context.currentUrl);
        if (!urlCheck.safe) {
          return { 
            isValid: false, 
            error: `현재 URL이 안전하지 않습니다: ${urlCheck.reasons.join(', ')}` 
          };
        }
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error('Input validation failed', { error, request });
      return { isValid: false, error: '입력 검증 중 오류가 발생했습니다.' };
    }
  }

  /**
   * AI 파싱 실행
   * @param request 파싱 요청
   * @returns 파싱 결과
   */
  private async executeAIParsing(request: AIParseRequest): Promise<AIParseResponse> {
    const startTime = Date.now();
    
    try {
      // 프롬프트 생성
      const prompt = this.generatePrompt(request);
      
      // OpenAI API 호출
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.promptTemplate.system },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      });

      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);

      // 토큰 사용량 기록
      if (response.usage) {
        this.usageStats.totalTokens += response.usage.total_tokens;
        this.logger.info('AI API usage', {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          responseTime
        });
      }

      // 응답 파싱
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI 응답이 비어있습니다.');
      }

      const parsedResponse = JSON.parse(content);
      
      // 응답 검증
      const validationResult = await this.validateAIResponse(parsedResponse);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || '응답 검증 실패');
      }

      return {
        success: true,
        commands: parsedResponse.commands,
        explanation: parsedResponse.explanation,
        confidence: parsedResponse.confidence || 0.8
      };

    } catch (error) {
      this.logger.error('AI parsing execution failed', { error, request });
      
      // 폴백 처리
      const fallbackResult = this.generateFallbackCommands(request);
      if (fallbackResult) {
        return fallbackResult;
      }

      throw error;
    }
  }

  /**
   * AI 응답 검증
   * @param response AI 응답
   * @returns 검증 결과
   */
  private async validateAIResponse(response: any): Promise<{ isValid: boolean; error?: string }> {
    try {
      // 기본 구조 검증
      if (!response || typeof response !== 'object') {
        return { isValid: false, error: '응답 형식이 올바르지 않습니다.' };
      }

      // 명령어 배열 검증
      if (!Array.isArray(response.commands)) {
        return { isValid: false, error: '명령어 배열이 필요합니다.' };
      }

      // 각 명령어 검증
      for (const command of response.commands) {
        const commandValidation = await this.validateBrowserCommand(command);
        if (!commandValidation.isValid) {
          return { isValid: false, error: commandValidation.error };
        }
      }

      // 신뢰도 점수 검증
      if (response.confidence !== undefined) {
        if (typeof response.confidence !== 'number' || 
            response.confidence < 0 || 
            response.confidence > 1) {
          return { isValid: false, error: '신뢰도 점수가 유효하지 않습니다.' };
        }
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error('AI response validation failed', { error, response });
      return { isValid: false, error: '응답 검증 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 브라우저 명령어 검증
   * @param command 브라우저 명령어
   * @returns 검증 결과
   */
  private async validateBrowserCommand(command: BrowserCommand): Promise<{ isValid: boolean; error?: string }> {
    try {
      // 기본 구조 검증
      if (!command || typeof command !== 'object') {
        return { isValid: false, error: '명령어 형식이 올바르지 않습니다.' };
      }

      // 액션 유형 검증
      const validActions = ['navigate', 'click', 'type', 'screenshot', 'scroll', 'wait', 'extract', 'evaluate'];
      if (!validActions.includes(command.action)) {
        return { isValid: false, error: `유효하지 않은 액션: ${command.action}` };
      }

      // 액션별 필수 파라미터 검증
      switch (command.action) {
        case 'navigate':
          if (!command.url) {
            return { isValid: false, error: 'navigate 명령어에는 URL이 필요합니다.' };
          }
          // URL 안전성 검사
          const urlCheck = await this.securityManager.checkUrlSafety(command.url);
          if (!urlCheck.safe) {
            return { isValid: false, error: `URL이 안전하지 않습니다: ${urlCheck.reasons.join(', ')}` };
          }
          break;

        case 'click':
          if (!command.selector) {
            return { isValid: false, error: 'click 명령어에는 선택자가 필요합니다.' };
          }
          if (!this.validator.isValidSelector(command.selector)) {
            return { isValid: false, error: '유효하지 않은 CSS 선택자입니다.' };
          }
          break;

        case 'type':
          if (!command.selector || !command.value) {
            return { isValid: false, error: 'type 명령어에는 선택자와 값이 필요합니다.' };
          }
          if (!this.validator.isValidSelector(command.selector)) {
            return { isValid: false, error: '유효하지 않은 CSS 선택자입니다.' };
          }
          break;

        case 'evaluate':
          if (!command.value) {
            return { isValid: false, error: 'evaluate 명령어에는 JavaScript 코드가 필요합니다.' };
          }
          // JavaScript 안전성 검사
          const scriptCheck = await this.securityManager.checkScriptSafety(command.value);
          if (!scriptCheck.safe) {
            return { isValid: false, error: `스크립트가 안전하지 않습니다: ${scriptCheck.reasons.join(', ')}` };
          }
          break;
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error('Browser command validation failed', { error, command });
      return { isValid: false, error: '명령어 검증 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 프롬프트 생성
   * @param request 파싱 요청
   * @returns 생성된 프롬프트
   */
  private generatePrompt(request: AIParseRequest): string {
    const contextInfo = this.buildContextInfo(request);
    
    return this.promptTemplate.user
      .replace('{userInput}', request.userInput)
      .replace('{context}', contextInfo)
      .replace('{examples}', this.promptTemplate.examples || '');
  }

  /**
   * 컨텍스트 정보 생성
   * @param request 파싱 요청
   * @returns 컨텍스트 정보
   */
  private buildContextInfo(request: AIParseRequest): string {
    const contextParts: string[] = [];

    if (request.context?.currentUrl) {
      contextParts.push(`현재 URL: ${request.context.currentUrl}`);
    }

    if (request.context?.pageTitle) {
      contextParts.push(`페이지 제목: ${request.context.pageTitle}`);
    }

    if (request.context?.previousCommands?.length) {
      contextParts.push(`이전 명령어: ${request.context.previousCommands.map(cmd => cmd.action).join(', ')}`);
    }

    if (request.currentScreenshot) {
      contextParts.push('현재 스크린샷이 제공됨');
    }

    return contextParts.join('\n');
  }

  /**
   * 폴백 명령어 생성
   * @param request 파싱 요청
   * @returns 폴백 명령어 또는 null
   */
  private generateFallbackCommands(request: AIParseRequest): AIParseResponse | null {
    const input = request.userInput.toLowerCase();
    
    // 간단한 패턴 매칭으로 기본 명령어 생성
    if (input.includes('스크린샷') || input.includes('screenshot')) {
      return {
        success: true,
        commands: [{ action: 'screenshot' }],
        explanation: '스크린샷을 촬영합니다.',
        confidence: 0.6
      };
    }

    if (input.includes('새로고침') || input.includes('refresh')) {
      return {
        success: true,
        commands: [{ action: 'evaluate', value: 'window.location.reload()' }],
        explanation: '페이지를 새로고침합니다.',
        confidence: 0.6
      };
    }

    // URL 패턴 감지
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return {
        success: true,
        commands: [{ action: 'navigate', url: urlMatch[0] }],
        explanation: `${urlMatch[0]}로 이동합니다.`,
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * 캐시 키 생성
   * @param request 파싱 요청
   * @returns 캐시 키
   */
  private generateCacheKey(request: AIParseRequest): string {
    const keyData = {
      userInput: request.userInput,
      currentUrl: request.context?.currentUrl,
      pageTitle: request.context?.pageTitle
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * 캐시에서 결과 조회
   * @param key 캐시 키
   * @returns 캐시된 결과 또는 null
   */
  private getFromCache(key: string): AIParseResponse | null {
    const cached = this.parseCache.get(key);
    if (!cached) {
      return null;
    }

    // 캐시 만료 확인 (1시간)
    if (Date.now() - cached.createdAt.getTime() > 60 * 60 * 1000) {
      this.parseCache.delete(key);
      return null;
    }

    cached.usage++;
    this.updateCacheHitRate();
    return cached.result;
  }

  /**
   * 캐시에 결과 저장
   * @param key 캐시 키
   * @param result 파싱 결과
   */
  private saveToCache(key: string, result: AIParseResponse): void {
    this.parseCache.set(key, {
      key,
      result,
      createdAt: new Date(),
      usage: 0
    });

    // 캐시 크기 제한 (최대 1000개)
    if (this.parseCache.size > 1000) {
      const oldestKey = this.parseCache.keys().next().value;
      this.parseCache.delete(oldestKey);
    }
  }

  /**
   * 캐시 정리
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.parseCache.entries()) {
      // 1시간 이상 된 캐시 또는 사용되지 않은 캐시 제거
      if (now - cached.createdAt.getTime() > 60 * 60 * 1000 || cached.usage === 0) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.parseCache.delete(key);
    }

    this.logger.info('Cache cleanup completed', { 
      removedCount: expiredKeys.length, 
      remainingCount: this.parseCache.size 
    });
  }

  /**
   * 응답 시간 통계 업데이트
   * @param responseTime 응답 시간
   */
  private updateResponseTimeStats(responseTime: number): void {
    const totalTime = this.usageStats.averageResponseTime * this.usageStats.totalRequests;
    this.usageStats.averageResponseTime = (totalTime + responseTime) / (this.usageStats.totalRequests + 1);
  }

  /**
   * 캐시 적중률 업데이트
   */
  private updateCacheHitRate(): void {
    const cacheHits = Array.from(this.parseCache.values()).reduce((sum, cached) => sum + cached.usage, 0);
    this.usageStats.cacheHitRate = this.usageStats.totalRequests > 0 ? 
      cacheHits / this.usageStats.totalRequests : 0;
  }

  /**
   * 프롬프트 템플릿 초기화
   * @returns 프롬프트 템플릿
   */
  private initializePromptTemplate(): PromptTemplate {
    return {
      system: `당신은 웹 브라우저 자동화 전문가입니다. 사용자의 자연어 명령을 브라우저 명령어로 변환하는 역할을 합니다.

사용 가능한 명령어:
1. navigate: 웹페이지로 이동 (url 필요)
2. click: 요소 클릭 (selector 필요)
3. type: 텍스트 입력 (selector, value 필요)
4. screenshot: 스크린샷 촬영
5. scroll: 페이지 스크롤 (scrollOptions 선택)
6. wait: 요소 대기 (selector, waitCondition 선택)
7. extract: 텍스트 추출 (selector 필요)
8. evaluate: JavaScript 실행 (value 필요)

응답 형식:
{
  "commands": [
    {
      "action": "명령어_유형",
      "selector": "CSS_선택자",
      "value": "입력값_또는_스크립트",
      "url": "URL",
      "timeout": 5000,
      "scrollOptions": {"x": 0, "y": 300, "behavior": "smooth"},
      "waitCondition": "visible",
      "options": {}
    }
  ],
  "explanation": "실행 계획 설명",
  "confidence": 0.9
}

안전성 규칙:
- 악성 사이트 접근 금지
- 민감한 정보 입력 금지
- 위험한 JavaScript 실행 금지
- 개인정보 수집 금지`,

      user: `사용자 입력: {userInput}

컨텍스트 정보:
{context}

{examples}

위 사용자 입력을 분석하여 적절한 브라우저 명령어로 변환해주세요. 응답은 JSON 형식으로 제공해야 합니다.`,

      examples: `
예제 1:
입력: "구글에서 날씨 검색해줘"
출력: {
  "commands": [
    {"action": "navigate", "url": "https://google.com"},
    {"action": "type", "selector": "input[name='q']", "value": "날씨"},
    {"action": "click", "selector": "input[value='Google 검색']"}
  ],
  "explanation": "구글에 접속하여 날씨를 검색합니다.",
  "confidence": 0.95
}

예제 2:
입력: "로그인 버튼 클릭하고 이메일 입력해줘"
출력: {
  "commands": [
    {"action": "click", "selector": "button[type='submit'], .login-btn, #login"},
    {"action": "type", "selector": "input[type='email'], input[name='email']", "value": "user@example.com"}
  ],
  "explanation": "로그인 버튼을 클릭하고 이메일을 입력합니다.",
  "confidence": 0.85
}

예제 3:
입력: "페이지 아래로 스크롤해줘"
출력: {
  "commands": [
    {"action": "scroll", "scrollOptions": {"y": 500, "behavior": "smooth"}}
  ],
  "explanation": "페이지를 아래로 스크롤합니다.",
  "confidence": 0.9
}`
    };
  }

  /**
   * 사용량 통계 조회
   * @returns 사용량 통계
   */
  public getUsageStats(): AIUsageStats {
    return { ...this.usageStats };
  }

  /**
   * 캐시 상태 조회
   * @returns 캐시 상태
   */
  public getCacheStatus(): { size: number; hitRate: number } {
    return {
      size: this.parseCache.size,
      hitRate: this.usageStats.cacheHitRate
    };
  }

  /**
   * 캐시 초기화
   */
  public clearCache(): void {
    this.parseCache.clear();
    this.usageStats.cacheHitRate = 0;
    this.logger.info('AI service cache cleared');
  }

  /**
   * 서비스 종료
   */
  public async shutdown(): Promise<void> {
    try {
      this.parseCache.clear();
      this.logger.info('AI service shutdown completed', { 
        finalStats: this.usageStats,
        cacheSize: this.parseCache.size
      });
    } catch (error) {
      this.logger.error('Error during AI service shutdown', { error });
    }
  }
} 