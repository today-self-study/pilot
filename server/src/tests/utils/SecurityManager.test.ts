import { SecurityManager } from '../../utils/SecurityManager';

describe('SecurityManager', () => {
  beforeEach(() => {
    SecurityManager.reset();
  });

  describe('isUrlSafe', () => {
    it('안전한 URL에 대해 true를 반환해야 합니다', () => {
      const safeUrls = [
        'https://google.com',
        'http://example.org',
        'https://subdomain.test.com/path?query=value',
        'https://api.service.com/v1/data'
      ];

      safeUrls.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(true);
      });
    });

    it('차단된 도메인에 대해 false를 반환해야 합니다', () => {
      const blockedUrls = [
        'http://malware.com',
        'https://localhost:3000',
        'http://127.0.0.1:8080',
        'https://0.0.0.0:3000'
      ];

      blockedUrls.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(false);
      });
    });

    it('안전하지 않은 프로토콜에 대해 false를 반환해야 합니다', () => {
      const unsafeUrls = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert("xss")',
        'data:text/html,<script>alert(1)</script>'
      ];

      unsafeUrls.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(false);
      });
    });

    it('위험한 포트에 대해 false를 반환해야 합니다', () => {
      const dangerousPorts = [
        'http://example.com:22', // SSH
        'http://example.com:3389', // RDP
        'http://example.com:3306', // MySQL
        'http://example.com:5432' // PostgreSQL
      ];

      dangerousPorts.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(false);
      });
    });

    it('의심스러운 경로에 대해 false를 반환해야 합니다', () => {
      const suspiciousPaths = [
        'http://example.com/admin',
        'http://example.com/wp-admin',
        'http://example.com/phpmyadmin',
        'http://example.com/cpanel'
      ];

      suspiciousPaths.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(false);
      });
    });

    it('유효하지 않은 URL에 대해 false를 반환해야 합니다', () => {
      const invalidUrls = [
        'not-a-url',
        '',
        'http://',
        'https://.'
      ];

      invalidUrls.forEach(url => {
        expect(SecurityManager.isUrlSafe(url)).toBe(false);
      });
    });
  });

  describe('isSuspiciousContent', () => {
    it('안전한 콘텐츠에 대해 false를 반환해야 합니다', () => {
      const safeContent = [
        '<html><body><h1>Hello World</h1></body></html>',
        '<div>This is a normal webpage</div>',
        '<p>Some regular text content</p>',
        '일반적인 한글 내용입니다.'
      ];

      safeContent.forEach(content => {
        expect(SecurityManager.isSuspiciousContent(content)).toBe(false);
      });
    });

    it('의심스러운 패턴에 대해 true를 반환해야 합니다', () => {
      const suspiciousContent = [
        '<script>bitcoin mining code</script>',
        'paypal login secure verification',
        'urgent action required suspended account',
        'download now limited time offer',
        'congratulations you are selected winner'
      ];

      suspiciousContent.forEach(content => {
        expect(SecurityManager.isSuspiciousContent(content)).toBe(true);
      });
    });

    it('너무 많은 스크립트 태그에 대해 true를 반환해야 합니다', () => {
      const scriptHeavyContent = '<script></script>'.repeat(15);
      expect(SecurityManager.isSuspiciousContent(scriptHeavyContent)).toBe(true);
    });

    it('너무 많은 외부 리소스에 대해 true를 반환해야 합니다', () => {
      const externalHeavyContent = 'src="https://external.com/file"'.repeat(60);
      expect(SecurityManager.isSuspiciousContent(externalHeavyContent)).toBe(true);
    });

    it('의심스러운 키워드 밀도에 대해 true를 반환해야 합니다', () => {
      const malwareKeywords = 'malware virus trojan keylogger phishing scam fraud bitcoin password credential hack crack exploit '.repeat(5);
      expect(SecurityManager.isSuspiciousContent(malwareKeywords)).toBe(true);
    });

    it('유효하지 않은 입력에 대해 false를 반환해야 합니다', () => {
      expect(SecurityManager.isSuspiciousContent(null as any)).toBe(false);
      expect(SecurityManager.isSuspiciousContent(undefined as any)).toBe(false);
      expect(SecurityManager.isSuspiciousContent(123 as any)).toBe(false);
    });
  });

  describe('isDangerousScript', () => {
    it('안전한 스크립트에 대해 false를 반환해야 합니다', () => {
      const safeScripts = [
        'return document.title;',
        'return window.location.href;',
        'return document.querySelectorAll("div").length;',
        'var x = 5; return x * 2;'
      ];

      safeScripts.forEach(script => {
        expect(SecurityManager.isDangerousScript(script)).toBe(false);
      });
    });

    it('위험한 스크립트 패턴에 대해 true를 반환해야 합니다', () => {
      const dangerousScripts = [
        'require("fs")',
        'XMLHttpRequest',
        'eval("code")',
        'Function("return 1")',
        'setTimeout("code", 100)',
        'document.write("content")',
        'window.location = "evil.com"',
        'localStorage.getItem("data")',
        'navigator.sendBeacon("url", "data")'
      ];

      dangerousScripts.forEach(script => {
        expect(SecurityManager.isDangerousScript(script)).toBe(true);
      });
    });

    it('난독화된 스크립트에 대해 true를 반환해야 합니다', () => {
      const obfuscatedScripts = [
        '\\x61\\x6c\\x65\\x72\\x74\\x28\\x31\\x29',
        String.fromCharCode(97, 108, 101, 114, 116, 40, 49, 41).repeat(15),
        'parseInt("41", 16)'.repeat(15),
        'atob("encoded")'.repeat(15)
      ];

      obfuscatedScripts.forEach(script => {
        expect(SecurityManager.isDangerousScript(script)).toBe(true);
      });
    });

    it('의심스러운 함수 호출 패턴에 대해 true를 반환해야 합니다', () => {
      const suspiciousPatterns = [
        'window["eval"]("code")',
        'obj["dangerous"]("param")',
        '(function(){return "code";})();',
        'new Function("return alert(1)");'
      ];

      suspiciousPatterns.forEach(script => {
        expect(SecurityManager.isDangerousScript(script)).toBe(true);
      });
    });

    it('유효하지 않은 입력에 대해 false를 반환해야 합니다', () => {
      expect(SecurityManager.isDangerousScript(null as any)).toBe(false);
      expect(SecurityManager.isDangerousScript(undefined as any)).toBe(false);
      expect(SecurityManager.isDangerousScript(123 as any)).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    it('정상 범위 내 요청에 대해 true를 반환해야 합니다', () => {
      for (let i = 0; i < 50; i++) {
        expect(SecurityManager.checkRateLimit('client1', 100, 60000)).toBe(true);
      }
    });

    it('제한을 초과한 요청에 대해 false를 반환해야 합니다', () => {
      // 제한 수만큼 요청
      for (let i = 0; i < 100; i++) {
        SecurityManager.checkRateLimit('client2', 100, 60000);
      }
      
      // 제한 초과 요청
      expect(SecurityManager.checkRateLimit('client2', 100, 60000)).toBe(false);
    });

    it('시간 창이 지나면 카운터가 리셋되어야 합니다', (done) => {
      // 제한까지 요청
      for (let i = 0; i < 100; i++) {
        SecurityManager.checkRateLimit('client3', 100, 100);
      }
      
      // 제한 초과 확인
      expect(SecurityManager.checkRateLimit('client3', 100, 100)).toBe(false);
      
      // 시간 창 대기 후 다시 허용되는지 확인
      setTimeout(() => {
        expect(SecurityManager.checkRateLimit('client3', 100, 100)).toBe(true);
        done();
      }, 150);
    });

    it('다른 클라이언트 ID는 독립적으로 관리되어야 합니다', () => {
      // client4는 제한까지 요청
      for (let i = 0; i < 100; i++) {
        SecurityManager.checkRateLimit('client4', 100, 60000);
      }
      
      // client4는 제한 초과
      expect(SecurityManager.checkRateLimit('client4', 100, 60000)).toBe(false);
      
      // client5는 여전히 허용됨
      expect(SecurityManager.checkRateLimit('client5', 100, 60000)).toBe(true);
    });
  });

  describe('IP 차단 관리', () => {
    it('IP를 차단하고 확인할 수 있어야 합니다', () => {
      const testIP = '192.168.1.100';
      
      expect(SecurityManager.isIPBlocked(testIP)).toBe(false);
      
      SecurityManager.blockIP(testIP);
      expect(SecurityManager.isIPBlocked(testIP)).toBe(true);
      
      SecurityManager.unblockIP(testIP);
      expect(SecurityManager.isIPBlocked(testIP)).toBe(false);
    });

    it('여러 IP를 독립적으로 관리할 수 있어야 합니다', () => {
      const ip1 = '192.168.1.101';
      const ip2 = '192.168.1.102';
      
      SecurityManager.blockIP(ip1);
      
      expect(SecurityManager.isIPBlocked(ip1)).toBe(true);
      expect(SecurityManager.isIPBlocked(ip2)).toBe(false);
      
      SecurityManager.blockIP(ip2);
      
      expect(SecurityManager.isIPBlocked(ip1)).toBe(true);
      expect(SecurityManager.isIPBlocked(ip2)).toBe(true);
    });
  });

  describe('의심스러운 활동 관리', () => {
    it('의심스러운 활동을 추가하고 조회할 수 있어야 합니다', () => {
      const clientId = 'suspicious_client';
      
      expect(SecurityManager.getSuspiciousActivityCount(clientId)).toBe(0);
      
      SecurityManager.addSuspiciousActivity(clientId);
      expect(SecurityManager.getSuspiciousActivityCount(clientId)).toBe(1);
      
      SecurityManager.addSuspiciousActivity(clientId);
      expect(SecurityManager.getSuspiciousActivityCount(clientId)).toBe(2);
    });

    it('의심스러운 활동이 많으면 IP를 자동 차단해야 합니다', () => {
      const maliciousClient = 'malicious_client';
      
      // 10번의 의심스러운 활동 추가
      for (let i = 0; i < 10; i++) {
        SecurityManager.addSuspiciousActivity(maliciousClient);
      }
      
      // 11번째에서 IP 차단
      SecurityManager.addSuspiciousActivity(maliciousClient);
      
      expect(SecurityManager.isIPBlocked(maliciousClient)).toBe(true);
    });
  });

  describe('generateSecurityHeaders', () => {
    it('보안 헤더를 생성해야 합니다', () => {
      const headers = SecurityManager.generateSecurityHeaders();
      
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('CSP 헤더가 적절한 보안 정책을 포함해야 합니다', () => {
      const headers = SecurityManager.generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).toContain("upgrade-insecure-requests");
    });
  });

  describe('getSecurityStats', () => {
    it('보안 통계를 반환해야 합니다', () => {
      // 일부 활동 생성
      SecurityManager.blockIP('test1');
      SecurityManager.blockIP('test2');
      SecurityManager.addSuspiciousActivity('client1');
      SecurityManager.checkRateLimit('client2', 10, 60000);
      SecurityManager.checkRateLimit('client3', 10, 60000);
      
      const stats = SecurityManager.getSecurityStats();
      
      expect(stats).toHaveProperty('blockedIPs');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('suspiciousActivities');
      expect(stats).toHaveProperty('rateLimitViolations');
      
      expect(stats.blockedIPs).toBe(2);
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.suspiciousActivities).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('모든 보안 상태를 초기화해야 합니다', () => {
      // 일부 상태 생성
      SecurityManager.blockIP('test');
      SecurityManager.addSuspiciousActivity('client');
      SecurityManager.checkRateLimit('client', 10, 60000);
      
      // 리셋
      SecurityManager.reset();
      
      // 모든 상태가 초기화되었는지 확인
      expect(SecurityManager.isIPBlocked('test')).toBe(false);
      expect(SecurityManager.getSuspiciousActivityCount('client')).toBe(0);
      
      const stats = SecurityManager.getSecurityStats();
      expect(stats.blockedIPs).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.suspiciousActivities).toBe(0);
    });
  });
}); 