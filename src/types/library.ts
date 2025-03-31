export interface LibraryItem {
  id: string;
  title: string;
  description: string;
  contentHash: string;
  timestamp: number;
  author: string;
  tags: string[];
  ipfsHash?: string;
} 