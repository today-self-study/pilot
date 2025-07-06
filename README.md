# AI Browser Controller

## 프로젝트 개요

AI Browser Controller는 자연어 명령을 통해 웹 브라우저를 자동으로 제어할 수 있는 혁신적인 서비스입니다. OpenAI GPT-4를 사용하여 사용자의 자연어 입력을 브라우저 명령어로 변환하고, Puppeteer를 통해 실제 브라우저 자동화를 수행합니다.

## 주요 기능

- 🤖 **AI 기반 명령어 파싱**: OpenAI GPT-4를 사용한 자연어 처리
- 🌐 **실시간 브라우저 제어**: Puppeteer 기반 브라우저 자동화
- 💬 **실시간 통신**: Socket.io를 통한 실시간 웹소켓 통신
- 🔒 **보안 중심 설계**: 다층 보안 시스템 및 입력 검증
- 📊 **성능 모니터링**: 실시간 성능 추적 및 메모리 관리
- 🎨 **모던 UI**: React + TypeScript + Tailwind CSS
- ♿ **접근성 지원**: ARIA 라벨 및 키보드 네비게이션

## 기술 스택

### Frontend
- **React 18** - 사용자 인터페이스
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **Socket.io Client** - 실시간 통신

### Backend
- **Node.js** - 서버 런타임
- **Express** - 웹 프레임워크
- **TypeScript** - 타입 안전성
- **Puppeteer** - 브라우저 자동화
- **Socket.io** - 실시간 통신
- **OpenAI API** - AI 명령어 파싱
- **Winston** - 구조화된 로깅

### Testing & Development
- **Jest** - 단위 테스트
- **ESLint** - 코드 품질
- **Prettier** - 코드 포맷팅
- **Nodemon** - 개발 환경 Hot-reload

## 프로젝트 구조

```
pilot/
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── hooks/         # 커스텀 훅
│   │   ├── types/         # TypeScript 타입 정의
│   │   └── utils/         # 유틸리티 함수
│   ├── public/            # 정적 파일
│   └── package.json
├── server/                # Node.js 백엔드
│   ├── src/
│   │   ├── services/      # 비즈니스 로직 서비스
│   │   ├── controllers/   # 컨트롤러
│   │   ├── utils/         # 유틸리티 클래스
│   │   ├── types/         # TypeScript 타입 정의
│   │   └── tests/         # 단위 테스트
│   └── package.json
└── package.json           # 루트 패키지
```

## 개발 진행 상황

### ✅ 1단계: 프로젝트 초기 설정 (완료)
- 프로젝트 폴더 구조 생성
- 클라이언트/서버 설정 파일 구성
- TypeScript 설정 및 타입 정의
- 의존성 패키지 설치
- Git 설정 및 초기 커밋

### ✅ 2단계: 백엔드 브라우저 서비스 구현 (완료)
- **BrowserService**: Puppeteer 기반 브라우저 자동화 서비스
- **Logger**: Winston 기반 구조화된 로깅 시스템
- **InputValidator**: 입력 검증 및 XSS 방지 시스템
- **SecurityManager**: 다층 보안 시스템
- **PerformanceMonitor**: 실시간 성능 모니터링
- 포괄적인 단위 테스트 구현

### ✅ 3단계: AI 명령어 파싱 서비스 구현 (완료)
- **AIService**: OpenAI GPT-4 기반 자연어 처리 서비스
- 프롬프트 엔지니어링 및 명령어 파싱
- 결과 캐싱 및 성능 최적화
- 폴백 명령어 생성
- 보안 검증 및 명령어 검증
- 사용량 통계 및 모니터링
- 단위 테스트 구현

### ✅ 4단계: 웹소켓 서버 구현 (SocketController) (완료)
- **SocketController**: Socket.io 기반 실시간 웹소켓 서버
- 클라이언트 연결 관리 및 세션 추적
- 브라우저 인스턴스 관리 및 상태 동기화
- 실시간 명령어 처리 파이프라인
- 에러 핸들링 및 재연결 로직
- 보안 검증 및 Rate Limiting
- 성능 모니터링 및 통계 수집
- 자동 정리 작업 및 리소스 관리
- 포괄적인 단위 테스트 구현

### 🚧 다음 단계 계획

#### 5단계: Express 서버 메인 파일
- 메인 서버 애플리케이션
- 미들웨어 설정
- 라우트 구성

#### 6단계: React 프론트엔드 메인 컴포넌트
- 메인 애플리케이션 컴포넌트
- 상태 관리
- 라우팅 설정

