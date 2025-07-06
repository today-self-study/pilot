/**
 * 보안 관련 기능을 담당하는 클래스
 * XSS 방지, CSP 관리, 악성 스크립트 탐지 등을 수행
 */
export class SecurityManager {
  private static readonly BLOCKED_DOMAINS = [
    'malware.com',
    'phishing.com',
    'suspicious.net',
    'malicious.org',
    'dangerous.io',
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    // 악성 스크립트 패턴
    /<script[^>]*src\s*=\s*["'][^"']*malware/gi,
    /<script[^>]*>.*?(bitcoin|cryptocurrency|mining|wallet)/gi,
    /<script[^>]*>.*?(steal|password|credential|login)/gi,
    /<script[^>]*>.*?(document\.cookie|localStorage|sessionStorage)/gi,
    /<script[^>]*>.*?(eval|Function|setTimeout|setInterval)/gi,
    
    // 피싱 패턴
    /paypal.*login.*secure/gi,
    /bank.*verify.*account/gi,
    /urgent.*action.*required/gi,
    /suspended.*account.*click/gi,
    /winner.*prize.*claim/gi,
    
    // 데이터 유출 패턴
    /send.*data.*remote/gi,
    /upload.*file.*server/gi,
    /exfiltrate.*information/gi,
    /collect.*personal.*data/gi,
    
    // 브라우저 익스플로잇 패턴
    /buffer.*overflow/gi,
    /heap.*spray/gi,
    /rop.*chain/gi,
    /shellcode/gi,
    /exploit.*kit/gi,
    
    // 사회공학 패턴
    /download.*now.*urgent/gi,
    /limited.*time.*offer/gi,
    /congratulations.*selected/gi,
    /security.*alert.*immediate/gi,
    /verify.*identity.*click/gi
  ];

  private static readonly DANGEROUS_SCRIPTS = [
    // 파일 시스템 접근
    'require("fs")',
    'require("path")',
    'require("child_process")',
    'require("os")',
    'require("util")',
    'require("crypto")',
    'require("net")',
    'require("http")',
    'require("https")',
    'require("url")',
    'require("querystring")',
    'require("stream")',
    'require("buffer")',
    'require("events")',
    'require("cluster")',
    'require("worker_threads")',
    'require("dgram")',
    'require("dns")',
    'require("tls")',
    'require("readline")',
    'require("repl")',
    'require("vm")',
    'require("v8")',
    'require("perf_hooks")',
    'require("inspector")',
    'require("async_hooks")',
    'require("zlib")',
    'require("timers")',
    'require("string_decoder")',
    'require("punycode")',
    'require("module")',
    'require("console")',
    'require("assert")',
    'require("constants")',
    'require("domain")',
    'require("tty")',
    'require("wasi")',
    'require("trace_events")',
    'require("process")',
    'require("global")',
    
    // 브라우저 위험 API
    'navigator.sendBeacon',
    'navigator.share',
    'navigator.clipboard',
    'navigator.credentials',
    'navigator.mediaDevices',
    'navigator.serviceWorker',
    'navigator.storage',
    'navigator.permissions',
    'navigator.usb',
    'navigator.bluetooth',
    'navigator.geolocation',
    'navigator.getUserMedia',
    'navigator.webkitGetUserMedia',
    'navigator.mozGetUserMedia',
    'navigator.msGetUserMedia',
    
    // 위험한 전역 객체
    'indexedDB',
    'webkitIndexedDB',
    'mozIndexedDB',
    'msIndexedDB',
    'openDatabase',
    'webkitRequestFileSystem',
    'webkitResolveLocalFileSystemURL',
    'requestFileSystem',
    'resolveLocalFileSystemURL',
    
    // 네트워크 관련
    'XMLHttpRequest',
    'ActiveXObject',
    'fetch(',
    'WebSocket',
    'EventSource',
    'WebRTC',
    'RTCPeerConnection',
    'webkitRTCPeerConnection',
    'mozRTCPeerConnection',
    'msRTCPeerConnection',
    
    // 코드 실행
    'eval(',
    'Function(',
    'setTimeout(',
    'setInterval(',
    'setImmediate(',
    'requestAnimationFrame(',
    'requestIdleCallback(',
    'createImageBitmap(',
    'postMessage(',
    'importScripts(',
    'Worker(',
    'SharedWorker(',
    'ServiceWorker(',
    'BroadcastChannel(',
    'MessageChannel(',
    'MessagePort(',
    
    // DOM 조작
    'document.write(',
    'document.writeln(',
    'document.open(',
    'document.close(',
    'document.execCommand(',
    'document.adoptNode(',
    'document.importNode(',
    'document.createRange(',
    'document.createNodeIterator(',
    'document.createTreeWalker(',
    'document.evaluate(',
    'document.createExpression(',
    'document.createNSResolver(',
    '.innerHTML',
    '.outerHTML',
    '.insertAdjacentHTML(',
    '.insertAdjacentElement(',
    '.insertAdjacentText(',
    '.createContextualFragment(',
    
    // 이벤트 조작
    'addEventListener',
    'removeEventListener',
    'dispatchEvent',
    'createEvent',
    'initEvent',
    'fireEvent',
    'attachEvent',
    'detachEvent',
    
    // 히스토리 조작
    'history.pushState',
    'history.replaceState',
    'history.back',
    'history.forward',
    'history.go',
    
    // 위치 조작
    'location.href',
    'location.assign',
    'location.replace',
    'location.reload',
    'window.open',
    'window.close',
    'window.focus',
    'window.blur',
    'window.moveBy',
    'window.moveTo',
    'window.resizeBy',
    'window.resizeTo',
    'window.scroll',
    'window.scrollBy',
    'window.scrollTo',
    'window.print',
    'window.stop',
    'window.alert',
    'window.confirm',
    'window.prompt',
    'window.showModalDialog',
    'window.showOpenFilePicker',
    'window.showSaveFilePicker',
    'window.showDirectoryPicker',
    
    // 스토리지 조작
    'localStorage',
    'sessionStorage',
    'globalStorage',
    'userData',
    'cookieStore',
    'caches',
    'applicationCache',
    
    // 미디어 접근
    'MediaSource',
    'MediaStream',
    'MediaRecorder',
    'MediaDevices',
    'MediaStreamTrack',
    'AudioContext',
    'webkitAudioContext',
    'mozAudioContext',
    'msAudioContext',
    
    // 암호화
    'crypto.subtle',
    'crypto.getRandomValues',
    'crypto.randomUUID',
    'msCrypto',
    'webkitCrypto',
    'mozCrypto',
    
    // 디바이스 접근
    'DeviceMotionEvent',
    'DeviceOrientationEvent',
    'BatteryManager',
    'GamepadEvent',
    'VRDisplay',
    'VRDisplayEvent',
    'VRFrameData',
    'VRPose',
    'VRStageParameters',
    'VRDeviceInfo',
    'VRDevice',
    'VRDisplayCapabilities',
    'VRFieldOfView',
    'VREyeParameters',
    'VRLayer',
    'VRSource',
    'VRSubmitFrameResult',
    'VRPresentationState',
    'VRTeleportationRequest',
    'VRPerformanceStats',
    'VRDisplayMode',
    'VRDisplayPose',
    'VRDisplayPresentation',
    'VRDisplayPresentationContext',
    'VRDisplayRenderingContext',
    'VRDisplayCommandBuffer',
    'VRDisplayFramebuffer',
    'VRDisplayTexture',
    'VRDisplayBuffer',
    'VRDisplaySubmission',
    'VRDisplayConfiguration',
    'VRDisplayPreferences',
    'VRDisplaySessionConfiguration',
    'VRDisplaySession',
    'VRDisplaySessionContext',
    'VRDisplaySessionManager',
    'VRDisplayController',
    'VRDisplayControllerManager',
    'VRDisplayInput',
    'VRDisplayInputManager',
    'VRDisplayOutput',
    'VRDisplayOutputManager',
    'VRDisplayAudio',
    'VRDisplayAudioManager',
    'VRDisplayVideo',
    'VRDisplayVideoManager',
    'VRDisplayCamera',
    'VRDisplayCameraManager',
    'VRDisplaySensor',
    'VRDisplaySensorManager',
    'VRDisplayTracking',
    'VRDisplayTrackingManager',
    'VRDisplayCalibration',
    'VRDisplayCalibrationManager',
    'VRDisplaySettings',
    'VRDisplaySettingsManager',
    'VRDisplayProfile',
    'VRDisplayProfileManager',
    'VRDisplayUpdate',
    'VRDisplayUpdateManager',
    'VRDisplayEvent',
    'VRDisplayEventManager',
    'VRDisplayNotification',
    'VRDisplayNotificationManager',
    'VRDisplayAlert',
    'VRDisplayAlertManager',
    'VRDisplayWarning',
    'VRDisplayWarningManager',
    'VRDisplayError',
    'VRDisplayErrorManager',
    'VRDisplayDebug',
    'VRDisplayDebugManager',
    'VRDisplayLog',
    'VRDisplayLogManager',
    'VRDisplayMetrics',
    'VRDisplayMetricsManager',
    'VRDisplayAnalytics',
    'VRDisplayAnalyticsManager',
    'VRDisplayTelemetry',
    'VRDisplayTelemetryManager'
  ];

  private static requestCount = new Map<string, number>();
  private static lastRequestTime = new Map<string, number>();
  private static blockedIPs = new Set<string>();
  private static suspiciousActivities = new Map<string, number>();

  /**
   * URL이 안전한지 확인합니다.
   * 
   * @param url 확인할 URL
   * @returns 안전한 경우 true, 그렇지 않으면 false
   */
  public static isUrlSafe(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // 차단된 도메인 검사
      for (const blockedDomain of this.BLOCKED_DOMAINS) {
        if (urlObj.hostname.includes(blockedDomain) || 
            urlObj.hostname === blockedDomain) {
          return false;
        }
      }
      
      // 프로토콜 검사
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // 포트 검사 (일반적이지 않은 포트 차단)
      const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
      const dangerousPorts = ['21', '22', '23', '25', '53', '110', '143', '993', '995', '1433', '3306', '3389', '5432', '5984', '6379', '8080', '8443', '9200', '27017'];
      if (dangerousPorts.includes(port)) {
        return false;
      }
      
      // 의심스러운 경로 검사
      const suspiciousPaths = [
        '/admin', '/login', '/password', '/secure', '/auth', '/api/v1', '/api/v2', 
        '/wp-admin', '/wp-login', '/phpmyadmin', '/cpanel', '/webmail', '/mysql',
        '/postgres', '/oracle', '/mssql', '/mongodb', '/redis', '/elasticsearch',
        '/kibana', '/grafana', '/prometheus', '/jenkins', '/gitlab', '/github',
        '/bitbucket', '/jira', '/confluence', '/bamboo', '/fisheye', '/crucible',
        '/stash', '/sourcetree', '/tower', '/smartgit', '/gitkraken', '/sublime',
        '/vscode', '/atom', '/brackets', '/notepad', '/textmate', '/emacs',
        '/vim', '/nano', '/gedit', '/kate', '/kwrite', '/leafpad', '/mousepad',
        '/pluma', '/geany', '/codeblocks', '/dev-cpp', '/quincy', '/bloodshed',
        '/turbo', '/borland', '/microsoft', '/visual', '/studio', '/code',
        '/intellij', '/idea', '/pycharm', '/webstorm', '/phpstorm', '/rubymine',
        '/appcode', '/clion', '/datagrip', '/rider', '/goland', '/android',
        '/xcode', '/netbeans', '/eclipse', '/aptana', '/komodo', '/zend',
        '/phpdesigner', '/rapidphp', '/codelobster', '/phpstorm', '/phped'
      ];
      
      for (const suspiciousPath of suspiciousPaths) {
        if (urlObj.pathname.toLowerCase().includes(suspiciousPath)) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 콘텐츠가 의심스러운지 확인합니다.
   * 
   * @param content 확인할 콘텐츠
   * @returns 의심스러운 경우 true, 그렇지 않으면 false
   */
  public static isSuspiciousContent(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }
    
    // 의심스러운 패턴 검사
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }
    
    // 너무 많은 스크립트 태그
    const scriptMatches = content.match(/<script[^>]*>/gi);
    if (scriptMatches && scriptMatches.length > 10) {
      return true;
    }
    
    // 너무 많은 외부 리소스 참조
    const externalMatches = content.match(/src\s*=\s*["']https?:\/\/[^"']+["']/gi);
    if (externalMatches && externalMatches.length > 50) {
      return true;
    }
    
    // 의심스러운 키워드 밀도 검사
    const suspiciousKeywords = [
      'malware', 'virus', 'trojan', 'keylogger', 'backdoor', 'rootkit',
      'spyware', 'adware', 'ransomware', 'botnet', 'zombie', 'worm',
      'phishing', 'scam', 'fraud', 'steal', 'hack', 'crack', 'exploit',
      'bitcoin', 'cryptocurrency', 'mining', 'wallet', 'blockchain',
      'password', 'credential', 'login', 'auth', 'token', 'session',
      'cookie', 'localStorage', 'sessionStorage', 'indexedDB'
    ];
    
    let suspiciousKeywordCount = 0;
    for (const keyword of suspiciousKeywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = content.match(regex);
      if (matches) {
        suspiciousKeywordCount += matches.length;
      }
    }
    
    // 의심스러운 키워드가 너무 많은 경우
    if (suspiciousKeywordCount > 20) {
      return true;
    }
    
    return false;
  }

  /**
   * 스크립트가 위험한지 확인합니다.
   * 
   * @param script 확인할 스크립트
   * @returns 위험한 경우 true, 그렇지 않으면 false
   */
  public static isDangerousScript(script: string): boolean {
    if (!script || typeof script !== 'string') {
      return false;
    }
    
    // 위험한 스크립트 패턴 검사
    for (const dangerousScript of this.DANGEROUS_SCRIPTS) {
      if (script.includes(dangerousScript)) {
        return true;
      }
    }
    
    // 난독화된 스크립트 검사
    const obfuscationIndicators = [
      /\\x[0-9a-fA-F]{2}/g,  // 헥사 인코딩
      /\\u[0-9a-fA-F]{4}/g,  // 유니코드 인코딩
      /String\.fromCharCode/g,  // 문자 코드 변환
      /parseInt\s*\(\s*['"]\d+['"]\s*,\s*\d+\s*\)/g,  // 진법 변환
      /atob\s*\(/g,  // Base64 디코딩
      /btoa\s*\(/g,  // Base64 인코딩
      /decodeURI\s*\(/g,  // URI 디코딩
      /decodeURIComponent\s*\(/g,  // URI 컴포넌트 디코딩
      /encodeURI\s*\(/g,  // URI 인코딩
      /encodeURIComponent\s*\(/g,  // URI 컴포넌트 인코딩
      /escape\s*\(/g,  // 이스케이프
      /unescape\s*\(/g,  // 언이스케이프
    ];
    
    let obfuscationCount = 0;
    for (const indicator of obfuscationIndicators) {
      const matches = script.match(indicator);
      if (matches) {
        obfuscationCount += matches.length;
      }
    }
    
    // 난독화 지시자가 너무 많은 경우
    if (obfuscationCount > 10) {
      return true;
    }
    
    // 의심스러운 함수 호출 패턴
    const suspiciousPatterns = [
      /\[\s*['"]\w+['"]\s*\]\s*\(/g,  // 배열 인덱스로 함수 호출
      /\w+\[\s*['"]\w+['"]\s*\]\s*\(/g,  // 객체 속성으로 함수 호출
      /\(\s*function\s*\(\s*\)\s*\{[\s\S]*?\}\s*\)\s*\(\s*\)/g,  // 즉시 실행 함수
      /new\s+Function\s*\(/g,  // 동적 함수 생성
      /setTimeout\s*\(\s*['"]/g,  // 문자열로 setTimeout
      /setInterval\s*\(\s*['"]/g,  // 문자열로 setInterval
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(script)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 요청 제한을 확인합니다.
   * 
   * @param clientId 클라이언트 식별자
   * @param maxRequests 최대 요청 수
   * @param windowMs 시간 창 (밀리초)
   * @returns 요청이 허용되는 경우 true, 그렇지 않으면 false
   */
  public static checkRateLimit(clientId: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(clientId) || 0;
    const requestCount = this.requestCount.get(clientId) || 0;
    
    // 시간 창이 지난 경우 리셋
    if (now - lastRequest > windowMs) {
      this.requestCount.set(clientId, 1);
      this.lastRequestTime.set(clientId, now);
      return true;
    }
    
    // 요청 수 증가
    this.requestCount.set(clientId, requestCount + 1);
    this.lastRequestTime.set(clientId, now);
    
    // 제한 확인
    if (requestCount >= maxRequests) {
      this.addSuspiciousActivity(clientId);
      return false;
    }
    
    return true;
  }

  /**
   * IP를 차단합니다.
   * 
   * @param ip 차단할 IP 주소
   */
  public static blockIP(ip: string): void {
    this.blockedIPs.add(ip);
  }

  /**
   * IP 차단을 해제합니다.
   * 
   * @param ip 차단 해제할 IP 주소
   */
  public static unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
  }

  /**
   * IP가 차단되었는지 확인합니다.
   * 
   * @param ip 확인할 IP 주소
   * @returns 차단된 경우 true, 그렇지 않으면 false
   */
  public static isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * 의심스러운 활동을 추가합니다.
   * 
   * @param clientId 클라이언트 식별자
   */
  public static addSuspiciousActivity(clientId: string): void {
    const count = this.suspiciousActivities.get(clientId) || 0;
    this.suspiciousActivities.set(clientId, count + 1);
    
    // 의심스러운 활동이 너무 많은 경우 IP 차단
    if (count >= 10) {
      this.blockIP(clientId);
    }
  }

  /**
   * 의심스러운 활동 수를 가져옵니다.
   * 
   * @param clientId 클라이언트 식별자
   * @returns 의심스러운 활동 수
   */
  public static getSuspiciousActivityCount(clientId: string): number {
    return this.suspiciousActivities.get(clientId) || 0;
  }

  /**
   * 보안 헤더를 생성합니다.
   * 
   * @returns 보안 헤더 객체
   */
  public static generateSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "child-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; '),
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': [
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()',
        'bluetooth=()',
        'midi=()',
        'notifications=()',
        'push=()',
        'sync-xhr=()',
        'vibrate=()',
        'fullscreen=()',
        'encrypted-media=()',
        'picture-in-picture=()',
        'display-capture=()',
        'web-share=()',
        'execution-while-not-rendered=()',
        'execution-while-out-of-viewport=()',
        'publickey-credentials-get=()',
        'storage-access=()',
        'clipboard-read=()',
        'clipboard-write=()',
        'gamepad=()',
        'hid=()',
        'idle-detection=()',
        'serial=()',
        'screen-wake-lock=()',
        'window-placement=()',
        'local-fonts=()',
        'document-domain=()',
        'cross-origin-isolated=()',
        'focus-without-user-activation=()',
        'autoplay=()',
        'battery=()',
        'camera-pan-tilt-zoom=()',
        'compute-pressure=()',
        'conversion-measurement=()',
        'display-capture=()',
        'document-domain=()',
        'encrypted-media=()',
        'execution-while-not-rendered=()',
        'execution-while-out-of-viewport=()',
        'focus-without-user-activation=()',
        'fullscreen=()',
        'gamepad=()',
        'geolocation=()',
        'gyroscope=()',
        'hid=()',
        'idle-detection=()',
        'keyboard-map=()',
        'local-fonts=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'navigation-override=()',
        'notifications=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=()',
        'screen-wake-lock=()',
        'serial=()',
        'speaker-selection=()',
        'storage-access=()',
        'sync-xhr=()',
        'usb=()',
        'web-share=()',
        'window-placement=()',
        'xr-spatial-tracking=()'
      ].join(', ')
    };
  }

  /**
   * 보안 통계를 가져옵니다.
   * 
   * @returns 보안 통계 객체
   */
  public static getSecurityStats(): {
    blockedIPs: number;
    totalRequests: number;
    suspiciousActivities: number;
    rateLimitViolations: number;
  } {
    const totalRequests = Array.from(this.requestCount.values()).reduce((sum, count) => sum + count, 0);
    const suspiciousActivities = Array.from(this.suspiciousActivities.values()).reduce((sum, count) => sum + count, 0);
    const rateLimitViolations = Array.from(this.requestCount.values()).filter(count => count >= 100).length;
    
    return {
      blockedIPs: this.blockedIPs.size,
      totalRequests,
      suspiciousActivities,
      rateLimitViolations
    };
  }

  /**
   * 보안 상태를 초기화합니다.
   */
  public static reset(): void {
    this.requestCount.clear();
    this.lastRequestTime.clear();
    this.blockedIPs.clear();
    this.suspiciousActivities.clear();
  }
} 