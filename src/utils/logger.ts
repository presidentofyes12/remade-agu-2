import { errorHandler } from './errorHandler';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogContext {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  format?: (context: LogContext) => string;
  handlers?: ((context: LogContext) => void)[];
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private handlers: Set<(context: LogContext) => void>;

  private constructor(config: LoggerConfig = { minLevel: LogLevel.INFO }) {
    this.config = config;
    this.handlers = new Set(config.handlers || []);
  }

  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  public error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  public addHandler(handler: (context: LogContext) => void): void {
    this.handlers.add(handler);
  }

  public removeHandler(handler: (context: LogContext) => void): void {
    this.handlers.delete(handler);
  }

  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (this.shouldLog(level)) {
      const context: LogContext = {
        timestamp: Date.now(),
        level,
        message,
        data,
        error
      };

      const formattedMessage = this.formatMessage(context);
      this.handleLog(context, formattedMessage);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  private formatMessage(context: LogContext): string {
    if (this.config.format) {
      return this.config.format(context);
    }

    const timestamp = new Date(context.timestamp).toISOString();
    let message = `[${timestamp}] ${context.level}: ${context.message}`;

    if (context.data) {
      message += `\nData: ${JSON.stringify(context.data, null, 2)}`;
    }

    if (context.error) {
      message += `\nError: ${context.error.message}`;
      if (context.error.stack) {
        message += `\nStack: ${context.error.stack}`;
      }
    }

    return message;
  }

  private handleLog(context: LogContext, formattedMessage: string): void {
    // Console output based on level
    switch (context.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }

    // Custom handlers
    this.handlers.forEach(handler => {
      try {
        handler(context);
      } catch (error) {
        errorHandler.handleError(error, {
          operation: 'loggerHandler',
          timestamp: Date.now(),
          additionalInfo: { level: context.level }
        });
      }
    });
  }
}

export const logger = Logger.getInstance(); 