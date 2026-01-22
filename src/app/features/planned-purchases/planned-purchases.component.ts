import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Plus,
  ShoppingBag,
  Trash2,
  Edit2,
  X,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  LucideAngularModule,
} from 'lucide-angular';
import { ProfileService, PlannedPurchaseService, UtilsService, CardService } from '@services';
import { MetricCardComponent, EmptyStateComponent } from '@components';
import type { PlannedPurchase, PaymentMethod } from '@shared/types';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-planned-purchases',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './planned-purchases.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .purchase-card {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .purchase-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .purchase-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }

      .modal-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
    `,
  ],
})
export class PlannedPurchasesComponent {
  readonly Plus = Plus;
  readonly ShoppingBag = ShoppingBag;
  readonly Trash2 = Trash2;
  readonly Edit2 = Edit2;
  readonly X = X;
  readonly DollarSign = DollarSign;
  readonly Calendar = Calendar;
  readonly AlertCircle = AlertCircle;
  readonly CheckCircle2 = CheckCircle2;

  private profileService = inject(ProfileService);
  private purchaseService = inject(PlannedPurchaseService);
  private utils = inject(UtilsService);
  protected cardService = inject(CardService);

  protected activeProfile = this.profileService.activeProfile;

  // Purchases
  protected purchases = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];
    return this.purchaseService.getPurchasesByStatus(profile.id, false);
  });

  protected purchasedItems = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];
    return this.purchaseService.getPurchasesByStatus(profile.id, true);
  });

  // Summary metrics
  protected summary = computed(() => {
    const purchases = this.purchases();
    const totalEstimated = purchases.reduce((sum, p) => sum + p.estimatedCost, 0);
    const needsCount = purchases.filter((p) => p.priority === 'need').length;
    const wantsCount = purchases.filter((p) => p.priority === 'want').length;
    const wishesCount = purchases.filter((p) => p.priority === 'wish').length;

    return {
      totalEstimated,
      totalCount: purchases.length,
      needsCount,
      wantsCount,
      wishesCount,
    };
  });

  // Modal state
  protected showPurchaseModal = signal(false);
  protected editingPurchase = signal<PlannedPurchase | null>(null);
  protected purchaseForm = signal<{
    name: string;
    description: string;
    estimatedCost: string;
    priority: 'need' | 'want' | 'wish';
    targetDate: string;
    category: string;
    notes: string;
    links: string;
    tags: string;
    paymentMethod: 'cash' | 'card' | 'installment' | '';
    installmentMonths: string;
    installmentInterestRate: string;
    cardId: string;
  }>({
    name: '',
    description: '',
    estimatedCost: '',
    priority: 'want',
    targetDate: '',
    category: 'shopping',
    notes: '',
    links: '',
    tags: '',
    paymentMethod: '',
    installmentMonths: '',
    installmentInterestRate: '',
    cardId: '',
  });

  // Purchase modal
  protected showMarkPurchasedModal = signal(false);
  protected markPurchasedForm = signal<{
    actualCost: string;
    purchasedDate: string;
    paymentMethod: PaymentMethod;
    cardId: string;
  }>({
    actualCost: '',
    purchasedDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'cash',
    cardId: '',
  });
  protected markPurchasedId = signal<string>('');

  protected priorityOptions = [
    { value: 'need', label: 'Need', color: '#ef4444' },
    { value: 'want', label: 'Want', color: '#f59e0b' },
    { value: 'wish', label: 'Wish', color: '#8b5cf6' },
  ];

  protected categoryOptions = [
    { value: 'shopping', label: 'Shopping' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'appliances', label: 'Appliances' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'other', label: 'Other' },
  ];

  protected formatCurrency = (amount: number): string => {
    return this.utils.formatCurrency(amount);
  };

  protected format = format;
  protected parseISO = parseISO;

  protected getAffordabilityInfo(purchase: PlannedPurchase) {
    const profile = this.activeProfile();
    if (!profile) return null;
    return this.purchaseService.checkAffordability(purchase, profile.id);
  }

  protected openPurchaseModal(purchase?: PlannedPurchase): void {
    if (purchase) {
      this.editingPurchase.set(purchase);
      this.purchaseForm.set({
        name: purchase.name,
        description: purchase.description || '',
        estimatedCost: purchase.estimatedCost.toString(),
        priority: purchase.priority,
        targetDate: purchase.targetDate || '',
        category: purchase.category,
        notes: purchase.notes || '',
        links: purchase.links.join('\n'),
        tags: purchase.tags.join(', '),
        paymentMethod: purchase.paymentMethod || '',
        installmentMonths: purchase.installmentPlan?.months.toString() || '',
        installmentInterestRate: purchase.installmentPlan?.interestRate?.toString() || '',
        cardId: '',
      });
    } else {
      this.editingPurchase.set(null);
      this.purchaseForm.set({
        name: '',
        description: '',
        estimatedCost: '',
        priority: 'want',
        targetDate: '',
        category: 'shopping',
        notes: '',
        links: '',
        tags: '',
        paymentMethod: '',
        installmentMonths: '',
        installmentInterestRate: '',
        cardId: '',
      });
    }
    this.showPurchaseModal.set(true);
  }

  protected closePurchaseModal(): void {
    this.showPurchaseModal.set(false);
    this.editingPurchase.set(null);
  }

  protected async savePurchase(): Promise<void> {
    const form = this.purchaseForm();
    if (!form.name || !form.estimatedCost) {
      alert('Please enter a name and estimated cost');
      return;
    }

    const estimatedCost = parseFloat(form.estimatedCost);
    if (isNaN(estimatedCost) || estimatedCost <= 0) {
      alert('Please enter a valid estimated cost');
      return;
    }

    const profile = this.activeProfile();
    if (!profile) return;

    const purchaseData: Omit<PlannedPurchase, 'id' | 'isPurchased' | 'createdAt' | 'updatedAt'> = {
      profileId: profile.id,
      name: form.name,
      description: form.description || undefined,
      estimatedCost,
      priority: form.priority,
      targetDate: form.targetDate || undefined,
      category: form.category,
      notes: form.notes,
      links: form.links ? form.links.split('\n').filter((l) => l.trim()) : [],
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter((t) => t) : [],
      paymentMethod: form.paymentMethod || undefined,
      installmentPlan:
        form.paymentMethod === 'installment' && form.installmentMonths
          ? {
              months: parseInt(form.installmentMonths, 10),
              monthlyPayment: estimatedCost / parseInt(form.installmentMonths, 10),
              interestRate: form.installmentInterestRate
                ? parseFloat(form.installmentInterestRate)
                : undefined,
            }
          : undefined,
    };

    if (this.editingPurchase()) {
      await this.purchaseService.updatePurchase(this.editingPurchase()!.id, purchaseData);
    } else {
      await this.purchaseService.createPurchase(purchaseData);
    }

    this.closePurchaseModal();
  }

  protected async deletePurchase(purchaseId: string): Promise<void> {
    if (!confirm('Delete this planned purchase?')) return;
    await this.purchaseService.deletePurchase(purchaseId);
  }

  protected openMarkPurchasedModal(purchase: PlannedPurchase): void {
    this.markPurchasedId.set(purchase.id);
    // Convert PlannedPurchase paymentMethod to PaymentMethod
    const paymentMethod: PaymentMethod = purchase.paymentMethod === 'card' ? 'card' : purchase.paymentMethod === 'installment' ? 'cash' : 'cash';
    this.markPurchasedForm.set({
      actualCost: purchase.estimatedCost.toString(),
      purchasedDate: format(new Date(), 'yyyy-MM-dd'),
      paymentMethod,
      cardId: '',
    });
    this.showMarkPurchasedModal.set(true);
  }

  protected closeMarkPurchasedModal(): void {
    this.showMarkPurchasedModal.set(false);
    this.markPurchasedId.set('');
  }

  protected async markAsPurchased(): Promise<void> {
    const form = this.markPurchasedForm();
    const purchaseId = this.markPurchasedId();
    if (!purchaseId) return;

    const actualCost = parseFloat(form.actualCost);
    if (isNaN(actualCost) || actualCost <= 0) {
      alert('Please enter a valid actual cost');
      return;
    }

    // Convert to PaymentMethod type
    const paymentMethod: PaymentMethod = form.paymentMethod === 'card' ? 'card' : form.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash';
    
    await this.purchaseService.markAsPurchased(
      purchaseId,
      actualCost,
      form.purchasedDate,
      paymentMethod,
      form.cardId || undefined,
    );

    this.closeMarkPurchasedModal();
  }

  protected getPriorityColor(priority: 'need' | 'want' | 'wish'): string {
    const option = this.priorityOptions.find((p) => p.value === priority);
    return option?.color || '#6b7280';
  }

  protected getPriorityLabel(priority: 'need' | 'want' | 'wish'): string {
    const option = this.priorityOptions.find((p) => p.value === priority);
    return option?.label || priority;
  }
}
