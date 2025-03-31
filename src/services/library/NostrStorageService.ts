import { ethers } from 'ethers/lib/ethers';
import { getPublicKey, finalizeEvent } from 'nostr-tools/lib/types/pure';
import { SimplePool } from 'nostr-tools';
import type { Event } from 'nostr-tools/lib/types/core';
import type { Filter } from 'nostr-tools/lib/types/filter';
import { ContentMetadata } from './ContentFingerprintService';
import { Publication } from './LibraryService';

export interface NostrPublicationEvent extends Event {
  kind: 30023; // NIP-23: Long-form Content
  pubkey: string;
  created_at: number;
  content: string;
  id: string;
  sig: string;
  tags: [
    ['title', string],
    ['author', string],
    ['mediaType', 'book' | 'article' | 'paper'],
    ['ageRating', string],
    ['privilegeLevel', 'public' | 'restricted' | 'privileged'],
    ['contentHash', string],
    ['merkleRoot', string],
    ...Array<[string, string]>
  ];
}

export interface NostrMetadataEvent extends Event {
  kind: 30024; // Custom kind for publication metadata
  pubkey: string;
  created_at: number;
  content: string;
  id: string;
  sig: string;
  tags: [
    ['publicationId', string],
    ['type', 'author' | 'citation' | 'domain'],
    ['targetId', string],
    ['verified', string],
    ...Array<[string, string]>
  ];
}

export interface NostrAccessEvent extends Event {
  kind: 30025; // Custom kind for access control
  pubkey: string;
  created_at: number;
  content: string;
  id: string;
  sig: string;
  tags: [
    ['publicationId', string],
    ['type', 'age' | 'privilege' | 'role'],
    ['value', string],
    ['issuer', string],
    ['expiry', string],
    ...Array<[string, string]>
  ];
}

export class NostrStorageService {
  private pool: SimplePool;
  private relays: string[];
  private privateKey: Uint8Array;

  constructor(relays: string[], privateKey: string) {
    this.pool = new SimplePool();
    this.relays = relays;
    this.privateKey = ethers.toUtf8Bytes(privateKey);
  }

  /**
   * Update the list of active relays
   */
  updateRelays(relays: string[]): void {
    this.relays = relays;
  }

  /**
   * Store a publication as a Nostr event
   */
  async storePublication(publication: Publication): Promise<string> {
    const event: Event = {
      kind: 30023, // NIP-23: Long-form content
      pubkey: getPublicKey(this.privateKey),
      created_at: Math.floor(publication.metadata.timestamp / 1000),
      tags: [
        ['title', publication.metadata.title],
        ['author', publication.metadata.author],
        ['type', publication.metadata.mediaType],
        ['age', publication.metadata.ageRating.toString()],
        ['privilege', publication.metadata.privilegeLevel],
        ...(publication.metadata.ipfsCid ? [['ipfs', publication.metadata.ipfsCid]] : [])
      ],
      content: publication.content,
      id: '', // Will be set by finalizeEvent
      sig: '' // Will be set by finalizeEvent
    };

    const finalizedEvent = finalizeEvent(event, this.privateKey);
    await this.pool.publish(this.relays, finalizedEvent);
    return finalizedEvent.id;
  }

  /**
   * Update a publication as a Nostr event
   */
  async updatePublication(id: string, publication: Publication): Promise<void> {
    const event: Event = {
      kind: 30023,
      pubkey: getPublicKey(this.privateKey),
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['title', publication.metadata.title],
        ['author', publication.metadata.author],
        ['type', publication.metadata.mediaType],
        ['age', publication.metadata.ageRating.toString()],
        ['privilege', publication.metadata.privilegeLevel],
        ['ipfs', publication.metadata.ipfsCid!],
        ['update', id]
      ],
      content: publication.content,
      id: '', // Will be set by finalizeEvent
      sig: '' // Will be set by finalizeEvent
    };

    const finalizedEvent = finalizeEvent(event, this.privateKey);
    await this.pool.publish(this.relays, finalizedEvent);
  }

  /**
   * Get a publication by its ID
   */
  async getPublication(id: string): Promise<Publication> {
    const filter: Filter = {
      ids: [id],
      kinds: [30023]
    };

    const events = await this.pool.get(this.relays, filter);
    if (!events) {
      throw new Error('Publication not found');
    }

    return {
      content: events.content,
      metadata: {
        title: events.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled',
        author: events.tags.find(tag => tag[0] === 'author')?.[1] || events.pubkey,
        mediaType: events.tags.find(tag => tag[0] === 'type')?.[1] as 'book' | 'article' | 'paper' || 'article',
        timestamp: events.created_at * 1000,
        ageRating: parseInt(events.tags.find(tag => tag[0] === 'age')?.[1] || '18'),
        privilegeLevel: events.tags.find(tag => tag[0] === 'privilege')?.[1] as 'public' | 'restricted' | 'privileged' || 'public',
        ipfsCid: events.tags.find(tag => tag[0] === 'ipfs')?.[1]
      }
    };
  }

  /**
   * Fetch a publication by its ID
   */
  async fetchPublication(id: string): Promise<Event | null> {
    const filter: Filter = {
      ids: [id],
      kinds: [30023]
    };

    return await this.pool.get(this.relays, filter);
  }

  /**
   * Store publication metadata as a Nostr event
   */
  async storeMetadata(
    publicationId: string,
    type: 'author' | 'citation' | 'domain',
    targetId: string,
    verified: boolean
  ): Promise<string> {
    const eventTemplate = {
      kind: 30024,
      pubkey: getPublicKey(this.privateKey),
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['publicationId', publicationId],
        ['type', type],
        ['targetId', targetId],
        ['verified', verified.toString()]
      ],
      content: ''
    };

    const event = finalizeEvent(eventTemplate, this.privateKey);

    // Publish to relays
    await this.pool.publish(this.relays, event);

    return event.id;
  }

  /**
   * Store access control rules as a Nostr event
   */
  async storeAccessRule(
    publicationId: string,
    type: 'age' | 'privilege' | 'role',
    value: string,
    issuer: string,
    expiry?: number
  ): Promise<string> {
    const eventTemplate = {
      kind: 30025,
      pubkey: getPublicKey(this.privateKey),
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['publicationId', publicationId],
        ['type', type],
        ['value', value],
        ['issuer', issuer],
        ['expiry', expiry?.toString() || '']
      ],
      content: ''
    };

    const event = finalizeEvent(eventTemplate, this.privateKey);

    // Publish to relays
    await this.pool.publish(this.relays, event);

    return event.id;
  }

  /**
   * Fetch metadata for a publication
   */
  async fetchMetadata(publicationId: string): Promise<NostrMetadataEvent[]> {
    const filter: Filter = {
      kinds: [30024],
      '#publicationId': [publicationId]
    };

    const events = await this.pool.get(this.relays, filter);
    if (!events) return [];
    return (Array.isArray(events) ? events : [events]).map(event => event as NostrMetadataEvent);
  }

  /**
   * Fetch access rules for a publication
   */
  async fetchAccessRules(publicationId: string): Promise<NostrAccessEvent[]> {
    const filter: Filter = {
      kinds: [30025],
      '#publicationId': [publicationId]
    };

    const events = await this.pool.get(this.relays, filter);
    if (!events) return [];
    return (Array.isArray(events) ? events : [events]).map(event => event as NostrAccessEvent);
  }
} 