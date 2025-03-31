import { KeyRotationService } from '../keyRotationService';
import { PrivacyService } from '../privacyService';
import { KeyPair } from '../../types/privacy';

jest.mock('../privacyService');

describe('KeyRotationService', () => {
  let keyRotationService: KeyRotationService;
  let mockPrivacyService: jest.Mocked<PrivacyService>;
  let mockKeyPair: KeyPair;

  beforeEach(() => {
    jest.useFakeTimers();
    mockPrivacyService = {
      generateKeyPair: jest.fn(),
      createSecondaryKey: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<PrivacyService>;

    mockKeyPair = {
      publicKey: '0xabc',
      privateKey: '0xdef'
    };

    keyRotationService = KeyRotationService.getInstance(mockPrivacyService, {
      rotationPeriod: BigInt(3600), // 1 hour
      warningPeriod: BigInt(1800), // 30 minutes
      maxActiveKeys: 5
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    keyRotationService.cleanup();
  });

  it('initializes key rotation with timers', async () => {
    await keyRotationService.initializeKeyRotation(mockKeyPair);

    // Fast forward to warning period
    jest.advanceTimersByTime(1800000); // 30 minutes

    // Fast forward to rotation period
    jest.advanceTimersByTime(1800000); // 30 minutes

    expect(mockPrivacyService.generateKeyPair).toHaveBeenCalled();
  });

  it('rotates key when expiration warning is triggered', async () => {
    const newKeyPair = {
      publicKey: '0x123',
      privateKey: '0x456'
    };

    mockPrivacyService.generateKeyPair.mockResolvedValue(newKeyPair);

    await keyRotationService.initializeKeyRotation(mockKeyPair);

    // Fast forward to warning period
    jest.advanceTimersByTime(1800000); // 30 minutes

    expect(mockPrivacyService.generateKeyPair).toHaveBeenCalled();
    expect(mockPrivacyService.createSecondaryKey).toHaveBeenCalled();
  });

  it('cleans up timers when rotating keys', async () => {
    await keyRotationService.initializeKeyRotation(mockKeyPair);

    const newKeyPair = {
      publicKey: '0x123',
      privateKey: '0x456'
    };

    mockPrivacyService.generateKeyPair.mockResolvedValue(newKeyPair);

    await keyRotationService.rotateKey(mockKeyPair);

    // Fast forward to original rotation time
    jest.advanceTimersByTime(3600000); // 1 hour

    // Should not trigger rotation again
    expect(mockPrivacyService.generateKeyPair).toHaveBeenCalledTimes(1);
  });

  it('handles errors during key rotation', async () => {
    mockPrivacyService.generateKeyPair.mockRejectedValue(new Error('Failed to generate key'));

    await expect(keyRotationService.rotateKey(mockKeyPair)).rejects.toThrow('Failed to generate key');
  });

  it('handles errors during initialization', async () => {
    mockPrivacyService.generateKeyPair.mockRejectedValue(new Error('Failed to initialize'));

    await expect(keyRotationService.initializeKeyRotation(mockKeyPair)).rejects.toThrow('Failed to initialize');
  });

  it('maintains singleton instance', () => {
    const instance1 = KeyRotationService.getInstance(mockPrivacyService, {
      rotationPeriod: BigInt(3600),
      warningPeriod: BigInt(1800),
      maxActiveKeys: 5
    });

    const instance2 = KeyRotationService.getInstance(mockPrivacyService, {
      rotationPeriod: BigInt(3600),
      warningPeriod: BigInt(1800),
      maxActiveKeys: 5
    });

    expect(instance1).toBe(instance2);
  });
}); 