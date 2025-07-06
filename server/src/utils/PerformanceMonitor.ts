import { performance } from 'perf_hooks';
import { Logger } from './Logger';

/**
 * 성능 모니터링을 담당하는 클래스
 * 메모리 사용량, 실행 시간, 리소스 사용량 등을 모니터링
 */
export class PerformanceMonitor {
  private static readonly MEMORY_THRESHOLD_MB = 512; // 512MB
  private static readonly CPU_THRESHOLD_PERCENT = 80; // 80%
  private static readonly RESPONSE_TIME_THRESHOLD_MS = 5000; // 5초
  private static readonly MAX_CONCURRENT_OPERATIONS = 10;

  private static logger = new Logger('PerformanceMonitor');

  private static activeOperations = new Map<string, {
    startTime: number;
    type: string;
    metadata?: Record<string, any>;
  }>();

  private static performanceMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    memoryUsage: {
      peak: 0,
      current: 0,
      average: 0
    },
    cpuUsage: {
      peak: 0,
      current: 0,
      average: 0
    }
  };

  private static memoryHistory: number[] = [];
  private static cpuHistory: number[] = [];
  private static responseTimeHistory: number[] = [];

  /**
   * 작업 시작을 기록합니다.
   * 
   * @param operationId 작업 식별자
   * @param type 작업 유형
   * @param metadata 추가 메타데이터
   */
  public static startOperation(operationId: string, type: string, metadata?: Record<string, any>): void {
    // 동시 작업 수 확인
    if (this.activeOperations.size >= this.MAX_CONCURRENT_OPERATIONS) {
      throw new Error('동시 작업 수가 한계에 도달했습니다.');
    }

    const startTime = performance.now();
    const operationData = {
      startTime,
      type,
      ...(metadata && { metadata })
    };
    
    this.activeOperations.set(operationId, operationData);

    this.logger.debug(`작업 시작: ${operationId} (타입: ${type})`, {
      operationId,
      type,
      startTime,
      metadata
    });
  }

  /**
   * 작업 완료를 기록합니다.
   * 
   * @param operationId 작업 식별자
   * @param success 성공 여부
   * @param result 결과 데이터
   * @returns 작업 실행 시간
   */
  public static endOperation(operationId: string, success: boolean = true, result?: any): number {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(`알 수 없는 작업 ID: ${operationId}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - operation.startTime;

    // 통계 업데이트
    this.performanceMetrics.totalOperations++;
    if (success) {
      this.performanceMetrics.successfulOperations++;
    } else {
      this.performanceMetrics.failedOperations++;
    }

    // 응답 시간 통계 업데이트
    this.responseTimeHistory.push(duration);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory.shift();
    }

    this.performanceMetrics.averageResponseTime = 
      this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;
    this.performanceMetrics.maxResponseTime = Math.max(this.performanceMetrics.maxResponseTime, duration);
    this.performanceMetrics.minResponseTime = Math.min(this.performanceMetrics.minResponseTime, duration);

    // 임계값 확인
    if (duration > this.RESPONSE_TIME_THRESHOLD_MS) {
      this.logger.warn(`느린 응답 시간 감지: ${operationId} (${duration.toFixed(2)}ms)`, {
        operationId,
        duration,
        type: operation.type,
        threshold: this.RESPONSE_TIME_THRESHOLD_MS
      });
    }

    // 작업 목록에서 제거
    this.activeOperations.delete(operationId);

    this.logger.debug(`작업 완료: ${operationId} (${duration.toFixed(2)}ms)`, {
      operationId,
      duration,
      success,
      type: operation.type,
      result: result ? Object.keys(result).length : 0
    });

    return duration;
  }

  /**
   * 메모리 사용량을 모니터링합니다.
   * 
   * @returns 메모리 사용량 정보
   */
  public static monitorMemory(): {
    used: number;
    total: number;
    percentage: number;
    isThresholdExceeded: boolean;
  } {
    const memoryUsage = process.memoryUsage();
    const usedMB = memoryUsage.heapUsed / 1024 / 1024;
    const totalMB = memoryUsage.heapTotal / 1024 / 1024;
    const percentage = (usedMB / totalMB) * 100;

    // 히스토리 업데이트
    this.memoryHistory.push(usedMB);
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }

    // 통계 업데이트
    this.performanceMetrics.memoryUsage.current = usedMB;
    this.performanceMetrics.memoryUsage.peak = Math.max(this.performanceMetrics.memoryUsage.peak, usedMB);
    this.performanceMetrics.memoryUsage.average = 
      this.memoryHistory.reduce((sum, usage) => sum + usage, 0) / this.memoryHistory.length;

    const isThresholdExceeded = usedMB > this.MEMORY_THRESHOLD_MB;

    if (isThresholdExceeded) {
      this.logger.warn(`메모리 사용량 임계값 초과: ${usedMB.toFixed(2)}MB (임계값: ${this.MEMORY_THRESHOLD_MB}MB)`, {
        usedMB,
        totalMB,
        percentage,
        threshold: this.MEMORY_THRESHOLD_MB
      });
    }

    return {
      used: usedMB,
      total: totalMB,
      percentage,
      isThresholdExceeded
    };
  }

  /**
   * CPU 사용량을 모니터링합니다.
   * 
   * @returns CPU 사용량 정보
   */
  public static monitorCPU(): Promise<{
    usage: number;
    isThresholdExceeded: boolean;
  }> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = performance.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = performance.now();

        const totalTime = (endTime - startTime) * 1000; // 마이크로초 단위
        const cpuTime = endUsage.user + endUsage.system;
        const usage = (cpuTime / totalTime) * 100;

        // 히스토리 업데이트
        this.cpuHistory.push(usage);
        if (this.cpuHistory.length > 100) {
          this.cpuHistory.shift();
        }

        // 통계 업데이트
        this.performanceMetrics.cpuUsage.current = usage;
        this.performanceMetrics.cpuUsage.peak = Math.max(this.performanceMetrics.cpuUsage.peak, usage);
        this.performanceMetrics.cpuUsage.average = 
          this.cpuHistory.reduce((sum, cpuUsage) => sum + cpuUsage, 0) / this.cpuHistory.length;

        const isThresholdExceeded = usage > this.CPU_THRESHOLD_PERCENT;

        if (isThresholdExceeded) {
          this.logger.warn(`CPU 사용량 임계값 초과: ${usage.toFixed(2)}% (임계값: ${this.CPU_THRESHOLD_PERCENT}%)`, {
            usage,
            threshold: this.CPU_THRESHOLD_PERCENT
          });
        }

        resolve({
          usage,
          isThresholdExceeded
        });
      }, 100);
    });
  }

  /**
   * 가비지 컬렉션을 강제 실행합니다.
   */
  public static forceGarbageCollection(): void {
    if (global.gc) {
      const beforeMemory = process.memoryUsage();
      global.gc();
      const afterMemory = process.memoryUsage();
      
      const freedMemory = (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024;
      
      this.logger.info(`가비지 컬렉션 실행: ${freedMemory.toFixed(2)}MB 해제`, {
        beforeMemory: beforeMemory.heapUsed / 1024 / 1024,
        afterMemory: afterMemory.heapUsed / 1024 / 1024,
        freedMemory
      });
    } else {
      this.logger.warn('가비지 컬렉션을 사용할 수 없습니다. --expose-gc 플래그를 사용하여 Node.js를 실행하세요.');
    }
  }

  /**
   * 메모리 누수를 감지합니다.
   * 
   * @returns 메모리 누수 감지 결과
   */
  public static detectMemoryLeak(): {
    isLeakDetected: boolean;
    trend: 'increasing' | 'decreasing' | 'stable';
    growthRate: number;
  } {
    if (this.memoryHistory.length < 10) {
      return {
        isLeakDetected: false,
        trend: 'stable',
        growthRate: 0
      };
    }

    // 최근 메모리 사용량 추세 분석
    const recentHistory = this.memoryHistory.slice(-10);
    const oldHistory = this.memoryHistory.slice(-20, -10);

    const recentAvg = recentHistory.reduce((sum, usage) => sum + usage, 0) / recentHistory.length;
    const oldAvg = oldHistory.reduce((sum, usage) => sum + usage, 0) / oldHistory.length;

    const growthRate = ((recentAvg - oldAvg) / oldAvg) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (growthRate > 5) {
      trend = 'increasing';
    } else if (growthRate < -5) {
      trend = 'decreasing';
    }

    const isLeakDetected = trend === 'increasing' && growthRate > 10;

    if (isLeakDetected) {
      this.logger.warn(`메모리 누수 의심: 증가율 ${growthRate.toFixed(2)}%`, {
        recentAvg,
        oldAvg,
        growthRate,
        trend
      });
    }

    return {
      isLeakDetected,
      trend,
      growthRate
    };
  }

  /**
   * 성능 보고서를 생성합니다.
   * 
   * @returns 성능 보고서
   */
  public static generateReport(): {
    summary: {
      totalOperations: number;
      successRate: number;
      averageResponseTime: number;
      activeOperations: number;
    };
    memory: {
      current: number;
      peak: number;
      average: number;
      trend: string;
    };
    cpu: {
      current: number;
      peak: number;
      average: number;
    };
    alerts: string[];
  } {
    const memoryStatus = this.monitorMemory();
    const memoryLeak = this.detectMemoryLeak();
    
    const alerts: string[] = [];
    
    if (memoryStatus.isThresholdExceeded) {
      alerts.push(`메모리 사용량 임계값 초과: ${memoryStatus.used.toFixed(2)}MB`);
    }
    
    if (memoryLeak.isLeakDetected) {
      alerts.push(`메모리 누수 의심: 증가율 ${memoryLeak.growthRate.toFixed(2)}%`);
    }
    
    if (this.performanceMetrics.averageResponseTime > this.RESPONSE_TIME_THRESHOLD_MS) {
      alerts.push(`평균 응답 시간 초과: ${this.performanceMetrics.averageResponseTime.toFixed(2)}ms`);
    }
    
    if (this.activeOperations.size >= this.MAX_CONCURRENT_OPERATIONS) {
      alerts.push(`동시 작업 수 한계: ${this.activeOperations.size}개`);
    }

    const successRate = this.performanceMetrics.totalOperations > 0 
      ? (this.performanceMetrics.successfulOperations / this.performanceMetrics.totalOperations) * 100
      : 0;

    return {
      summary: {
        totalOperations: this.performanceMetrics.totalOperations,
        successRate,
        averageResponseTime: this.performanceMetrics.averageResponseTime,
        activeOperations: this.activeOperations.size
      },
      memory: {
        current: this.performanceMetrics.memoryUsage.current,
        peak: this.performanceMetrics.memoryUsage.peak,
        average: this.performanceMetrics.memoryUsage.average,
        trend: memoryLeak.trend
      },
      cpu: {
        current: this.performanceMetrics.cpuUsage.current,
        peak: this.performanceMetrics.cpuUsage.peak,
        average: this.performanceMetrics.cpuUsage.average
      },
      alerts
    };
  }

  /**
   * 성능 측정을 위한 데코레이터 함수입니다.
   * 
   * @param operationType 작업 유형
   * @returns 데코레이터 함수
   */
  public static measure(operationType: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          PerformanceMonitor.startOperation(operationId, operationType, {
            method: propertyKey,
            args: args.length
          });
          
          const result = await originalMethod.apply(this, args);
          
          PerformanceMonitor.endOperation(operationId, true, result);
          return result;
        } catch (error) {
          PerformanceMonitor.endOperation(operationId, false, error);
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * 시간을 측정하는 유틸리티 함수입니다.
   * 
   * @param fn 측정할 함수
   * @param operationType 작업 유형
   * @returns 측정 결과
   */
  public static async time<T>(
    fn: () => Promise<T> | T,
    operationType: string = 'unknown'
  ): Promise<{ result: T; duration: number }> {
    const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.startOperation(operationId, operationType);
      
      const result = await fn();
      
      const duration = this.endOperation(operationId, true, result);
      
      return { result, duration };
    } catch (error) {
      const duration = this.endOperation(operationId, false, error);
      throw error;
    }
  }

  /**
   * 성능 통계를 초기화합니다.
   */
  public static reset(): void {
    this.activeOperations.clear();
    this.memoryHistory.length = 0;
    this.cpuHistory.length = 0;
    this.responseTimeHistory.length = 0;
    
    this.performanceMetrics.totalOperations = 0;
    this.performanceMetrics.successfulOperations = 0;
    this.performanceMetrics.failedOperations = 0;
    this.performanceMetrics.averageResponseTime = 0;
    this.performanceMetrics.maxResponseTime = 0;
    this.performanceMetrics.minResponseTime = Infinity;
    this.performanceMetrics.memoryUsage.peak = 0;
    this.performanceMetrics.memoryUsage.current = 0;
    this.performanceMetrics.memoryUsage.average = 0;
    this.performanceMetrics.cpuUsage.peak = 0;
    this.performanceMetrics.cpuUsage.current = 0;
    this.performanceMetrics.cpuUsage.average = 0;
  }

  /**
   * 현재 활성 작업 목록을 가져옵니다.
   * 
   * @returns 활성 작업 목록
   */
  public static getActiveOperations(): Array<{
    id: string;
    type: string;
    duration: number;
    metadata?: Record<string, any>;
  }> {
    const now = performance.now();
    return Array.from(this.activeOperations.entries()).map(([id, operation]) => ({
      id,
      type: operation.type,
      duration: now - operation.startTime,
      ...(operation.metadata && { metadata: operation.metadata })
    }));
  }

  /**
   * 시스템 리소스 정보를 가져옵니다.
   * 
   * @returns 시스템 리소스 정보
   */
  public static getSystemInfo(): {
    nodeVersion: string;
    platform: string;
    arch: string;
    uptime: number;
    loadAverage: number[];
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  } {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }
} 