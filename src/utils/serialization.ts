import { errorHandler } from './errorHandler';
import { logger } from './logger';

export interface SerializationOptions {
  pretty?: boolean;
  maxDepth?: number;
  circular?: boolean;
}

export class Serialization {
  private static instance: Serialization;
  private defaultOptions: SerializationOptions = {
    pretty: false,
    maxDepth: 10,
    circular: false
  };

  private constructor() {}

  public static getInstance(): Serialization {
    if (!Serialization.instance) {
      Serialization.instance = new Serialization();
    }
    return Serialization.instance;
  }

  public serialize<T>(data: T, options: Partial<SerializationOptions> = {}): string {
    try {
      const finalOptions = { ...this.defaultOptions, ...options };
      const serialized = JSON.stringify(data, this.getReplacer(finalOptions), finalOptions.pretty ? 2 : undefined);
      return serialized;
    } catch (error) {
      const serializationError = errorHandler.handleError(error, {
        operation: 'serialize',
        timestamp: Date.now(),
        additionalInfo: { dataType: typeof data }
      });
      logger.error('Serialization failed', serializationError);
      throw serializationError;
    }
  }

  public deserialize<T>(data: string, options: Partial<SerializationOptions> = {}): T {
    try {
      const finalOptions = { ...this.defaultOptions, ...options };
      return JSON.parse(data, this.getReviver(finalOptions)) as T;
    } catch (error) {
      const deserializationError = errorHandler.handleError(error, {
        operation: 'deserialize',
        timestamp: Date.now(),
        additionalInfo: { dataLength: data.length }
      });
      logger.error('Deserialization failed', deserializationError);
      throw deserializationError;
    }
  }

  public clone<T>(data: T, options: Partial<SerializationOptions> = {}): T {
    try {
      const serialized = this.serialize(data, options);
      return this.deserialize<T>(serialized, options);
    } catch (error) {
      const cloneError = errorHandler.handleError(error, {
        operation: 'clone',
        timestamp: Date.now(),
        additionalInfo: { dataType: typeof data }
      });
      logger.error('Cloning failed', cloneError);
      throw cloneError;
    }
  }

  public validate<T>(data: unknown, schema: Record<string, any>): data is T {
    try {
      return this.validateAgainstSchema(data, schema);
    } catch (error) {
      const validationError = errorHandler.handleError(error, {
        operation: 'validate',
        timestamp: Date.now(),
        additionalInfo: { schema }
      });
      logger.error('Validation failed', validationError);
      return false;
    }
  }

  private getReplacer(options: SerializationOptions): (key: string, value: any) => any {
    const seen = new WeakSet();
    let depth = 0;

    return (key: string, value: any): any => {
      if (typeof value === 'object' && value !== null) {
        if (options.circular) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        if (depth >= options.maxDepth!) {
          return '[Max Depth Reached]';
        }

        depth++;
        const result = Array.isArray(value) ? [] as any[] : {} as Record<string, any>;
        for (const [k, v] of Object.entries(value)) {
          if (Array.isArray(result)) {
            result[Number(k)] = this.getReplacer(options)(k, v);
          } else {
            result[k] = this.getReplacer(options)(k, v);
          }
        }
        depth--;
        return result;
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (value instanceof RegExp) {
        return value.toString();
      }

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }

      return value;
    };
  }

  private getReviver(options: SerializationOptions): (key: string, value: any) => any {
    return (key: string, value: any): any => {
      if (typeof value === 'string') {
        // Try to revive Date objects
        const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        if (dateMatch) {
          return new Date(value);
        }

        // Try to revive RegExp objects
        const regexMatch = value.match(/^\/.*\/[gimuy]*$/);
        if (regexMatch) {
          const [, pattern, flags] = value.match(/^\/(.*)\/([gimuy]*)$/) || [];
          return new RegExp(pattern, flags);
        }
      }

      return value;
    };
  }

  private validateAgainstSchema(data: unknown, schema: Record<string, any>, path: string = ''): boolean {
    if (typeof schema !== 'object' || schema === null) {
      return true;
    }

    if (typeof data !== 'object' || data === null) {
      return typeof data === typeof schema;
    }

    for (const [key, expectedType] of Object.entries(schema)) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = (data as any)[key];

      if (typeof expectedType === 'string') {
        if (typeof value !== expectedType) {
          logger.warn(`Type mismatch at ${currentPath}: expected ${expectedType}, got ${typeof value}`);
          return false;
        }
      } else if (Array.isArray(expectedType)) {
        if (!Array.isArray(value)) {
          logger.warn(`Expected array at ${currentPath}, got ${typeof value}`);
          return false;
        }
        if (expectedType.length > 0) {
          const arrayType = expectedType[0];
          if (!value.every(item => this.validateAgainstSchema(item, arrayType, `${currentPath}[]`))) {
            return false;
          }
        }
      } else if (typeof expectedType === 'object') {
        if (!this.validateAgainstSchema(value, expectedType, currentPath)) {
          return false;
        }
      }
    }

    return true;
  }
}

export const serialization = Serialization.getInstance(); 