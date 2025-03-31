import { useCallback } from 'react';
import { useAuth } from './useAuth';

interface NostrEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
  pubkey?: string;
  id?: string;
  sig?: string;
}

interface UseNostrReturn {
  publishEvent: (event: NostrEvent) => Promise<NostrEvent>;
}

export const useNostr = (): UseNostrReturn => {
  const { wallet } = useAuth();

  const publishEvent = useCallback(async (event: NostrEvent): Promise<NostrEvent> => {
    try {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      // Validate event structure
      if (!event.kind || !event.content || !Array.isArray(event.tags)) {
        throw new Error('Invalid event structure');
      }

      // Get the public key from the wallet
      const pubkey = await wallet.getAddress();
      
      // Add required fields
      const nostrEvent: NostrEvent = {
        ...event,
        pubkey,
        created_at: Math.floor(Date.now() / 1000)
      };

      // TODO: Implement actual Nostr event signing and publishing
      // For now, we'll just log the event
      console.log('Publishing Nostr event:', nostrEvent);

      return nostrEvent;
    } catch (error: unknown) {
      console.error('Failed to publish Nostr event:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to publish Nostr event: ${error.message}`);
      }
      throw new Error('Failed to publish Nostr event: Unknown error');
    }
  }, [wallet]);

  return {
    publishEvent
  };
}; 