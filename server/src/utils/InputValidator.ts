import { BrowserCommand } from '../types';

/**
 * 사용자 입력 검증 및 새니타이징을 담당하는 클래스
 * XSS 공격 방지, 명령어 검증, 입력 값 정리 등을 수행
 */
export class InputValidator {
  private static readonly DANGEROUS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
    /document\.write/gi,
    /document\.writeln/gi,
    /innerHTML/gi,
    /outerHTML/gi,
    /insertAdjacentHTML/gi,
    /execCommand/gi,
    /importScripts/gi,
    /postMessage/gi,
    /window\.location/gi,
    /location\.href/gi,
    /location\.replace/gi,
    /location\.assign/gi,
    /history\.pushState/gi,
    /history\.replaceState/gi,
    /XMLHttpRequest/gi,
    /fetch\s*\(/gi,
    /WebSocket/gi,
    /EventSource/gi,
    /SharedWorker/gi,
    /Worker/gi,
    /ServiceWorker/gi,
    /importScripts/gi,
  ];

  private static readonly SAFE_URL_PROTOCOLS = ['http:', 'https:', 'file:', 'data:'];
  
  private static readonly VALID_BROWSER_COMMANDS = [
    'navigate', 'click', 'type', 'screenshot', 'scroll', 'wait', 'extract', 'evaluate'
  ];

  private static readonly MAX_INPUT_LENGTH = 10000;
  private static readonly MAX_URL_LENGTH = 2048;
  private static readonly MAX_SELECTOR_LENGTH = 1000;
  private static readonly MAX_TEXT_LENGTH = 5000;
  private static readonly MAX_SCRIPT_LENGTH = 5000;

  /**
   * 브라우저 명령어를 검증합니다.
   * 
   * @param command 검증할 브라우저 명령어
   * @throws {Error} 유효하지 않은 명령어인 경우
   */
  public static validateBrowserCommand(command: BrowserCommand): void {
    if (!command || typeof command !== 'object') {
      throw new Error('명령어는 객체여야 합니다.');
    }

    if (!command.action || typeof command.action !== 'string') {
      throw new Error('명령어 액션은 필수이며 문자열이어야 합니다.');
    }

    if (!this.VALID_BROWSER_COMMANDS.includes(command.action)) {
      throw new Error(`지원되지 않는 명령어 액션입니다: ${command.action}`);
    }

    // 매개변수 검증
    this.validateCommandParams(command.action, command);

    // 타임아웃 검증
    if (command.timeout !== undefined) {
      if (typeof command.timeout !== 'number' || command.timeout < 0 || command.timeout > 300000) {
        throw new Error('타임아웃은 0-300000ms 범위의 숫자여야 합니다.');
      }
    }
  }

