import { BaseContract } from './contracts';
import { ethers } from 'ethers';

export type NotificationType = 
  | 'keyRotation'
  | 'backupRequest'
  | 'multiSigRequest'
  | 'transactionStatus'
  | 'systemAlert';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: bigint;
  read: boolean;
  metadata: {
    [key: string]: any;
  };
}

export interface NotificationPreferences {
  enabled: boolean;
  types: {
    [key in NotificationType]: {
      enabled: boolean;
      priority: NotificationPriority;
      deliveryMethod: 'nostr' | 'inApp' | 'both';
    };
  };
  quietHours: {
    enabled: boolean;
    start: number; // Hour in 24-hour format (0-23)
    end: number; // Hour in 24-hour format (0-23)
  };
}

export interface NotificationEvents {
  NotificationCreated: {
    id: string;
    type: NotificationType;
    priority: NotificationPriority;
    timestamp: bigint;
  };
  NotificationRead: {
    id: string;
    readAt: bigint;
  };
  PreferencesUpdated: {
    preferences: NotificationPreferences;
    updatedAt: bigint;
  };
}

export interface NotificationContract extends BaseContract {
  // Notification Management
  createNotification(
    type: NotificationType,
    priority: NotificationPriority,
    title: string,
    message: string,
    metadata: string
  ): Promise<string>;
  
  markAsRead(notificationId: string): Promise<ethers.ContractTransactionResponse>;
  
  // Preferences Management
  updatePreferences(preferences: NotificationPreferences): Promise<ethers.ContractTransactionResponse>;
  getPreferences(): Promise<NotificationPreferences>;
  
  // Query Functions
  getNotification(id: string): Promise<Notification>;
  getUnreadNotifications(): Promise<string[]>;
  getNotificationsByType(type: NotificationType): Promise<string[]>;
  
  // Event Listeners
  on<K extends keyof NotificationEvents>(
    event: K,
    listener: (event: NotificationEvents[K]) => void
  ): Promise<this>;
  
  off<K extends keyof NotificationEvents>(
    event: K,
    listener: (event: NotificationEvents[K]) => void
  ): Promise<this>;
} 