import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import type { Category, TransactionType } from '@shared/types';

/**
 * Category Service
 * Manages transaction categories with predefined and custom options
 */
@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private categoriesSignal = signal<Category[]>([]);
  // Public signals
  categories = this.categoriesSignal.asReadonly();
  private isLoadedSignal = signal(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(private idb: IndexedDBService) {
    void this.initializeCategories();
    this.setupAutoSave();
  }

  /**
   * Get all categories
   */
  getCategories(): Category[] {
    return [...this.categoriesSignal()];
  }

  /**
   * Get categories by type
   */
  getCategoriesByType(type: TransactionType | 'both'): Category[] {
    return this.categoriesSignal().filter((c) => c.type === type || c.type === 'both');
  }

  /**
   * Get a category by ID
   */
  getCategory(id: string): Category | undefined {
    return this.categoriesSignal().find((c) => c.id === id);
  }

  /**
   * Add a custom category
   */
  async addCategory(category: Omit<Category, 'id'>): Promise<void> {
    const newCategory: Category = {
      id: this.generateId(),
      ...category,
    };

    this.categoriesSignal.update((prev) => [...prev, newCategory]);
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    this.categoriesSignal.update((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  }

  /**
   * Delete a category (only custom ones)
   */
  async deleteCategory(id: string): Promise<void> {
    // Don't allow deleting default categories
    const category = this.getCategory(id);
    if (!category) return;

    // Check if it's a default category (has no parentId and is in defaults)
    const defaults = this.getDefaultCategories();
    if (defaults.some((d) => d.id === id)) {
      throw new Error('Cannot delete default categories');
    }

    this.categoriesSignal.update((prev) => prev.filter((c) => c.id !== id));
  }

  /**
   * Initialize categories from IndexedDB
   */
  private async initializeCategories(): Promise<void> {
    try {
      const db = this.idb.getDB();
      let categories = await db.getAll<Category>(STORES.CATEGORIES);

      // If no categories exist, create default ones
      if (categories.length === 0) {
        categories = this.getDefaultCategories();
        await db.putAll(STORES.CATEGORIES, categories);
      }

      this.categoriesSignal.set(categories);
      this.isLoadedSignal.set(true);
    } catch (error) {
      console.error('Failed to initialize categories:', error);
      // Load defaults in memory even if DB fails
      this.categoriesSignal.set(this.getDefaultCategories());
      this.isLoadedSignal.set(true);
    }
  }

  /**
   * Auto-save categories when signal changes
   */
  private setupAutoSave(): void {
    effect(() => {
      if (this.isLoadedSignal()) {
        const categories = this.categoriesSignal();
        void this.idb.getDB().putAll(STORES.CATEGORIES, categories);
      }
    });
  }

  /**
   * Get default predefined categories
   */
  private getDefaultCategories(): Category[] {
    return [
      // Expense Categories
      { id: 'housing', name: 'Housing', icon: 'home', color: '#3b82f6', type: 'expense' },
      {
        id: 'transportation',
        name: 'Transportation',
        icon: 'car',
        color: '#8b5cf6',
        type: 'expense',
      },
      {
        id: 'food-dining',
        name: 'Food & Dining',
        icon: 'utensils',
        color: '#f59e0b',
        type: 'expense',
      },
      {
        id: 'groceries',
        name: 'Groceries',
        icon: 'shopping-cart',
        color: '#10b981',
        type: 'expense',
      },
      { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: '#ec4899', type: 'expense' },
      { id: 'entertainment', name: 'Entertainment', icon: 'tv', color: '#6366f1', type: 'expense' },
      { id: 'healthcare', name: 'Healthcare', icon: 'heart', color: '#ef4444', type: 'expense' },
      { id: 'utilities', name: 'Utilities', icon: 'zap', color: '#eab308', type: 'expense' },
      { id: 'insurance', name: 'Insurance', icon: 'shield', color: '#06b6d4', type: 'expense' },
      { id: 'education', name: 'Education', icon: 'book', color: '#14b8a6', type: 'expense' },
      { id: 'personal', name: 'Personal Care', icon: 'user', color: '#a855f7', type: 'expense' },
      {
        id: 'subscriptions',
        name: 'Subscriptions',
        icon: 'credit-card',
        color: '#f97316',
        type: 'expense',
      },
      { id: 'travel', name: 'Travel', icon: 'plane', color: '#0ea5e9', type: 'expense' },
      { id: 'gifts', name: 'Gifts & Donations', icon: 'gift', color: '#f43f5e', type: 'expense' },

      // Income Categories
      { id: 'salary', name: 'Salary', icon: 'dollar-sign', color: '#22c55e', type: 'income' },
      {
        id: 'business',
        name: 'Business Income',
        icon: 'briefcase',
        color: '#3b82f6',
        type: 'income',
      },
      {
        id: 'investments',
        name: 'Investments',
        icon: 'trending-up',
        color: '#10b981',
        type: 'income',
      },
      { id: 'freelance', name: 'Freelance', icon: 'laptop', color: '#8b5cf6', type: 'income' },
      {
        id: 'other-income',
        name: 'Other Income',
        icon: 'plus-circle',
        color: '#06b6d4',
        type: 'income',
      },

      // Uncategorized
      {
        id: 'uncategorized',
        name: 'Uncategorized',
        icon: 'help-circle',
        color: '#6b7280',
        type: 'both',
      },
    ];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