  /**
   * 명령어 매개변수를 검증합니다.
   * 
   * @param commandType 명령어 타입
   * @param command 브라우저 명령어 객체
   * @throws {Error} 유효하지 않은 매개변수인 경우
   */
  private static validateCommandParams(commandType: string, command: BrowserCommand): void {
    switch (commandType) {
      case 'navigate':
        if (!command.url || typeof command.url !== 'string') {
          throw new Error('navigate 명령어에는 url이 필요합니다.');
        }
        this.validateUrl(command.url);
        break;

      case 'click':
        if (!command.selector || typeof command.selector !== 'string') {
          throw new Error('click 명령어에는 selector가 필요합니다.');
        }
        this.validateSelector(command.selector);
        break;

      case 'type':
        if (!command.selector || typeof command.selector !== 'string') {
          throw new Error('type 명령어에는 selector가 필요합니다.');
        }
        if (!command.value || typeof command.value !== 'string') {
          throw new Error('type 명령어에는 value가 필요합니다.');
        }
        this.validateSelector(command.selector);
        this.validateText(command.value);
        break;

      case 'screenshot':
        if (command.selector && typeof command.selector !== 'string') {
          throw new Error('screenshot 명령어의 selector는 문자열이어야 합니다.');
        }
        if (command.selector) {
          this.validateSelector(command.selector);
        }
        break;

      case 'scroll':
        if (command.selector && typeof command.selector !== 'string') {
          throw new Error('scroll 명령어의 selector는 문자열이어야 합니다.');
        }
        if (command.selector) {
          this.validateSelector(command.selector);
        }
        if (command.scrollOptions) {
          if (command.scrollOptions.x !== undefined && typeof command.scrollOptions.x !== 'number') {
            throw new Error('scroll x 값은 숫자여야 합니다.');
          }
          if (command.scrollOptions.y !== undefined && typeof command.scrollOptions.y !== 'number') {
            throw new Error('scroll y 값은 숫자여야 합니다.');
          }
          if (command.scrollOptions.behavior && 
              !['auto', 'smooth'].includes(command.scrollOptions.behavior)) {
            throw new Error('scroll behavior는 auto 또는 smooth여야 합니다.');
          }
        }
        break;

      case 'wait':
        if (command.selector && typeof command.selector !== 'string') {
          throw new Error('wait 명령어의 selector는 문자열이어야 합니다.');
        }
        if (command.selector) {
          this.validateSelector(command.selector);
        }
        if (command.waitCondition && 
            !['visible', 'hidden', 'stable', 'networkidle'].includes(command.waitCondition)) {
          throw new Error('wait 조건은 visible, hidden, stable, networkidle 중 하나여야 합니다.');
        }
        break;

      case 'extract':
        if (!command.selector || typeof command.selector !== 'string') {
          throw new Error('extract 명령어에는 selector가 필요합니다.');
        }
        this.validateSelector(command.selector);
        if (command.options && command.options.attribute && typeof command.options.attribute !== 'string') {
          throw new Error('extract 명령어의 attribute는 문자열이어야 합니다.');
        }
        break;

      case 'evaluate':
        if (!command.options || !command.options.script || typeof command.options.script !== 'string') {
          throw new Error('evaluate 명령어에는 script가 필요합니다.');
        }
        this.validateScript(command.options.script);
        break;

      default:
        throw new Error(`알 수 없는 명령어 타입입니다: ${commandType}`);
    }
  }

