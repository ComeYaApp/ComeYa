export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  userId?: string;
  orderId?: string;
  businessId?: string;
  action?: string;
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel | null = null;

  private getMinLevel(): LogLevel {
    if (this.minLevel === null) {
      this.minLevel =
        process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
    }
    return this.minLevel;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.getMinLevel();
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage("DEBUG", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage("INFO", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage("WARN", message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = {
        ...context,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      };
      console.error(this.formatMessage("ERROR", message, errorContext));
    }
  }

  // Specific loggers for common operations
  payment(message: string, context: LogContext): void {
    this.info(`[PAYMENT] ${message}`, context);
  }

  order(message: string, context: LogContext): void {
    this.info(`[ORDER] ${message}`, context);
  }

  delivery(message: string, context: LogContext): void {
    this.info(`[DELIVERY] ${message}`, context);
  }

  webhook(message: string, context: LogContext): void {
    this.info(`[WEBHOOK] ${message}`, context);
  }

  security(message: string, context: LogContext): void {
    this.warn(`[SECURITY] ${message}`, context);
  }
}

export const logger = new Logger();
