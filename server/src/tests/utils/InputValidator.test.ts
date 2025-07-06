import { InputValidator } from '../../utils/InputValidator';
import { BrowserCommand } from '../../types';

describe('InputValidator', () => {
  describe('validateBrowserCommand', () => {
    it('유효한 명령어를 검증해야 합니다', () => {
      const command: BrowserCommand = {
        action: 'navigate',
        url: 'https://example.com',
        timeout: 5000
      };

      expect(() => InputValidator.validateBrowserCommand(command)).not.toThrow();
    });

    it('명령어가 객체가 아닌 경우 에러를 발생시켜야 합니다', () => {
      expect(() => InputValidator.validateBrowserCommand(null as any)).toThrow('명령어는 객체여야 합니다.');
      expect(() => InputValidator.validateBrowserCommand(undefined as any)).toThrow('명령어는 객체여야 합니다.');
      expect(() => InputValidator.validateBrowserCommand('invalid' as any)).toThrow('명령어는 객체여야 합니다.');
    });

    it('액션이 없는 경우 에러를 발생시켜야 합니다', () => {
      const command = {} as BrowserCommand;
      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('명령어 액션은 필수이며 문자열이어야 합니다.');
    });

    it('지원되지 않는 액션인 경우 에러를 발생시켜야 합니다', () => {
      const command = { action: 'invalid' } as unknown as BrowserCommand;
      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('지원되지 않는 명령어 액션입니다: invalid');
    });

    it('타임아웃이 범위를 벗어난 경우 에러를 발생시켜야 합니다', () => {
      const command: BrowserCommand = {
        action: 'navigate',
        url: 'https://example.com',
        timeout: 400000 // 300초 초과
      };

      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('타임아웃은 0-300000ms 범위의 숫자여야 합니다.');
    });

    it('navigate 명령어에 URL이 없는 경우 에러를 발생시켜야 합니다', () => {
      const command: BrowserCommand = {
        action: 'navigate'
      };

      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('navigate 명령어에는 url이 필요합니다.');
    });

    it('click 명령어에 selector가 없는 경우 에러를 발생시켜야 합니다', () => {
      const command: BrowserCommand = {
        action: 'click'
      };

      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('click 명령어에는 selector가 필요합니다.');
    });

    it('type 명령어에 selector 또는 value가 없는 경우 에러를 발생시켜야 합니다', () => {
      const command1: BrowserCommand = {
        action: 'type'
      };

      const command2: BrowserCommand = {
        action: 'type',
        selector: '#input'
      };

      expect(() => InputValidator.validateBrowserCommand(command1)).toThrow('type 명령어에는 selector가 필요합니다.');
      expect(() => InputValidator.validateBrowserCommand(command2)).toThrow('type 명령어에는 value가 필요합니다.');
    });

    it('evaluate 명령어에 script가 없는 경우 에러를 발생시켜야 합니다', () => {
      const command: BrowserCommand = {
        action: 'evaluate'
      };

      expect(() => InputValidator.validateBrowserCommand(command)).toThrow('evaluate 명령어에는 script가 필요합니다.');
    });
  });

  describe('validateUrl', () => {
    it('유효한 URL을 검증해야 합니다', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'https://subdomain.example.com/path?query=value',
        'data:text/html,<h1>Hello</h1>'
      ];

      validUrls.forEach(url => {
        expect(() => InputValidator.validateUrl(url)).not.toThrow();
      });
    });

    it('유효하지 않은 URL인 경우 에러를 발생시켜야 합니다', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      invalidUrls.forEach(url => {
        expect(() => InputValidator.validateUrl(url)).toThrow();
      });
    });

    it('너무 긴 URL인 경우 에러를 발생시켜야 합니다', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      expect(() => InputValidator.validateUrl(longUrl)).toThrow('URL이 너무 깁니다.');
    });

    it('로컬 호스트 접근을 차단해야 합니다', () => {
      const localUrls = [
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://0.0.0.0:8000'
      ];

      localUrls.forEach(url => {
        expect(() => InputValidator.validateUrl(url)).toThrow('로컬 호스트 접근이 차단되었습니다.');
      });
    });

    it('파일 경로 탐색을 차단해야 합니다', () => {
      const traversalUrls = [
        'file:///etc/../passwd',
        'file:///../../../etc/passwd'
      ];

      traversalUrls.forEach(url => {
        expect(() => InputValidator.validateUrl(url)).toThrow('상위 디렉토리 접근이 차단되었습니다.');
      });
    });
  });

  describe('validateSelector', () => {
    it('유효한 CSS 선택자를 검증해야 합니다', () => {
      const validSelectors = [
        '#id',
        '.class',
        'div',
        'input[type="text"]',
        '.parent > .child',
        'div.class#id'
      ];

      validSelectors.forEach(selector => {
        expect(() => InputValidator.validateSelector(selector)).not.toThrow();
      });
    });

    it('유효하지 않은 선택자인 경우 에러를 발생시켜야 합니다', () => {
      expect(() => InputValidator.validateSelector('')).toThrow('선택자는 문자열이어야 합니다.');
      expect(() => InputValidator.validateSelector(null as any)).toThrow('선택자는 문자열이어야 합니다.');
    });

    it('너무 긴 선택자인 경우 에러를 발생시켜야 합니다', () => {
      const longSelector = 'div'.repeat(400);
      expect(() => InputValidator.validateSelector(longSelector)).toThrow('선택자가 너무 깁니다.');
    });

    it('위험한 선택자를 차단해야 합니다', () => {
      const dangerousSelectors = [
        'script',
        'object[data="malicious"]',
        'embed[src="evil"]',
        'iframe[src="danger"]'
      ];

      dangerousSelectors.forEach(selector => {
        expect(() => InputValidator.validateSelector(selector)).toThrow('위험한 요소 선택자가 감지되었습니다.');
      });
    });

    it('악성 스크립트 패턴을 차단해야 합니다', () => {
      const maliciousSelectors = [
        'div[onclick="alert(1)"]',
        'input[onload="javascript:alert(1)"]',
        'img[src="x" onerror="eval(\'alert(1)\')"]'
      ];

      maliciousSelectors.forEach(selector => {
        expect(() => InputValidator.validateSelector(selector)).toThrow('위험한 패턴이 감지되었습니다.');
      });
    });
  });

  describe('validateText', () => {
    it('유효한 텍스트를 검증해야 합니다', () => {
      const validTexts = [
        'Hello, World!',
        'This is a test message.',
        '한글 텍스트도 잘 작동합니다.',
        'Numbers: 123456',
        'Special chars: @#$%^&*()'
      ];

      validTexts.forEach(text => {
        expect(() => InputValidator.validateText(text)).not.toThrow();
      });
    });

    it('유효하지 않은 텍스트인 경우 에러를 발생시켜야 합니다', () => {
      expect(() => InputValidator.validateText(null as any)).toThrow('텍스트는 문자열이어야 합니다.');
      expect(() => InputValidator.validateText(123 as any)).toThrow('텍스트는 문자열이어야 합니다.');
    });

    it('너무 긴 텍스트인 경우 에러를 발생시켜야 합니다', () => {
      const longText = 'A'.repeat(5100);
      expect(() => InputValidator.validateText(longText)).toThrow('텍스트가 너무 깁니다.');
    });

    it('악성 스크립트 패턴을 차단해야 합니다', () => {
      const maliciousTexts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onload="alert(1)"',
        'document.write("hack")'
      ];

      maliciousTexts.forEach(text => {
        expect(() => InputValidator.validateText(text)).toThrow('위험한 패턴이 감지되었습니다.');
      });
    });
  });

  describe('validateScript', () => {
    it('유효한 스크립트를 검증해야 합니다', () => {
      const validScripts = [
        'return document.title;',
        'return window.location.href;',
        'return document.querySelectorAll("div").length;',
        'return "Hello World";'
      ];

      validScripts.forEach(script => {
        expect(() => InputValidator.validateScript(script)).not.toThrow();
      });
    });

    it('유효하지 않은 스크립트인 경우 에러를 발생시켜야 합니다', () => {
      expect(() => InputValidator.validateScript('')).toThrow('스크립트는 문자열이어야 합니다.');
      expect(() => InputValidator.validateScript(null as any)).toThrow('스크립트는 문자열이어야 합니다.');
    });

    it('너무 긴 스크립트인 경우 에러를 발생시켜야 합니다', () => {
      const longScript = 'return "A";'.repeat(1000);
      expect(() => InputValidator.validateScript(longScript)).toThrow('스크립트가 너무 깁니다.');
    });

    it('위험한 스크립트 패턴을 차단해야 합니다', () => {
      const dangerousScripts = [
        'eval("alert(1)")',
        'Function("return alert(1)")()',
        'setTimeout("alert(1)", 0)',
        'require("fs").readFileSync("/etc/passwd")',
        'process.exit(1)',
        'while(true) { console.log("infinite loop"); }'
      ];

      dangerousScripts.forEach(script => {
        expect(() => InputValidator.validateScript(script)).toThrow();
      });
    });
  });

  describe('sanitizeHtml', () => {
    it('HTML 태그를 제거해야 합니다', () => {
      const htmlString = '<div>Hello <span>World</span></div>';
      const sanitized = InputValidator.sanitizeHtml(htmlString);
      expect(sanitized).toBe('Hello World');
    });

    it('HTML 엔티티를 디코딩해야 합니다', () => {
      const encodedString = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      const sanitized = InputValidator.sanitizeHtml(encodedString);
      expect(sanitized).toBe('<script>alert("xss")</script>');
    });

    it('빈 문자열을 반환해야 합니다 (null/undefined 입력)', () => {
      expect(InputValidator.sanitizeHtml(null as any)).toBe('');
      expect(InputValidator.sanitizeHtml(undefined as any)).toBe('');
    });
  });

  describe('limitLength', () => {
    it('길이를 제한해야 합니다', () => {
      const longString = 'A'.repeat(200);
      const limited = InputValidator.limitLength(longString, 100);
      expect(limited).toHaveLength(100);
    });

    it('짧은 문자열은 그대로 반환해야 합니다', () => {
      const shortString = 'Hello';
      const limited = InputValidator.limitLength(shortString, 100);
      expect(limited).toBe(shortString);
    });

    it('유효하지 않은 입력에 대해 빈 문자열을 반환해야 합니다', () => {
      expect(InputValidator.limitLength(null as any)).toBe('');
      expect(InputValidator.limitLength(123 as any)).toBe('');
    });
  });

  describe('sanitize', () => {
    it('입력값을 완전히 정리해야 합니다', () => {
      const maliciousInput = '<script>alert("xss")</script><div>Hello World</div>';
      const sanitized = InputValidator.sanitize(maliciousInput);
      expect(sanitized).toBe('Hello World');
    });

    it('긴 입력값을 잘라내야 합니다', () => {
      const longInput = '<p>' + 'A'.repeat(20000) + '</p>';
      const sanitized = InputValidator.sanitize(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('isSafe', () => {
    it('안전한 입력값에 대해 true를 반환해야 합니다', () => {
      const safeInputs = [
        'Hello World',
        'This is a safe message',
        '안전한 한글 메시지',
        'Numbers: 123456'
      ];

      safeInputs.forEach(input => {
        expect(InputValidator.isSafe(input)).toBe(true);
      });
    });

    it('위험한 입력값에 대해 false를 반환해야 합니다', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'eval("malicious code")',
        'document.write("hack")'
      ];

      dangerousInputs.forEach(input => {
        expect(InputValidator.isSafe(input)).toBe(false);
      });
    });

    it('너무 긴 입력값에 대해 false를 반환해야 합니다', () => {
      const longInput = 'A'.repeat(15000);
      expect(InputValidator.isSafe(longInput)).toBe(false);
    });

    it('유효하지 않은 타입에 대해 false를 반환해야 합니다', () => {
      expect(InputValidator.isSafe(null as any)).toBe(false);
      expect(InputValidator.isSafe(undefined as any)).toBe(false);
      expect(InputValidator.isSafe(123 as any)).toBe(false);
    });
  });
}); 