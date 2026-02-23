interface ErrorLogData {
  error: string;
  stack: string;
  componentStack?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  context?: string;
  dealId?: string;
  userId?: string;
  formName?: string;
  isNetworkError?: boolean;
  isOnline?: boolean;
  isWebGLError?: boolean;
  webglInfo?: any;
  hadFormData?: boolean;
  [key: string]: any;
}

interface QueuedError extends ErrorLogData {
  retryCount: number;
  queuedAt: number;
}

const ERROR_QUEUE_KEY = 'error-log-queue';
const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_COUNT = 3;

class ErrorLoggingService {
  private queue: QueuedError[] = [];
  private isProcessing = false;
  private apiEndpoint = '/api/v1/errors/log';

  constructor() {
    this.loadQueue();
    this.setupOnlineListener();
    // Try to process queue on initialization
    this.processQueue();
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      this.processQueue();
    });
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(ERROR_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load error queue:', e);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      // Keep only the most recent errors if queue is too large
      if (this.queue.length > MAX_QUEUE_SIZE) {
        this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
      }
      localStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save error queue:', e);
    }
  }

  private async sendToBackend(data: ErrorLogData): Promise<boolean> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send error log:', error);
      return false;
    }
  }

  private async processQueue() {
    if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const errors = [...this.queue];
      const successfulIndices: number[] = [];

      for (let i = 0; i < errors.length; i++) {
        const queuedError = errors[i];
        
        // Skip if exceeded retry count
        if (queuedError.retryCount >= MAX_RETRY_COUNT) {
          successfulIndices.push(i);
          continue;
        }

        const { retryCount, queuedAt, ...errorData } = queuedError;
        const success = await this.sendToBackend(errorData);

        if (success) {
          successfulIndices.push(i);
        } else {
          // Increment retry count
          this.queue[i].retryCount++;
        }
      }

      // Remove successfully sent errors (in reverse to maintain indices)
      successfulIndices.reverse().forEach((index) => {
        this.queue.splice(index, 1);
      });

      this.saveQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  public async log(data: ErrorLogData): Promise<void> {
    // Try to send immediately
    const success = await this.sendToBackend(data);

    if (!success) {
      // Queue for later if failed
      this.queue.push({
        ...data,
        retryCount: 0,
        queuedAt: Date.now(),
      });
      this.saveQueue();

      // Try to process queue (will skip if offline)
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    this.queue = [];
    localStorage.removeItem(ERROR_QUEUE_KEY);
  }
}

// Singleton instance
const errorLoggingService = new ErrorLoggingService();

export const logErrorToBackend = (data: ErrorLogData): Promise<void> => {
  // Add user info if available
  const enhancedData = {
    ...data,
    url: data.url || window.location.href,
    userAgent: data.userAgent || navigator.userAgent,
  };

  return errorLoggingService.log(enhancedData);
};

export const getErrorQueueSize = (): number => {
  return errorLoggingService.getQueueSize();
};

export const clearErrorQueue = (): void => {
  errorLoggingService.clearQueue();
};

export default errorLoggingService;