#### 7단계: Socket.io 클라이언트 훅
- 실시간 통신 훅
- 연결 상태 관리
- 이벤트 처리

#### 8단계: 채팅 인터페이스 컴포넌트
- 사용자 입력 인터페이스
- 명령어 히스토리
- 진행 상황 표시

#### 9단계: 브라우저 뷰어 컴포넌트
- 실시간 스크린샷 표시
- 브라우저 상태 표시
- 상호작용 가능한 UI

#### 10단계: 환경변수 및 설정
- 환경변수 설정
- 배포 설정
- 보안 설정

#### 11단계: 실행 스크립트 및 문서
- 실행 스크립트 작성
- 사용자 가이드
- API 문서

#### 12단계: 고급 기능 구현
- 고급 브라우저 기능
- 배치 명령어 처리
- 사용자 세션 관리

## 핵심 기능 상세

### AI 명령어 파싱 (AIService)
- **자연어 처리**: 사용자 입력을 브라우저 명령어로 변환
- **프롬프트 엔지니어링**: 효과적인 명령어 변환을 위한 최적화된 프롬프트
- **결과 캐싱**: 유사한 요청에 대한 빠른 응답
- **폴백 처리**: AI 실패 시 패턴 기반 명령어 생성
- **보안 검증**: 모든 명령어에 대한 안전성 검사

### 브라우저 자동화 (BrowserService)
- **다중 브라우저 지원**: Headless/Headful 모드 지원
- **메모리 관리**: 자동 메모리 정리 및 누수 방지
- **보안 설정**: 안전한 브라우저 환경 구성
- **성능 최적화**: 이미지 차단, 리소스 정리

### 보안 시스템 (SecurityManager)
- **URL 안전성 검사**: 악성 사이트 차단
- **콘텐츠 검증**: 피싱 및 악성 콘텐츠 탐지
- **스크립트 안전성**: 위험한 JavaScript 코드 검사
- **Rate Limiting**: 요청 제한 및 남용 방지

### 성능 모니터링 (PerformanceMonitor)
- **실시간 모니터링**: 메모리, CPU 사용량 추적
- **성능 측정**: 작업 실행 시간 측정
- **메모리 누수 감지**: 자동 메모리 누수 탐지
- **성능 보고서**: 상세한 성능 분석 리포트

### 웹소켓 서버 (SocketController)
- **실시간 통신**: Socket.io 기반 양방향 통신
- **세션 관리**: 클라이언트 연결 상태 추적
- **브라우저 인스턴스 관리**: 각 클라이언트별 브라우저 상태 관리
- **명령어 큐 관리**: 실시간 명령어 처리 파이프라인
- **자동 정리**: 비활성 세션 및 리소스 자동 정리

## Socket.io API 문서

### 클라이언트 → 서버 이벤트

#### `execute_command`
사용자 명령어 실행 요청
```javascript
socket.emit('execute_command', {
  userInput: '구글에서 날씨 검색해줘',
  context: {
    currentUrl: 'https://example.com',
    pageTitle: 'Example Page'
  }
});
```

#### `get_screenshot`
현재 페이지 스크린샷 요청
```javascript
socket.emit('get_screenshot');
```

#### `reset_browser`
브라우저 인스턴스 리셋 요청
```javascript
socket.emit('reset_browser');
```

### 서버 → 클라이언트 이벤트

#### `browser_status`
브라우저 상태 업데이트
```javascript
socket.on('browser_status', (data) => {
  console.log(data.status); // 'ready', 'busy', 'error', 'disconnected'
});
```

#### `command_progress`
명령어 실행 진행 상황
```javascript
socket.on('command_progress', (data) => {
  console.log(data.status);      // 'parsing', 'executing', 'completed'
  console.log(data.progress);    // 0-100
  console.log(data.currentStep); // 현재 단계 설명
});
```

#### `command_result`
명령어 실행 결과
```javascript
socket.on('command_result', (data) => {
  if (data.success) {
    console.log(data.data);          // 실행 결과
    console.log(data.executionTime); // 실행 시간 (ms)
  } else {
    console.log(data.error);         // 에러 메시지
  }
});
```

#### `screenshot_update`
스크린샷 업데이트
```javascript
socket.on('screenshot_update', (data) => {
  console.log(data.screenshot); // Base64 인코딩된 스크린샷
  console.log(data.timestamp);  // 촬영 시각
});
```

#### `error`
에러 발생 알림
```javascript
socket.on('error', (data) => {
  console.log(data.message);  // 에러 메시지
  console.log(data.code);     // 에러 코드
  console.log(data.details);  // 상세 정보
});
```

