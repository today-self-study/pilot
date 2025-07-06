/**
 * @fileoverview 브라우저 자동화 서비스 클래스
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import puppeteer, { Browser, Page, ElementHandle, WaitForOptions } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { BrowserCommand, BrowserResponse, ErrorCode, LogLevel } from '../types';
import { Logger } from '../utils/Logger';
import { InputValidator } from '../utils/InputValidator';
import { SecurityManager } from '../utils/SecurityManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

/**
 * 브라우저 인스턴스 관리를 위한 서비스 클래스
 * Puppeteer를 사용한 브라우저 자동화 기능을 제공
 */
export class BrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly instanceId: string;
  private readonly logger: Logger;
  private readonly inputValidator: InputValidator;
  private readonly securityManager: SecurityManager;
  private readonly performanceMonitor: PerformanceMonitor;
  private isInitialized: boolean = false;
  private readonly defaultTimeout: number = 30000;
  private readonly navigationTimeout: number = 30000;
  private readonly maxMemoryUsage: number = 500 * 1024 * 1024; // 500MB

  /**
   * BrowserService 생성자
   * @param instanceId 브라우저 인스턴스 ID
   * @param options 브라우저 설정 옵션
   */
  constructor(
    instanceId?: string,
    options: {
      headless?: boolean;
      timeout?: number;
      navigationTimeout?: number;
      maxMemoryUsage?: number;
    } = {}
  ) {
    this.instanceId = instanceId || uuidv4();
    this.logger = new Logger(`BrowserService-${this.instanceId}`);
    this.inputValidator = new InputValidator();
    this.securityManager = new SecurityManager();
    this.performanceMonitor = new PerformanceMonitor();
    
    if (options.timeout) this.defaultTimeout = options.timeout;
    if (options.navigationTimeout) this.navigationTimeout = options.navigationTimeout;
    if (options.maxMemoryUsage) this.maxMemoryUsage = options.maxMemoryUsage;

    this.logger.info('BrowserService 인스턴스 생성됨', {
      instanceId: this.instanceId,
      options
    });
  }

  /**
   * 브라우저 인스턴스 초기화
   * @param options Puppeteer 브라우저 옵션
   * @returns Promise<void>
   */
  public async initialize(options: {
    headless?: boolean;
    userDataDir?: string;
    args?: string[];
  } = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('브라우저 초기화 시작');

      // 기본 브라우저 설정
      const defaultArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ];

      const browserOptions: any = {
        headless: options.headless ?? true,
        args: [...defaultArgs, ...(options.args || [])],
        timeout: this.defaultTimeout,
        defaultViewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false,
          isLandscape: true
        },
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: ['--enable-automation'],
        devtools: false
      };

      // 사용자 데이터 디렉토리 설정
      if (options.userDataDir) {
        browserOptions.userDataDir = options.userDataDir;
      }

      // 브라우저 실행
      this.browser = await puppeteer.launch(browserOptions);
      
      // 새 페이지 생성
      this.page = await this.browser.newPage();
      
      // 기본 설정 적용
      await this.setupPage();
      
      this.isInitialized = true;
      
      const initTime = Date.now() - startTime;
      this.logger.info('브라우저 초기화 완료', {
        initTime,
        pid: this.browser.process()?.pid
      });

      // 메모리 모니터링 시작
      this.startMemoryMonitoring();

    } catch (error) {
      this.logger.error('브라우저 초기화 실패', error);
      await this.cleanup();
      throw new Error(`브라우저 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 페이지 기본 설정 적용
   * @private
   */
  private async setupPage(): Promise<void> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    try {
      // 타임아웃 설정
      this.page.setDefaultTimeout(this.defaultTimeout);
      this.page.setDefaultNavigationTimeout(this.navigationTimeout);

      // User Agent 설정
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 추가 헤더 설정
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      // JavaScript 활성화
      await this.page.setJavaScriptEnabled(true);

      // 콘솔 로그 리스너 설정
      this.page.on('console', (msg) => {
        const level = msg.type() as LogLevel;
        this.logger.log(level, `페이지 콘솔: ${msg.text()}`);
      });

      // 에러 리스너 설정
      this.page.on('error', (error) => {
        this.logger.error('페이지 에러', error);
      });

      // 페이지 크래시 리스너 설정
      this.page.on('pageerror', (error) => {
        this.logger.error('페이지 JavaScript 에러', error);
      });

      // 요청 인터셉터 설정 (보안 및 성능)
      await this.page.setRequestInterception(true);
      
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();

        // 보안 검증
        if (!this.securityManager.isUrlAllowed(url)) {
          this.logger.warn('차단된 URL 요청', { url, resourceType });
          request.abort();
          return;
        }

        // 불필요한 리소스 차단 (성능 최적화)
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
          return;
        }

        request.continue();
      });

      this.logger.info('페이지 기본 설정 완료');

    } catch (error) {
      this.logger.error('페이지 설정 실패', error);
      throw error;
    }
  }

  /**
   * 메모리 모니터링 시작
   * @private
   */
  private startMemoryMonitoring(): void {
    setInterval(async () => {
      try {
        if (!this.browser || !this.page) return;

        const metrics = await this.page.metrics();
        const memoryUsage = metrics.JSHeapUsedSize;

        if (memoryUsage && memoryUsage > this.maxMemoryUsage) {
          this.logger.warn('메모리 사용량 초과', {
            current: memoryUsage,
            max: this.maxMemoryUsage
          });
          
          // 메모리 정리 시도
          await this.performMemoryCleanup();
        }

        this.performanceMonitor.recordMetric('memoryUsage', memoryUsage || 0);

      } catch (error) {
        this.logger.error('메모리 모니터링 에러', error);
      }
    }, 30000); // 30초마다 체크
  }

  /**
   * 메모리 정리 수행
   * @private
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      if (!this.page) return;

      // JavaScript 가비지 컬렉션 실행
      await this.page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      // 페이지 리소스 정리
      await this.page.evaluate(() => {
        // 이미지 캐시 정리
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          if (img.src) {
            img.removeAttribute('src');
          }
        });

        // 불필요한 DOM 요소 정리
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => script.remove());
      });

      this.logger.info('메모리 정리 완료');

    } catch (error) {
      this.logger.error('메모리 정리 실패', error);
    }
  }

  /**
   * 브라우저 명령어 실행
   * @param command 실행할 명령어
   * @returns Promise<BrowserResponse>
   */
  public async executeCommand(command: BrowserCommand): Promise<BrowserResponse> {
    const startTime = Date.now();
    const commandId = uuidv4();

    try {
      this.logger.info('명령어 실행 시작', {
        commandId,
        command: command.action,
        selector: command.selector,
        url: command.url
      });

      // 초기화 확인
      if (!this.isInitialized || !this.page) {
        throw new Error('브라우저가 초기화되지 않았습니다.');
      }

      // 입력 검증
      const validation = this.inputValidator.validateCommand(command);
      if (!validation.isValid) {
        throw new Error(`입력 검증 실패: ${validation.errors.join(', ')}`);
      }

      // 보안 검증
      if (command.url && !this.securityManager.isUrlAllowed(command.url)) {
        throw new Error('허용되지 않은 URL입니다.');
      }

      let result: any = null;
      let screenshot: string | undefined;

      // 명령어 실행
      switch (command.action) {
        case 'navigate':
          result = await this.handleNavigate(command);
          break;
        case 'click':
          result = await this.handleClick(command);
          break;
        case 'type':
          result = await this.handleType(command);
          break;
        case 'screenshot':
          result = await this.handleScreenshot(command);
          break;
        case 'scroll':
          result = await this.handleScroll(command);
          break;
        case 'wait':
          result = await this.handleWait(command);
          break;
        case 'extract':
          result = await this.handleExtract(command);
          break;
        case 'evaluate':
          result = await this.handleEvaluate(command);
          break;
        default:
          throw new Error(`지원하지 않는 명령어입니다: ${command.action}`);
      }

      // 실행 후 스크린샷 (선택적)
      if (command.options?.captureScreenshot !== false) {
        screenshot = await this.captureScreenshot();
      }

      const executionTime = Date.now() - startTime;
      
      this.logger.info('명령어 실행 완료', {
        commandId,
        executionTime,
        action: command.action
      });

      return {
        success: true,
        data: result,
        screenshot,
        executionTime,
        metadata: {
          commandId,
          timestamp: new Date().toISOString(),
          instanceId: this.instanceId,
          currentUrl: this.page.url(),
          pageTitle: await this.page.title()
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('명령어 실행 실패', {
        commandId,
        executionTime,
        error: errorMessage,
        command: command.action
      });

      return {
        success: false,
        error: errorMessage,
        executionTime,
        metadata: {
          commandId,
          timestamp: new Date().toISOString(),
          instanceId: this.instanceId,
          errorCode: ErrorCode.COMMAND_EXECUTION_FAILED
        }
      };
    }
  }

  /**
   * 페이지 네비게이션 처리
   * @private
   */
  private async handleNavigate(command: BrowserCommand): Promise<any> {
    if (!command.url || !this.page) {
      throw new Error('URL이 필요합니다.');
    }

    const waitOptions: WaitForOptions = {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: command.timeout || this.navigationTimeout
    };

    const response = await this.page.goto(command.url, waitOptions);
    
    if (!response || !response.ok()) {
      throw new Error(`페이지 로드 실패: ${response?.status() || 'Unknown'}`);
    }

    return {
      url: this.page.url(),
      title: await this.page.title(),
      status: response.status(),
      loadTime: Date.now()
    };
  }

  /**
   * 요소 클릭 처리
   * @private
   */
  private async handleClick(command: BrowserCommand): Promise<any> {
    if (!command.selector || !this.page) {
      throw new Error('선택자가 필요합니다.');
    }

    // 요소 대기
    await this.page.waitForSelector(command.selector, {
      visible: true,
      timeout: command.timeout || this.defaultTimeout
    });

    const element = await this.page.$(command.selector);
    if (!element) {
      throw new Error(`요소를 찾을 수 없습니다: ${command.selector}`);
    }

    // 요소가 클릭 가능한지 확인
    const isClickable = await element.evaluate((el: Element) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.pointerEvents !== 'none';
    });

    if (!isClickable) {
      throw new Error('요소가 클릭 가능하지 않습니다.');
    }

    // 클릭 실행
    await element.click();

    return {
      selector: command.selector,
      clicked: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 텍스트 입력 처리
   * @private
   */
  private async handleType(command: BrowserCommand): Promise<any> {
    if (!command.selector || !command.value || !this.page) {
      throw new Error('선택자와 입력값이 필요합니다.');
    }

    // 요소 대기
    await this.page.waitForSelector(command.selector, {
      visible: true,
      timeout: command.timeout || this.defaultTimeout
    });

    const element = await this.page.$(command.selector);
    if (!element) {
      throw new Error(`요소를 찾을 수 없습니다: ${command.selector}`);
    }

    // 기존 텍스트 지우기
    await element.click({ clickCount: 3 });
    await element.press('Delete');

    // 새 텍스트 입력
    const sanitizedValue = this.securityManager.sanitizeInput(command.value);
    await element.type(sanitizedValue, { delay: 50 });

    return {
      selector: command.selector,
      value: sanitizedValue,
      typed: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 스크린샷 촬영 처리
   * @private
   */
  private async handleScreenshot(command: BrowserCommand): Promise<any> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    const screenshot = await this.captureScreenshot();
    
    return {
      screenshot,
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      title: await this.page.title()
    };
  }

  /**
   * 스크롤 처리
   * @private
   */
  private async handleScroll(command: BrowserCommand): Promise<any> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    const scrollOptions = command.scrollOptions || { x: 0, y: 100 };
    
    await this.page.evaluate((options) => {
      window.scrollBy(options.x || 0, options.y || 0);
    }, scrollOptions);

    return {
      scrolled: true,
      x: scrollOptions.x,
      y: scrollOptions.y,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 대기 처리
   * @private
   */
  private async handleWait(command: BrowserCommand): Promise<any> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    const waitTime = command.timeout || 1000;
    const waitCondition = command.waitCondition;

    if (waitCondition === 'networkidle') {
      await this.page.waitForLoadState('networkidle', { timeout: waitTime });
    } else if (command.selector) {
      const visibilityOption = waitCondition === 'visible' ? true : 
                              waitCondition === 'hidden' ? false : undefined;
      
      await this.page.waitForSelector(command.selector, {
        visible: visibilityOption,
        timeout: waitTime
      });
    } else {
      await this.page.waitForTimeout(waitTime);
    }

    return {
      waited: true,
      duration: waitTime,
      condition: waitCondition,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 데이터 추출 처리
   * @private
   */
  private async handleExtract(command: BrowserCommand): Promise<any> {
    if (!command.selector || !this.page) {
      throw new Error('선택자가 필요합니다.');
    }

    const elements = await this.page.$$(command.selector);
    
    if (elements.length === 0) {
      throw new Error(`요소를 찾을 수 없습니다: ${command.selector}`);
    }

    const extractedData = await Promise.all(
      elements.map(async (element) => {
        return await element.evaluate((el: Element) => {
          return {
            text: el.textContent?.trim() || '',
            html: el.innerHTML,
            attributes: Array.from(el.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>)
          };
        });
      })
    );

    return {
      selector: command.selector,
      count: extractedData.length,
      data: extractedData,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * JavaScript 실행 처리
   * @private
   */
  private async handleEvaluate(command: BrowserCommand): Promise<any> {
    if (!command.value || !this.page) {
      throw new Error('실행할 JavaScript 코드가 필요합니다.');
    }

    // 보안 검증
    const sanitizedCode = this.securityManager.sanitizeJavaScript(command.value);
    
    const result = await this.page.evaluate((code) => {
      try {
        // eslint-disable-next-line no-eval
        return eval(code);
      } catch (error) {
        throw new Error(`JavaScript 실행 에러: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, sanitizedCode);

    return {
      code: sanitizedCode,
      result,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 스크린샷 캡처
   * @private
   */
  private async captureScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    const screenshot = await this.page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      }
    });

    return `data:image/png;base64,${screenshot}`;
  }

  /**
   * 현재 페이지 정보 가져오기
   * @returns Promise<object>
   */
  public async getPageInfo(): Promise<{
    url: string;
    title: string;
    isReady: boolean;
    metrics?: any;
  }> {
    if (!this.page) {
      return {
        url: '',
        title: '',
        isReady: false
      };
    }

    try {
      const [url, title, metrics] = await Promise.all([
        this.page.url(),
        this.page.title(),
        this.page.metrics()
      ]);

      return {
        url,
        title,
        isReady: true,
        metrics
      };
    } catch (error) {
      this.logger.error('페이지 정보 가져오기 실패', error);
      return {
        url: '',
        title: '',
        isReady: false
      };
    }
  }

  /**
   * 브라우저 인스턴스 상태 확인
   * @returns boolean
   */
  public isReady(): boolean {
    return this.isInitialized && this.browser !== null && this.page !== null;
  }

  /**
   * 브라우저 인스턴스 정리
   * @returns Promise<void>
   */
  public async cleanup(): Promise<void> {
    try {
      this.logger.info('브라우저 정리 시작');

      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isInitialized = false;
      
      this.logger.info('브라우저 정리 완료');

    } catch (error) {
      this.logger.error('브라우저 정리 실패', error);
    }
  }

  /**
   * 인스턴스 ID 반환
   * @returns string
   */
  public getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * 성능 메트릭 반환
   * @returns object
   */
  public getPerformanceMetrics(): any {
    return this.performanceMonitor.getMetrics();
  }
} 