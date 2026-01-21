import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { 
  LucideAngularModule, 
  CreditCard, 
  Calendar, 
  DollarSign,
  FileText
} from 'lucide-angular';
import { 
  AppStateService, 
  ProfileService, 
  CardService, 
  StatementService,
  InstallmentService,
  CashInstallmentService
} from '@services';
import { 
  MetricCardComponent, 
  QuickActionButtonComponent, 
  SectionHeaderComponent,
  EmptyStateComponent
} from '@components';

/**
 * Bills Page Component
 * Focused view for managing credit card bills and installments
 */
@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    MetricCardComponent,
    SectionHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './bills.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BillsComponent {
  readonly CreditCard = CreditCard;
  readonly Calendar = Calendar;
  readonly DollarSign = DollarSign;
  readonly FileText = FileText;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  private installmentService = inject(InstallmentService);
  private cashInstallmentService = inject(CashInstallmentService);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;

  // Calculate bills summary
  protected summary = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return {
        totalDue: 0,
        unpaidCount: 0,
        paidCount: 0,
        totalPaid: 0
      };
    }

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = this.viewDate().toISOString().slice(0, 7);

    let totalDue = 0;
    let unpaidCount = 0;
    let paidCount = 0;
    let totalPaid = 0;

    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement) {
        if (statement.isPaid) {
          paidCount++;
          totalPaid += statement.paidAmount || statement.amount;
        } else {
          unpaidCount++;
          totalDue += statement.amount;
        }
      }
    }

    return { totalDue, unpaidCount, paidCount, totalPaid };
  });

  // Get all bills for current month
  protected bills = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = this.viewDate().toISOString().slice(0, 7);

    return cards
      .map(card => {
        const statement = this.statementService.getStatementForMonth(card.id, monthStr);
        const dueDate = new Date(`${monthStr}-${String(card.dueDay).padStart(2, '0')}`);
        
        return {
          cardId: card.id,
          cardName: `${card.bankName} ${card.cardName}`,
          amount: statement?.amount || 0,
          dueDate,
          isPaid: statement?.isPaid || false,
          hasStatement: !!statement,
          color: card.color
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  });

  protected onMarkAsPaid(cardId: string): void {
    console.log('Mark as paid:', cardId);
  }

  protected onViewDetails(cardId: string): void {
    console.log('View details:', cardId);
  }
}
