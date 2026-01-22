import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Pencil, Plus, Tag, Trash2 } from 'lucide-angular';
import { CategoryService } from '@services';
import type { Category, TransactionType } from '@shared/types';

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './manage-categories.component.html',
})
export class ManageCategoriesComponent {
  @ViewChild('categoryForm', { static: false }) categoryForm!: ElementRef<HTMLDivElement>;
  
  private categoryService = inject(CategoryService);
  
  protected categories = this.categoryService.categories;
  protected showForm = signal(false);
  protected editingCategoryId: string | null = null;
  protected formData: Partial<Category> = {
    name: '',
    type: 'expense',
    color: '#3b82f6',
    icon: '',
  };
  protected filterType = signal<TransactionType | 'all' | 'both'>('all');

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Tag = Tag;

  protected filteredCategories = computed(() => {
    const categories = this.categories();
    const filter = this.filterType();
    
    if (filter === 'all') {
      return categories;
    }
    
    return categories.filter((c) => c.type === filter || c.type === 'both');
  });

  protected onAddCategory(): void {
    if (this.editingCategoryId) {
      this.editingCategoryId = null;
      this.formData = { name: '', type: 'expense', color: '#3b82f6', icon: '' };
      this.showForm.set(false);
      return;
    }
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
      this.formData = { name: '', type: 'expense', color: '#3b82f6', icon: '' };
    }
  }

  protected onEditCategory(category: Category, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingCategoryId = category.id;
    this.formData = {
      name: category.name,
      type: category.type || 'expense',
      color: category.color || '#3b82f6',
      icon: category.icon || '',
    };
    this.showForm.set(true);
    // Scroll to the form element after view updates
    setTimeout(() => {
      if (this.categoryForm) {
        this.categoryForm.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  protected onDeleteCategory(id: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    return this.deleteCategory(id);
  }

  private async deleteCategory(id: string): Promise<void> {
    if (!confirm('Delete this category? Custom categories can be deleted, but default categories cannot.')) {
      return;
    }

    try {
      await this.categoryService.deleteCategory(id);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.message || 'Failed to delete category');
    }
  }

  protected async onSubmitCategory(): Promise<void> {
    if (!this.formData.name || !this.formData.name.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      if (this.editingCategoryId) {
        await this.categoryService.updateCategory(this.editingCategoryId, {
          name: this.formData.name.trim(),
          type: this.formData.type as TransactionType | 'both',
          color: this.formData.color,
          icon: this.formData.icon,
        });
      } else {
        await this.categoryService.addCategory({
          name: this.formData.name.trim(),
          type: (this.formData.type as TransactionType | 'both') || 'expense',
          color: this.formData.color || '#3b82f6',
          icon: this.formData.icon,
        });
      }
      
      this.showForm.set(false);
      this.editingCategoryId = null;
      this.formData = { name: '', type: 'expense', color: '#3b82f6', icon: '' };
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    }
  }


  protected isDefaultCategory(id: string): boolean {
    const defaultIds = [
      'housing', 'transportation', 'food-dining', 'groceries', 'shopping',
      'entertainment', 'healthcare', 'utilities', 'insurance', 'education',
      'personal', 'subscriptions', 'travel', 'gifts',
      'salary', 'business', 'investments', 'freelance', 'other-income',
      'uncategorized',
    ];
    return defaultIds.includes(id);
  }

  protected getIconEmoji(iconName: string): string {
    // Map common icon names to emojis for display
    const iconMap: Record<string, string> = {
      home: '🏠',
      car: '🚗',
      utensils: '🍴',
      'shopping-cart': '🛒',
      'shopping-bag': '🛍️',
      tv: '📺',
      heart: '❤️',
      zap: '⚡',
      shield: '🛡️',
      book: '📚',
      user: '👤',
      'credit-card': '💳',
      plane: '✈️',
      gift: '🎁',
      'dollar-sign': '💰',
      briefcase: '💼',
      'trending-up': '📈',
      laptop: '💻',
      'plus-circle': '➕',
      'help-circle': '❓',
    };
    return iconMap[iconName] || '📁';
  }

  trackCategory = (_: number, category: Category) => category.id;
}
