export const EVENT_KINDS = {
  SET_METADATA: 0,
  TEXT_NOTE: 1,
  RECOMMEND_SERVER: 2,
  CONTACT_LIST: 3,
  ENCRYPTED_DIRECT_MESSAGE: 4,
  EVENT_DELETION: 5,
  REACTION: 7,
  CHANNEL_CREATION: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_MESSAGE: 42,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTE_USER: 44,
  DAO_CREATION: 100,
  DAO_UPDATE: 101,
  DAO_MEMBER: 102,
  DAO_PROPOSAL: 103,
  DAO_VOTE: 104,
  DAO_EXECUTION: 105,
  DAO_DELETION: 106
} as const;

export type EventKind = typeof EVENT_KINDS[keyof typeof EVENT_KINDS];

export interface NostrEventBase {
  id: string;
  pubkey: string;
  created_at: number;
  kind: EventKind;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrEventMetadata {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  [key: string]: any;
}

export interface NostrEventContact {
  pubkey: string;
  relay?: string;
  petname?: string;
}

export interface NostrEventReaction {
  eventId: string;
  content: string;
}

export interface NostrEventChannel {
  id: string;
  name: string;
  about?: string;
  picture?: string;
  [key: string]: any;
}

export interface NostrEventChannelMessage {
  channelId: string;
  content: string;
  replyTo?: string;
}

export interface NostrEventDAO {
  id: string;
  name: string;
  description: string;
  address: string;
  chainId: number;
  metadata?: Record<string, any>;
}

export interface NostrEventDAOProposal {
  daoId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  quorum: number;
  metadata?: Record<string, any>;
}

export interface NostrEventDAOVote {
  daoId: string;
  proposalId: string;
  vote: boolean;
  reason?: string;
}

export interface NostrEventDAOExecution {
  daoId: string;
  proposalId: string;
  result: boolean;
  metadata?: Record<string, any>;
} 