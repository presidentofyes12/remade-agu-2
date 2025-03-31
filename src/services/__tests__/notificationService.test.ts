import { NotificationService } from '../notificationService';
import { NostrRelayService } from '../nostrRelay';
import { NotificationContract, Notification, NotificationPreferences, NotificationType, NotificationPriority } from '../../types/notifications';

jest.mock('../nostrRelay');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockContract: jest.Mocked<NotificationContract>;
  let mockNostrService: jest.Mocked<NostrRelayService>;
  let mockConfig: NotificationPreferences;

  beforeEach(() => {
    mockContract = {
      createNotification: jest.fn(),
      markAsRead: jest.fn(),
      updatePreferences: jest.fn(),
      getPreferences: jest.fn(),
      getNotification: jest.fn(),
      getUnreadNotifications: jest.fn(),
      getNotificationsByType: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<NotificationContract>;

    mockNostrService = {
      publishInformation: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<NostrRelayService>;

    mockConfig = {
      enabled: true,
      types: {
        keyRotation: { enabled: true, priority: 'high', deliveryMethod: 'both' },
        backupRequest: { enabled: true, priority: 'medium', deliveryMethod: 'nostr' },
        multiSigRequest: { enabled: true, priority: 'high', deliveryMethod: 'both' },
        transactionStatus: { enabled: true, priority: 'low', deliveryMethod: 'inApp' },
        systemAlert: { enabled: true, priority: 'high', deliveryMethod: 'both' }
      },
      quietHours: {
        enabled: false,
        start: 22,
        end: 6
      }
    };

    notificationService = NotificationService.getInstance(mockContract, mockNostrService);
  });

  afterEach(() => {
    notificationService.cleanup();
  });

  it('creates a notification successfully', async () => {
    const mockNotificationId = 'notification-1';
    mockContract.getPreferences.mockResolvedValue(mockConfig);
    mockContract.createNotification.mockResolvedValue(mockNotificationId);

    const result = await notificationService.createNotification(
      'keyRotation',
      'high',
      'Key Rotation Required',
      'Your key will expire in 24 hours',
      { keyId: 'key-1', expiryTime: Date.now() + 86400000 }
    );

    expect(result).toBe(mockNotificationId);
    expect(mockContract.createNotification).toHaveBeenCalledWith(
      'keyRotation',
      'high',
      'Key Rotation Required',
      'Your key will expire in 24 hours',
      expect.any(String)
    );
    expect(mockNostrService.publishInformation).toHaveBeenCalled();
  });

  it('throws error when notifications are disabled', async () => {
    const disabledConfig = { ...mockConfig, enabled: false };
    mockContract.getPreferences.mockResolvedValue(disabledConfig);

    await expect(
      notificationService.createNotification(
        'keyRotation',
        'high',
        'Key Rotation Required',
        'Your key will expire in 24 hours',
        { keyId: 'key-1', expiryTime: Date.now() + 86400000 }
      )
    ).rejects.toThrow('Notifications are disabled');
  });

  it('throws error when notification type is disabled', async () => {
    const disabledTypeConfig = {
      ...mockConfig,
      types: {
        ...mockConfig.types,
        keyRotation: { ...mockConfig.types.keyRotation, enabled: false }
      }
    };
    mockContract.getPreferences.mockResolvedValue(disabledTypeConfig);

    await expect(
      notificationService.createNotification(
        'keyRotation',
        'high',
        'Key Rotation Required',
        'Your key will expire in 24 hours',
        { keyId: 'key-1', expiryTime: Date.now() + 86400000 }
      )
    ).rejects.toThrow('Notifications of type keyRotation are disabled');
  });

  it('throws error during quiet hours', async () => {
    const quietHoursConfig = {
      ...mockConfig,
      quietHours: { ...mockConfig.quietHours, enabled: true }
    };
    mockContract.getPreferences.mockResolvedValue(quietHoursConfig);

    // Mock current hour to be during quiet hours
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);

    await expect(
      notificationService.createNotification(
        'keyRotation',
        'high',
        'Key Rotation Required',
        'Your key will expire in 24 hours',
        { keyId: 'key-1', expiryTime: Date.now() + 86400000 }
      )
    ).rejects.toThrow('Quiet hours are active');
  });

  it('marks a notification as read', async () => {
    const mockTx = {
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ContractTransactionResponse;

    mockContract.markAsRead.mockResolvedValue(mockTx);

    await notificationService.markAsRead('notification-1');

    expect(mockContract.markAsRead).toHaveBeenCalledWith('notification-1');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('updates notification preferences', async () => {
    const mockTx = {
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ContractTransactionResponse;

    mockContract.updatePreferences.mockResolvedValue(mockTx);

    await notificationService.updatePreferences(mockConfig);

    expect(mockContract.updatePreferences).toHaveBeenCalledWith(mockConfig);
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('gets notification preferences from cache when available', async () => {
    // First call to populate cache
    mockContract.getPreferences.mockResolvedValue(mockConfig);
    await notificationService.getPreferences();

    // Second call should use cache
    mockContract.getPreferences.mockClear();
    const result = await notificationService.getPreferences();

    expect(result).toEqual(mockConfig);
    expect(mockContract.getPreferences).not.toHaveBeenCalled();
  });

  it('gets notification from cache when available', async () => {
    const mockNotification: Notification = {
      id: 'notification-1',
      type: 'keyRotation',
      priority: 'high',
      title: 'Key Rotation Required',
      message: 'Your key will expire in 24 hours',
      timestamp: BigInt(Date.now()),
      read: false,
      metadata: { keyId: 'key-1', expiryTime: Date.now() + 86400000 }
    };

    // First call to populate cache
    mockContract.getNotification.mockResolvedValue(mockNotification);
    await notificationService.getNotification('notification-1');

    // Second call should use cache
    mockContract.getNotification.mockClear();
    const result = await notificationService.getNotification('notification-1');

    expect(result).toEqual(mockNotification);
    expect(mockContract.getNotification).not.toHaveBeenCalled();
  });

  it('gets unread notifications', async () => {
    const mockUnreadIds = ['notification-1', 'notification-2'];
    mockContract.getUnreadNotifications.mockResolvedValue(mockUnreadIds);

    const result = await notificationService.getUnreadNotifications();

    expect(result).toEqual(mockUnreadIds);
    expect(mockContract.getUnreadNotifications).toHaveBeenCalled();
  });

  it('gets notifications by type', async () => {
    const mockNotificationIds = ['notification-1', 'notification-2'];
    mockContract.getNotificationsByType.mockResolvedValue(mockNotificationIds);

    const result = await notificationService.getNotificationsByType('keyRotation');

    expect(result).toEqual(mockNotificationIds);
    expect(mockContract.getNotificationsByType).toHaveBeenCalledWith('keyRotation');
  });

  it('maintains singleton instance', () => {
    const instance1 = NotificationService.getInstance(mockContract, mockNostrService);
    const instance2 = NotificationService.getInstance(mockContract, mockNostrService);

    expect(instance1).toBe(instance2);
  });
}); 