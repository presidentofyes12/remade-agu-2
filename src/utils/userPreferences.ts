import { errorHandler } from './errorHandler';
import { logger } from './logger';
import { serialization } from './serialization';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean;
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  display: {
    compactMode: boolean;
    showBalances: boolean;
    showPrices: boolean;
  };
  security: {
    autoLock: boolean;
    lockTimeout: number;
    requirePassword: boolean;
  };
  network: {
    defaultChainId: number;
    customRPCs: Record<string, string>;
  };
  [key: string]: any;
}

export interface PreferencesConfig {
  storageKey?: string;
  defaultPreferences?: Partial<UserPreferences>;
  autoSave?: boolean;
}

export class UserPreferencesManager {
  private static instance: UserPreferencesManager;
  private preferences: UserPreferences;
  private config: PreferencesConfig;
  private listeners: Set<(preferences: UserPreferences) => void>;

  private constructor(config: PreferencesConfig = {}) {
    this.config = {
      storageKey: 'user_preferences',
      autoSave: true,
      ...config
    };
    this.listeners = new Set();
    this.preferences = this.loadPreferences();
  }

  public static getInstance(config?: PreferencesConfig): UserPreferencesManager {
    if (!UserPreferencesManager.instance) {
      UserPreferencesManager.instance = new UserPreferencesManager(config);
    }
    return UserPreferencesManager.instance;
  }

  public getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  public updatePreferences(updates: Partial<UserPreferences>): void {
    try {
      this.preferences = {
        ...this.preferences,
        ...updates
      };

      if (this.config.autoSave) {
        this.savePreferences();
      }

      this.notifyListeners();
    } catch (error) {
      const updateError = errorHandler.handleError(error, {
        operation: 'updatePreferences',
        timestamp: Date.now(),
        additionalInfo: { updates }
      });
      logger.error('Failed to update preferences', updateError);
      throw updateError;
    }
  }

  public resetPreferences(): void {
    try {
      this.preferences = this.getDefaultPreferences();
      this.savePreferences();
      this.notifyListeners();
    } catch (error) {
      const resetError = errorHandler.handleError(error, {
        operation: 'resetPreferences',
        timestamp: Date.now()
      });
      logger.error('Failed to reset preferences', resetError);
      throw resetError;
    }
  }

  public addListener(listener: (preferences: UserPreferences) => void): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: (preferences: UserPreferences) => void): void {
    this.listeners.delete(listener);
  }

  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(this.config.storageKey!);
      if (stored) {
        const parsed = serialization.deserialize<UserPreferences>(stored);
        return this.mergeWithDefaults(parsed);
      }
      return this.getDefaultPreferences();
    } catch (error) {
      const loadError = errorHandler.handleError(error, {
        operation: 'loadPreferences',
        timestamp: Date.now()
      });
      logger.error('Failed to load preferences', loadError);
      return this.getDefaultPreferences();
    }
  }

  private savePreferences(): void {
    try {
      const serialized = serialization.serialize(this.preferences);
      localStorage.setItem(this.config.storageKey!, serialized);
    } catch (error) {
      const saveError = errorHandler.handleError(error, {
        operation: 'savePreferences',
        timestamp: Date.now()
      });
      logger.error('Failed to save preferences', saveError);
      throw saveError;
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      notifications: {
        enabled: true,
        email: true,
        push: true,
        desktop: true
      },
      display: {
        compactMode: false,
        showBalances: true,
        showPrices: true
      },
      security: {
        autoLock: false,
        lockTimeout: 5 * 60 * 1000, // 5 minutes
        requirePassword: true
      },
      network: {
        defaultChainId: 1,
        customRPCs: {}
      },
      ...this.config.defaultPreferences
    };
  }

  private mergeWithDefaults(preferences: Partial<UserPreferences>): UserPreferences {
    const defaults = this.getDefaultPreferences();
    return {
      ...defaults,
      ...preferences,
      notifications: {
        ...defaults.notifications,
        ...preferences.notifications
      },
      display: {
        ...defaults.display,
        ...preferences.display
      },
      security: {
        ...defaults.security,
        ...preferences.security
      },
      network: {
        ...defaults.network,
        ...preferences.network
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getPreferences());
      } catch (error) {
        errorHandler.handleError(error, {
          operation: 'notifyPreferencesListeners',
          timestamp: Date.now()
        });
      }
    });
  }
}

export const userPreferences = UserPreferencesManager.getInstance(); 