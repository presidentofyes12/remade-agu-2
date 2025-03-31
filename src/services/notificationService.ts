import { ethers } from 'ethers';
import { 
  NotificationContract, 
  Notification, 
  NotificationPreferences, 
  NotificationEvents,
  NotificationType,
  NotificationPriority
} from '../types/notifications';
import { NostrRelayService } from './nostrRelay';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export class NotificationService {
  private static instance: NotificationService;
  private contract: NotificationContract;
  private nostrService: NostrRelayService;
  private eventListeners: Map<keyof NotificationEvents, Set<(event: NotificationEvents[keyof NotificationEvents]) => void>>;
  private notificationCache: Map<string, Notification>;
  private preferencesCache: NotificationPreferences | null;

  private constructor(
    contract: NotificationContract,
    nostrService: NostrRelayService
  ) {
    this.contract = contract;
    this.nostrService = nostrService;
    this.eventListeners = new Map();
    this.notificationCache = new Map();
    this.preferencesCache = null;
    this.setupEventListeners();
  }

  public static getInstance(
    contract: NotificationContract,
    nostrService: NostrRelayService
  ): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(contract, nostrService);
    }
    return NotificationService.instance;
  }

  private setupEventListeners(): void {
    // Handle notification creation
    this.contract.on('NotificationCreated', (event: NotificationEvents['NotificationCreated']) => {
      const listeners = this.eventListeners.get('NotificationCreated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateNotificationCache(event.id);
    });

    // Handle notification read status
    this.contract.on('NotificationRead', (event: NotificationEvents['NotificationRead']) => {
      const listeners = this.eventListeners.get('NotificationRead');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateNotificationCache(event.id);
    });

    // Handle preferences updates
    this.contract.on('PreferencesUpdated', (event: NotificationEvents['PreferencesUpdated']) => {
      const listeners = this.eventListeners.get('PreferencesUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.preferencesCache = event.preferences;
    });
  }

  private invalidateNotificationCache(notificationId: string): void {
    this.notificationCache.delete(notificationId);
  }

  public async createNotification(
    type: NotificationType,
    priority: NotificationPriority,
    title: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<string> {
    try {
      const preferences = await this.getPreferences();
      
      // Check if notifications are enabled
      if (!preferences.enabled) {
        throw new Error('Notifications are disabled');
      }

      // Check if this notification type is enabled
      if (!preferences.types[type].enabled) {
        throw new Error(`Notifications of type ${type} are disabled`);
      }

      // Check quiet hours
      if (preferences.quietHours.enabled) {
        const currentHour = new Date().getHours();
        if (currentHour >= preferences.quietHours.start && currentHour < preferences.quietHours.end) {
          throw new Error('Quiet hours are active');
        }
      }

      const { result } = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.createNotification(
          type,
          priority,
          title,
          message,
          JSON.stringify(metadata)
        );
      });

      if (!result) {
        throw new Error('Failed to create notification');
      }

      // Send off-chain notification if configured
      if (preferences.types[type].deliveryMethod === 'nostr' || preferences.types[type].deliveryMethod === 'both') {
        await this.sendOffChainNotification(result, type, priority, title, message, metadata);
      }

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.createNotification',
        timestamp: Date.now(),
        additionalInfo: {
          type: 'notification',
          title: title,
          message: message
        }
      });
      throw error;
    }
  }

  private async sendOffChainNotification(
    id: string,
    type: NotificationType,
    priority: NotificationPriority,
    title: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const content = {
        id,
        type,
        priority,
        title,
        message,
        metadata,
        timestamp: Date.now()
      };

      await this.nostrService.publishInformation(
        JSON.stringify(content),
        id,
        priority === 'high' ? 'global' : priority === 'medium' ? 'regional' : 'local'
      );
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.sendOffChainNotification',
        timestamp: Date.now(),
        additionalInfo: {
          type: 'notification',
          id: id,
          priority: priority,
          title: title,
          message: message
        }
      });
      // Don't throw here as this is a non-critical operation
    }
  }

  public async markAsRead(notificationId: string): Promise<void> {
    try {
      await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.markAsRead(notificationId);
        await tx.wait();
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.markAsRead',
        timestamp: Date.now(),
        additionalInfo: {
          notificationId: notificationId
        }
      });
      throw error;
    }
  }

  public async updatePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updatePreferences(preferences);
        await tx.wait();
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.updatePreferences',
        timestamp: Date.now(),
        additionalInfo: {
          preferences: preferences
        }
      });
      throw error;
    }
  }

  public async getPreferences(): Promise<NotificationPreferences> {
    try {
      // Check cache first
      if (this.preferencesCache) {
        return this.preferencesCache;
      }

      const { result } = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.getPreferences();
      });

      if (!result) {
        throw new Error('Failed to get notification preferences');
      }

      // Cache the result
      this.preferencesCache = result;
      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.getPreferences',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async getNotification(id: string): Promise<Notification> {
    try {
      // Check cache first
      const cached = this.notificationCache.get(id);
      if (cached) {
        return cached;
      }

      const { result } = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.getNotification(id);
      });

      if (!result) {
        throw new Error('Failed to get notification');
      }

      // Cache the result
      this.notificationCache.set(id, result);
      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.getNotification',
        timestamp: Date.now(),
        additionalInfo: {
          notificationId: id
        }
      });
      throw error;
    }
  }

  public async getUnreadNotifications(): Promise<string[]> {
    try {
      const { result } = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.getUnreadNotifications();
      });

      if (!result) {
        throw new Error('Failed to get unread notifications');
      }

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.getUnreadNotifications',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async getNotificationsByType(type: NotificationType): Promise<string[]> {
    try {
      const { result } = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.getNotificationsByType(type);
      });

      if (!result) {
        throw new Error('Failed to get notifications by type');
      }

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'NotificationService.getNotificationsByType',
        timestamp: Date.now(),
        additionalInfo: {
          type: type
        }
      });
      throw error;
    }
  }

  public on<K extends keyof NotificationEvents>(
    event: K,
    listener: (event: NotificationEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: NotificationEvents[keyof NotificationEvents]) => void);
  }

  public off<K extends keyof NotificationEvents>(
    event: K,
    listener: (event: NotificationEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: NotificationEvents[keyof NotificationEvents]) => void);
  }

  public cleanup(): void {
    // Clear all caches
    this.notificationCache.clear();
    this.preferencesCache = null;
  }
} 