  /**
   * URL을 검증합니다.
   * 
   * @param url 검증할 URL
   * @throws {Error} 유효하지 않은 URL인 경우
   */
  public static validateUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('URL은 문자열이어야 합니다.');
    }

    if (url.length > this.MAX_URL_LENGTH) {
      throw new Error(`URL이 너무 깁니다. 최대 ${this.MAX_URL_LENGTH}자까지 허용됩니다.`);
    }

    try {
      const urlObj = new URL(url);
      
      if (!this.SAFE_URL_PROTOCOLS.includes(urlObj.protocol)) {
        throw new Error(`안전하지 않은 프로토콜입니다: ${urlObj.protocol}`);
      }

      // 로컬 파일 시스템 접근 차단
      if (urlObj.protocol === 'file:' && urlObj.pathname.includes('..')) {
        throw new Error('상위 디렉토리 접근이 차단되었습니다.');
      }

      // 위험한 호스트 차단
      const dangerousHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (dangerousHosts.includes(urlObj.hostname)) {
        throw new Error('로컬 호스트 접근이 차단되었습니다.');
      }

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`유효하지 않은 URL입니다: ${error.message}`);
      }
      throw new Error('유효하지 않은 URL입니다.');
    }
  }

  /**
   * CSS 선택자를 검증합니다.
   * 
   * @param selector 검증할 CSS 선택자
   * @throws {Error} 유효하지 않은 선택자인 경우
   */
  public static validateSelector(selector: string): void {
    if (!selector || typeof selector !== 'string') {
      throw new Error('선택자는 문자열이어야 합니다.');
    }

    if (selector.length > this.MAX_SELECTOR_LENGTH) {
      throw new Error(`선택자가 너무 깁니다. 최대 ${this.MAX_SELECTOR_LENGTH}자까지 허용됩니다.`);
    }

    // 위험한 패턴 검사
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(selector)) {
        throw new Error('위험한 패턴이 감지되었습니다.');
      }
    }

    // 기본적인 CSS 선택자 문법 검사
    const dangerousSelectors = [
      'script',
      'object',
      'embed',
      'iframe',
      'frame',
      'frameset',
      'applet',
      'link[rel="import"]',
      'style',
      'meta[http-equiv]'
    ];

    for (const dangerous of dangerousSelectors) {
      if (selector.toLowerCase().includes(dangerous)) {
        throw new Error('위험한 요소 선택자가 감지되었습니다.');
      }
    }
  }

  /**
   * 텍스트 입력을 검증합니다.
   * 
   * @param text 검증할 텍스트
   * @throws {Error} 유효하지 않은 텍스트인 경우
   */
  public static validateText(text: string): void {
    if (typeof text !== 'string') {
      throw new Error('텍스트는 문자열이어야 합니다.');
    }

    if (text.length > this.MAX_TEXT_LENGTH) {
      throw new Error(`텍스트가 너무 깁니다. 최대 ${this.MAX_TEXT_LENGTH}자까지 허용됩니다.`);
    }

    // 위험한 패턴 검사
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(text)) {
        throw new Error('위험한 패턴이 감지되었습니다.');
      }
    }
  }

  /**
   * JavaScript 스크립트를 검증합니다.
   * 
   * @param script 검증할 스크립트
   * @throws {Error} 유효하지 않은 스크립트인 경우
   */
  public static validateScript(script: string): void {
    if (!script || typeof script !== 'string') {
      throw new Error('스크립트는 문자열이어야 합니다.');
    }

    if (script.length > this.MAX_SCRIPT_LENGTH) {
      throw new Error(`스크립트가 너무 깁니다. 최대 ${this.MAX_SCRIPT_LENGTH}자까지 허용됩니다.`);
    }

    // 위험한 패턴 검사
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(script)) {
        throw new Error('위험한 패턴이 감지되었습니다.');
      }
    }

    // 추가적인 스크립트 보안 검사
    const dangerousKeywords = [
      'require',
      'process',
      'global',
      '__dirname',
      '__filename',
      'Buffer',
      'module',
      'exports',
      'console.log',
      'console.error',
      'console.warn',
      'console.info',
      'console.debug',
      'console.trace',
      'console.table',
      'console.group',
      'console.groupEnd',
      'console.time',
      'console.timeEnd',
      'debugger',
      'while(true)',
      'for(;;)',
      'setInterval',
      'clearInterval',
      'clearTimeout'
    ];

    for (const keyword of dangerousKeywords) {
      if (script.toLowerCase().includes(keyword.toLowerCase())) {
        throw new Error(`위험한 키워드가 감지되었습니다: ${keyword}`);
      }
    }
  }

  /**
   * 문자열에서 HTML 태그를 제거합니다.
   * 
   * @param input 정리할 문자열
   * @returns 정리된 문자열
   */
  public static sanitizeHtml(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  /**
   * 입력값의 길이를 제한합니다.
   * 
   * @param input 제한할 입력값
   * @param maxLength 최대 길이
   * @returns 제한된 입력값
   */
  public static limitLength(input: string, maxLength: number = this.MAX_INPUT_LENGTH): string {
    if (typeof input !== 'string') {
      return '';
    }

    if (input.length <= maxLength) {
      return input;
    }

    return input.substring(0, maxLength);
  }

  /**
   * 입력값을 완전히 정리합니다.
   * 
   * @param input 정리할 입력값
   * @returns 정리된 입력값
   */
  public static sanitize(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    let cleaned = input;
    
    // HTML 태그 제거
    cleaned = this.sanitizeHtml(cleaned);
    
    // 길이 제한
    cleaned = this.limitLength(cleaned);
    
    // 위험한 패턴 제거
    for (const pattern of this.DANGEROUS_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    return cleaned.trim();
  }

  /**
   * 입력값이 안전한지 확인합니다.
   * 
   * @param input 검사할 입력값
   * @returns 안전한 경우 true, 그렇지 않으면 false
   */
  public static isSafe(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    if (input.length > this.MAX_INPUT_LENGTH) {
      return false;
    }

    // 위험한 패턴 검사
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return false;
      }
    }

    return true;
  }
} 