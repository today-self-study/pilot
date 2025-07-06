/**
 * @fileoverview 구조화된 로깅 시스템
 * @author AI Browser Controller Team
 * @version 0.1.0
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { LogLevel, LogEntry } from '../types';

/**
 * 구조화된 로깅을 제공하는 Logger 클래스
 * Winston을 기반으로 한 고성능 로깅 시스템
 */
export class Logger {
  private winston: winston.Logger;
  private context: string;
  private static loggers: Map<string, Logger> = new Map();

  /**
   * Logger 생성자
   * @param context 로그 컨텍스트 (보통 클래스명 또는 모듈명)
   * @param options 로깅 옵션
   */
  constructor(
    context: string,
    options: {
      level?: LogLevel;
      enableFile?: boolean;
      enableConsole?: boolean;
      logDir?: string;
    } = {}
  ) {
    this.context = context;

    // 기존 로거가 있으면 재사용
    const existingLogger = Logger.loggers.get(context);
    if (existingLogger) {
      this.winston = existingLogger.winston;
      return;
    }

    const {
      level = 'info',
      enableFile = true,
      enableConsole = true,
      logDir = 'logs'
    } = options;

    // Winston 로거 설정
    this.winston = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `[${timestamp}] [${level.toUpperCase()}] [${context || 'UNKNOWN'}] ${message}${metaStr ? '\n' + metaStr : ''}`;
        })
      ),
      defaultMeta: {
        context: this.context,
        service: 'ai-browser-controller',
        version: '0.1.0'
      },
      transports: this.createTransports(enableConsole, enableFile, logDir, level),
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });

    // 에러 핸들링
    this.winston.on('error', (error) => {
      console.error('Logger error:', error);
    });

    Logger.loggers.set(context, this);
  }

  /**
   * Winston 전송자(Transports) 생성
   * @private
   */
  private createTransports(
    enableConsole: boolean,
    enableFile: boolean,
    logDir: string,
    level: LogLevel
  ): winston.transport[] {
    const transports: winston.transport[] = [];

    // 콘솔 출력
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({
              all: true,
              colors: {
                error: 'red',
                warn: 'yellow',
                info: 'cyan',
                debug: 'green',
                verbose: 'magenta'
              }
            }),
            winston.format.timestamp({
              format: 'HH:mm:ss.SSS'
            }),
            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              const metaStr = Object.keys(meta).length ? 
                ' | ' + JSON.stringify(meta).replace(/"/g, '') : '';
              return `${timestamp} [${level}] [${context}] ${message}${metaStr}`;
            })
          ),
          level,
          handleExceptions: true,
          handleRejections: true
        })
      );
    }

    // 파일 출력
    if (enableFile) {
      // 에러 로그 파일
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          handleExceptions: true,
          handleRejections: true,
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );

      // 일반 로그 파일
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level,
          maxSize: '20m',
          maxFiles: '7d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );

      // 디버그 로그 파일 (개발 환경)
      if (process.env.NODE_ENV === 'development') {
        transports.push(
          new DailyRotateFile({
            filename: path.join(logDir, 'debug-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'debug',
            maxSize: '50m',
            maxFiles: '3d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          })
        );
      }
    }

    return transports;
  }

  /**
   * 지정된 레벨로 로그 출력
   * @param level 로그 레벨
   * @param message 로그 메시지
   * @param meta 추가 메타데이터
   */
  public log(level: LogLevel, message: string, meta?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      metadata: meta
    };

    this.winston.log(level, message, {
      ...meta,
      timestamp: logEntry.timestamp.toISOString(),
      context: this.context
    });
  }

  /**
   * 에러 로그 출력
   * @param message 에러 메시지
   * @param error 에러 객체 또는 메타데이터
   */
  public error(message: string, error?: Error | any): void {
    const errorData: any = {
      context: this.context,
      timestamp: new Date().toISOString()
    };

    if (error instanceof Error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      };
    } else if (error) {
      errorData.metadata = error;
    }

    this.winston.error(message, errorData);
  }

  /**
   * 경고 로그 출력
   * @param message 경고 메시지
   * @param meta 추가 메타데이터
   */
  public warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  /**
   * 정보 로그 출력
   * @param message 정보 메시지
   * @param meta 추가 메타데이터
   */
  public info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  /**
   * 디버그 로그 출력
   * @param message 디버그 메시지
   * @param meta 추가 메타데이터
   */
  public debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  /**
   * 상세 로그 출력
   * @param message 상세 메시지
   * @param meta 추가 메타데이터
   */
  public verbose(message: string, meta?: any): void {
    this.log('verbose', message, meta);
  }

  /**
   * 성능 측정 시작
   * @param label 성능 측정 라벨
   * @returns 성능 측정 종료 함수
   */
  public startTimer(label: string): () => void {
    const startTime = Date.now();
    
    this.debug(`Performance timer started: ${label}`);
    
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Performance timer finished: ${label}`, {
        duration,
        label,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString()
      });
      return duration;
    };
  }

  /**
   * HTTP 요청 로깅
   * @param req 요청 객체
   * @param res 응답 객체
   * @param duration 응답 시간 (ms)
   */
  public logHttpRequest(
    req: {
      method: string;
      url: string;
      ip?: string;
      userAgent?: string;
      headers?: any;
    },
    res: {
      statusCode: number;
      contentLength?: number;
    },
    duration: number
  ): void {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.userAgent,
      contentLength: res.contentLength,
      timestamp: new Date().toISOString()
    };

    const level: LogLevel = res.statusCode >= 500 ? 'error' :
                           res.statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `HTTP ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, logData);
  }

  /**
   * 메모리 사용량 로깅
   */
  public logMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    this.debug('Memory usage', {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
      arrayBuffers: formatBytes(memUsage.arrayBuffers || 0)
    });
  }

  /**
   * 에러 스택 추적과 함께 로깅
   * @param error 에러 객체
   * @param context 추가 컨텍스트
   */
  public logErrorWithStack(error: Error, context?: any): void {
    this.error('Error occurred', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 배치 로깅 - 여러 로그 엔트리를 한 번에 처리
   * @param entries 로그 엔트리 배열
   */
  public logBatch(entries: LogEntry[]): void {
    entries.forEach(entry => {
      this.log(entry.level, entry.message, entry.metadata);
    });
  }

  /**
   * 조건부 로깅 - 조건이 true일 때만 로그 출력
   * @param condition 로깅 조건
   * @param level 로그 레벨
   * @param message 로그 메시지
   * @param meta 추가 메타데이터
   */
  public logIf(condition: boolean, level: LogLevel, message: string, meta?: any): void {
    if (condition) {
      this.log(level, message, meta);
    }
  }

  /**
   * 현재 로거의 컨텍스트 반환
   * @returns 컨텍스트 문자열
   */
  public getContext(): string {
    return this.context;
  }

  /**
   * 로그 레벨 변경
   * @param level 새로운 로그 레벨
   */
  public setLevel(level: LogLevel): void {
    this.winston.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  /**
   * 현재 로그 레벨 반환
   * @returns 현재 로그 레벨
   */
  public getLevel(): string {
    return this.winston.level;
  }

  /**
   * 로거 정리 및 리소스 해제
   */
  public close(): void {
    this.winston.close();
    Logger.loggers.delete(this.context);
  }

  /**
   * 모든 로거 인스턴스 정리
   * @static
   */
  public static closeAll(): void {
    Logger.loggers.forEach(logger => logger.close());
    Logger.loggers.clear();
  }

  /**
   * 특정 컨텍스트의 로거 인스턴스 가져오기
   * @static
   * @param context 컨텍스트
   * @returns Logger 인스턴스 또는 null
   */
  public static getInstance(context: string): Logger | null {
    return Logger.loggers.get(context) || null;
  }
} 