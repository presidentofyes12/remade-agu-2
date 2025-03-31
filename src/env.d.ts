interface ImportMetaEnv {
  readonly VITE_NOSTR_RELAYS: string;
  readonly VITE_NOSTR_PUBLIC_KEY: string;
  readonly VITE_CONTRACT_LOGIC_CONSTITUENT: string;
  readonly VITE_CONTRACT_STATE_CONSTITUENT: string;
  readonly VITE_CONTRACT_VIEW_CONSTITUENT: string;
  readonly VITE_CONTRACT_TRIPARTITE_PROXY: string;
  readonly VITE_CONTRACT_DAO_TOKEN: string;
  readonly VITE_CONTRACT_TRIPARTITE_COMPUTATIONS: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_STATE_CONSTITUENT_ADDRESS: string;
  readonly VITE_ADMIN_TOKEN_ALLOCATION_PERCENTAGE: string;
  readonly VITE_RELAY_UPTIME_WEIGHT: string;
  readonly VITE_USERS_SERVED_WEIGHT: string;
  readonly VITE_GOVERNANCE_ACTIVITY_WEIGHT: string;
  readonly VITE_TOKEN_DISTRIBUTION_INTERVAL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 