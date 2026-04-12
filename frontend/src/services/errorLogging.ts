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

class ErrorLoggingService {
  public async log(data: ErrorLogData): Promise<void> {
    console.error('[ErrorLogging]', data.error, data.stack);
  }

  public getQueueSize(): number {
    return 0;
  }

  public clearQueue(): void {
  }
}

const errorLoggingService = new ErrorLoggingService();

export const logErrorToBackend = (data: ErrorLogData): Promise<void> => {
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
