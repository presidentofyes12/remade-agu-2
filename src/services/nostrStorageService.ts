import { LibraryItem } from './libraryService';

export class NostrStorageService {
  private storage: Map<string, LibraryItem>;

  constructor() {
    this.storage = new Map();
  }

  async storeLibraryItem(item: LibraryItem): Promise<void> {
    try {
      this.storage.set(item.id, item);
    } catch (error) {
      console.error('Error storing library item:', error);
      throw error;
    }
  }

  async updateLibraryItem(item: LibraryItem): Promise<void> {
    try {
      if (!this.storage.has(item.id)) {
        throw new Error('Item not found');
      }
      this.storage.set(item.id, item);
    } catch (error) {
      console.error('Error updating library item:', error);
      throw error;
    }
  }

  async getLibraryItem(id: string): Promise<LibraryItem | null> {
    try {
      return this.storage.get(id) || null;
    } catch (error) {
      console.error('Error getting library item:', error);
      throw error;
    }
  }

  async listLibraryItems(tags?: string[]): Promise<LibraryItem[]> {
    try {
      const items = Array.from(this.storage.values());
      
      if (!tags || tags.length === 0) {
        return items;
      }

      return items.filter(item => 
        tags.some(tag => item.tags.includes(tag))
      );
    } catch (error) {
      console.error('Error listing library items:', error);
      throw error;
    }
  }

  async deleteLibraryItem(id: string): Promise<void> {
    try {
      this.storage.delete(id);
    } catch (error) {
      console.error('Error deleting library item:', error);
      throw error;
    }
  }
} 