import { SimplePool, Filter, Event } from 'nostr-tools';
import { retryMechanism } from '../utils/retryMechanism';
import { errorHandler } from '../utils/errorHandler';

export class NostrRelayService {
  private static instance: NostrRelayService;
  private pool: SimplePool;
  private subscriptions: Map<string, any>; // Using any for now as the subscription type has changed
  private relays: string[];

  private constructor(relays: string[] = []) {
    this.relays = relays;
    this.pool = new SimplePool();
    this.subscriptions = new Map();
  }

  public static getInstance(): NostrRelayService {
    if (!NostrRelayService.instance) {
      NostrRelayService.instance = new NostrRelayService();
    }
    return NostrRelayService.instance;
  }

  private loadNostrRelays(): void {
    // Load relay URLs from environment or a configuration
    const relayUrls: string[] = JSON.parse(process.env.REACT_APP_NOSTR_RELAYS || '[]');
    this.relays = relayUrls;
  }

  public async publishInformation(event: Event): Promise<void> {
    try {
      // Publish to each relay individually
      for (const relay of this.relays) {
        await this.pool.publish([relay], event);
      }
    } catch (error) {
      console.error('Error publishing to Nostr relays:', error);
      throw error;
    }
  }

  public subscribeToInformation(filter: Filter, callback: (event: Event) => void): string {
    const subscriptionId = Math.random().toString(36).substring(7);
    
    // Subscribe to all relays at once
    const sub = this.pool.subscribeMany(
      this.relays,
      [filter],
      {
        onevent: (event: Event) => {
          callback(event);
        }
      }
    );

    this.subscriptions.set(subscriptionId, sub);
    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub();
      this.subscriptions.delete(subscriptionId);
    }
  }

  public cleanup(): void {
    // Close all subscriptions
    for (const [_, sub] of this.subscriptions) {
      sub();
    }
    this.subscriptions.clear();
  }
} 