### 연결 설정 예제

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: true
});

// 연결 성공
socket.on('connect', () => {
  console.log('Connected to server');
});

// 브라우저 준비 완료
socket.on('browser_status', (data) => {
  if (data.status === 'ready') {
    console.log('Browser is ready');
    
    // 명령어 실행 예제
    socket.emit('execute_command', {
      userInput: 'Google로 이동해서 "TypeScript"를 검색해줘',
      context: {}
    });
  }
});

// 실행 진행 상황 추적
socket.on('command_progress', (data) => {
  console.log(`진행률: ${data.progress}% - ${data.currentStep}`);
});

// 실행 결과 처리
socket.on('command_result', (data) => {
  if (data.success) {
    console.log('명령어 실행 성공:', data.data);
  } else {
    console.error('명령어 실행 실패:', data.error);
  }
});

// 스크린샷 업데이트
socket.on('screenshot_update', (data) => {
  const img = document.createElement('img');
  img.src = `data:image/png;base64,${data.screenshot}`;
  document.body.appendChild(img);
});

// 에러 처리
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});

// 연결 해제
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### 보안 및 제한사항

#### Rate Limiting
- 클라이언트 IP별 요청 제한: 15분간 최대 100개 요청
- 동시 실행 제한: 클라이언트당 1개 명령어만 동시 실행 가능
- 세션 타임아웃: 30분간 비활성 시 자동 해제

#### 입력 검증
- 명령어 길이 제한: 최대 1000자
- 악성 스크립트 패턴 탐지 및 차단
- URL 안전성 검사 (악성 사이트 차단)
- XSS 공격 방지를 위한 입력 새니타이징

#### 보안 헤더
- CSP (Content Security Policy) 적용
- HSTS (HTTP Strict Transport Security) 설정
- X-Frame-Options, X-Content-Type-Options 설정

## 설치 및 실행

### 환경 요구사항
- Node.js 18.0.0 이상
- npm 또는 yarn
- OpenAI API 키

### 설치
```bash
# 저장소 클론
git clone <repository-url>
cd pilot

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 OpenAI API 키 설정
```

### 실행
```bash
# 개발 모드 (클라이언트 + 서버 동시 실행)
npm run dev

# 서버만 실행
npm run server

# 클라이언트만 실행
npm run client
```

### 테스트
```bash
# 모든 테스트 실행
npm test

# 서버 테스트만 실행
npm run test:server

# 테스트 커버리지 확인
npm run test:coverage
```

## 개발 원칙

### 품질 보증
- **타입 안전성**: 모든 코드에 엄격한 TypeScript 적용
- **에러 핸들링**: 포괄적인 에러 처리 및 사용자 친화적 메시지
- **테스트 커버리지**: 모든 핵심 기능에 대한 단위 테스트
- **코드 품질**: ESLint, Prettier를 통한 일관된 코드 스타일

### 보안 중심
- **입력 검증**: 모든 사용자 입력에 대한 검증 및 새니타이징
- **XSS 방지**: 다양한 XSS 공격 벡터 차단
- **안전한 실행**: 브라우저 명령어 실행 시 안전성 검사
- **접근 제어**: 권한 기반 기능 접근 제어

### 성능 최적화
- **메모리 관리**: 자동 메모리 정리 및 누수 방지
- **캐싱**: 효율적인 결과 캐싱 전략
- **리소스 최적화**: 불필요한 리소스 로딩 방지
- **모니터링**: 실시간 성능 추적 및 알림

### 접근성
- **ARIA 라벨**: 스크린 리더 지원
- **키보드 네비게이션**: 마우스 없이 완전한 기능 사용
- **색상 대비**: WCAG 2.1 AA 수준 준수
- **반응형 디자인**: 다양한 화면 크기 지원

## 기여 가이드

### 코드 기여
1. Fork 저장소
2. 새 브랜치 생성 (`git checkout -b feature/새기능`)
3. 변경사항 커밋 (`git commit -m 'feat: 새로운 기능 추가'`)
4. 브랜치 푸시 (`git push origin feature/새기능`)
5. Pull Request 생성

### 커밋 메시지 규칙
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 업데이트
- `style`: 코드 포맷팅, 세미콜론 누락 등
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가 또는 수정
- `chore`: 기타 작업

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 연락처

프로젝트 관련 문의사항이 있으시면 이슈를 통해 연락해주세요.

---

**AI Browser Controller** - 자연어로 브라우저를 제어하는 혁신적인 경험을 제공합니다.