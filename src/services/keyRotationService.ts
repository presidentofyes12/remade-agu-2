import { ethers } from 'ethers';
import { PrivacyService } from './privacyService';
import { KeyPair, SecondaryKeyMapping } from '../types/privacy';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

interface KeyRotationConfig {
  rotationPeriod: bigint; // Time between key rotations in seconds
  warningPeriod: bigint; // Time before expiration to start warning in seconds
  maxActiveKeys: number; // Maximum number of active secondary keys per primary key
}

export class KeyRotationService {
  private static instance: KeyRotationService;
  private privacyService: PrivacyService;
  private config: KeyRotationConfig;
  private rotationTimers: Map<string, NodeJS.Timeout>;
  private warningTimers: Map<string, NodeJS.Timeout>;

  private constructor(
    privacyService: PrivacyService,
    config: KeyRotationConfig
  ) {
    this.privacyService = privacyService;
    this.config = config;
    this.rotationTimers = new Map();
    this.warningTimers = new Map();
  }

  public static getInstance(
    privacyService: PrivacyService,
    config: KeyRotationConfig
  ): KeyRotationService {
    if (!KeyRotationService.instance) {
      KeyRotationService.instance = new KeyRotationService(privacyService, config);
    }
    return KeyRotationService.instance;
  }

  public async initializeKeyRotation(primaryKey: KeyPair): Promise<void> {
    try {
      // Clear any existing timers for this key
      this.clearKeyTimers(primaryKey.publicKey);

      // Schedule rotation based on expiration period
      const rotationTimer = setTimeout(async () => {
        await this.rotateKey(primaryKey);
      }, Number(this.config.rotationPeriod) * 1000);

      // Schedule warning before expiration
      const warningTimer = setTimeout(async () => {
        await this.handleKeyExpirationWarning(primaryKey);
      }, Number(this.config.rotationPeriod - this.config.warningPeriod) * 1000);

      this.rotationTimers.set(primaryKey.publicKey, rotationTimer);
      this.warningTimers.set(primaryKey.publicKey, warningTimer);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async rotateKey(primaryKey: KeyPair): Promise<void> {
    try {
      // Generate new key pair
      const newKeyPair = await this.privacyService.generateKeyPair();

      // Get current secondary keys
      const currentMappings = await this.getActiveSecondaryKeys(primaryKey.publicKey);

      // Create new mappings for each active secondary key
      for (const mapping of currentMappings) {
        await this.privacyService.createSecondaryKey(
          ethers.keccak256(ethers.toUtf8Bytes(newKeyPair.publicKey)),
          mapping.secondaryKeyHash
        );
      }

      // Update timers for the new key
      await this.initializeKeyRotation(newKeyPair);

      // Clean up old key timers
      this.clearKeyTimers(primaryKey.publicKey);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async handleKeyExpirationWarning(primaryKey: KeyPair): Promise<void> {
    try {
      // Get active secondary keys
      const activeKeys = await this.getActiveSecondaryKeys(primaryKey.publicKey);

      // Check if we need to rotate keys
      if (activeKeys.length >= this.config.maxActiveKeys) {
        await this.rotateKey(primaryKey);
      }

      // Emit warning event (to be handled by UI)
      // This would be implemented through an event system
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async getActiveSecondaryKeys(primaryKeyHash: string): Promise<SecondaryKeyMapping[]> {
    try {
      // In a real implementation, this would fetch active secondary keys from the contract
      // For now, we'll return an empty array
      return [];
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private clearKeyTimers(primaryKeyHash: string): void {
    const rotationTimer = this.rotationTimers.get(primaryKeyHash);
    const warningTimer = this.warningTimers.get(primaryKeyHash);

    if (rotationTimer) {
      clearTimeout(rotationTimer);
      this.rotationTimers.delete(primaryKeyHash);
    }

    if (warningTimer) {
      clearTimeout(warningTimer);
      this.warningTimers.delete(primaryKeyHash);
    }
  }

  public cleanup(): void {
    // Clear all timers
    for (const [primaryKeyHash] of this.rotationTimers) {
      this.clearKeyTimers(primaryKeyHash);
    }
  }
} 