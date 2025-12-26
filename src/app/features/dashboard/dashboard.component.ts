import { Component } from '@angular/core';

import { format, isValid, parseISO, setDate } from 'date-fns';
import {
  AppStateService,
  BankBalanceService,
  CardService,
  CashInstallmentService,
  InstallmentService,
  ProfileService,
  StatementService,
  UtilsService,
} from '@services';
import { StatsCardsComponent } from './components/stats-cards.component';
import { BankBalanceToggleComponent } from './components/bank-balance-toggle.component';
import { BillsTableHeaderComponent } from './components/bills-table-header.component';
import { BillsTableComponent, type ColumnVisibilityState, type DashboardRow } from './components/bills-table.component';
import type { SortConfig, Statement } from '@shared/types';

interface BalanceStatus {
  difference: number;
  isEnough: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatsCardsComponent, BankBalanceToggleComponent, BillsTableHeaderComponent, BillsTableComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  dashboardSort: SortConfig = {key: 'dueDate', direction: 'asc'};
  selectedCards = new Set<string>();
  copiedId: string | null = null;
  batchCopied = false;
  bulkSelectMode = false;
  columnVisibility: ColumnVisibilityState = {dueDate: true, amount: true, status: true, billed: true, copy: true};

  constructor(
    private appState: AppStateService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
    private installmentService: InstallmentService,
    private cashInstallmentService: CashInstallmentService,
    private bankBalanceService: BankBalanceService,
    public utils: UtilsService,
  ) {
  }

  get isLoaded(): boolean {
    return this.profileService.isLoaded();
  }

  get viewDate(): Date {
    return this.appState.viewDate();
  }

  get monthKey(): string {
    return format(this.viewDate, 'yyyy-MM');
  }

  get profiles() {
    return this.profileService.profiles();
  }

  get activeProfileId(): string {
    return this.profileService.activeProfileId();
  }

  get multiProfileMode(): boolean {
    return this.appState.multiProfileMode();
  }

  get selectedProfileIds(): string[] {
    return this.appState.selectedProfileIds();
  }

  get bankBalanceTrackingEnabled(): boolean {
    return this.bankBalanceService.bankBalanceTrackingEnabled();
  }

  get cards() {
    return this.cardService.cards();
  }

  get activeCards() {
    return this.cardService.activeCards();
  }

  get visibleCards() {
    if (this.multiProfileMode && this.selectedProfileIds.length > 0) {
      return this.cardService.getCardsForProfiles(this.selectedProfileIds);
    }
    return this.activeCards;
  }

  get statements() {
    return this.statementService.statements();
  }

  get monthlyStatements(): Statement[] {
    return this.statements.filter(s => s.monthStr === this.monthKey);
  }

  get installments() {
    return this.installmentService.installments();
  }

  get activeInstallments() {
    return this.installments
      .map(inst => ({...inst, status: this.utils.getInstallmentStatus(inst, this.viewDate)}))
      .filter(inst => inst.status.isActive);
  }

  get cashInstallments() {
    return this.cashInstallmentService.cashInstallments();
  }

  get activeCashInstallments() {
    return this.cashInstallments.filter(ci => {
      const dueDate = parseISO(ci.dueDate);
      if (!isValid(dueDate)) return false;
      return format(dueDate, 'yyyy-MM') === this.monthKey;
    });
  }

  get sortedDashboardData(): DashboardRow[] {
    const regularCards = this.visibleCards
      .filter(card => !card.isCashCard)
      .map(card => {
        const stmt = this.monthlyStatements.find(s => s.cardId === card.id);
        const defaultDate = setDate(this.viewDate, card.dueDay);
        const displayDate = stmt?.customDueDate ? parseISO(stmt.customDueDate) : defaultDate;
        const cardInstTotal = this.getCardInstallmentTotal(card.id);
        const displayAmount = stmt ? stmt.amount : cardInstTotal;
        const isPaid = stmt?.isPaid || false;
        const profile = this.profiles.find(p => p.id === card.profileId);
        return {
          type: 'card' as const,
          card,
          stmt,
          displayDate,
          displayAmount,
          isPaid,
          cardInstTotal,
          profileName: profile?.name,
        } satisfies DashboardRow & { stmt?: Statement; cardInstTotal: number };
      });

    const dir = this.dashboardSort.direction === 'asc' ? 1 : -1;
    return regularCards.sort((a, b) => {
      switch (this.dashboardSort.key) {
        case 'bankName':
          return a.card.bankName.localeCompare(b.card.bankName) * dir;
        case 'dueDate':
          return (a.displayDate.getTime() - b.displayDate.getTime()) * dir;
        case 'amount':
          return (this.rowAmountNumber(a) - this.rowAmountNumber(b)) * dir;
        case 'status':
          return (Number(a.isPaid) - Number(b.isPaid)) * dir;
        default:
          return 0;
      }
    });
  }

  get totals() {
    const visibleCardIds = new Set(this.visibleCards.map(c => c.id));
    const visibleInstallments = this.activeInstallments.filter(i => visibleCardIds.has(i.cardId));
    const installmentTotal = visibleInstallments.reduce((acc, i) => acc + i.monthlyAmortization, 0);

    let billTotal = 0;
    let unpaidTotal = 0;

    this.visibleCards.forEach(card => {
      const stmt = this.monthlyStatements.find(s => s.cardId === card.id);
      const cardInstTotal = visibleInstallments
        .filter(i => i.cardId === card.id)
        .reduce((acc, i) => acc + i.monthlyAmortization, 0);
      const effectiveAmount = stmt ? stmt.amount : cardInstTotal;
      const amountDue = stmt?.adjustedAmount !== undefined ? stmt.adjustedAmount : effectiveAmount;
      billTotal += effectiveAmount;
      if (!stmt?.isPaid) unpaidTotal += amountDue;
    });

    const visibleCash = this.activeCashInstallments.filter(ci => visibleCardIds.has(ci.cardId));
    const cashTotal = visibleCash.reduce((acc, ci) => acc + ci.amount, 0);
    const unpaidCash = visibleCash.filter(ci => !ci.isPaid).reduce((acc, ci) => acc + ci.amount, 0);
    billTotal += cashTotal;
    unpaidTotal += unpaidCash;

    return {billTotal, unpaidTotal, installmentTotal: installmentTotal + cashTotal};
  }

  get currentBankBalance(): number {
    if (this.multiProfileMode && this.selectedProfileIds.length > 0) {
      const balances = this.bankBalanceService.bankBalances();
      return balances
        .filter(b => this.selectedProfileIds.includes(b.profileId) && b.monthStr === this.monthKey)
        .reduce((acc, b) => acc + b.balance, 0);
    }
    const balance = this.bankBalanceService.getBankBalance(this.activeProfileId, this.monthKey);
    return balance ?? 0;
  }

  get balanceStatus(): BalanceStatus {
    const difference = this.currentBankBalance - this.totals.unpaidTotal;
    return {difference, isEnough: difference >= 0};
  }

  copyCardInfo = async (cardName: string, bankName: string, amountDue: number) => {
    const text = `${bankName} ${cardName}\t${this.utils.formatCurrency(amountDue)}`;
    await navigator.clipboard.writeText(text);
    return text;
  };

  toggleCardSelection(cardId: string): void {
    const next = new Set(this.selectedCards);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    this.selectedCards = next;
  }

  toggleAllCards(): void {
    if (this.selectedCards.size === this.visibleCards.length) {
      this.selectedCards = new Set();
    } else {
      this.selectedCards = new Set(this.visibleCards.map(c => c.id));
    }
  }

  async copySelectedCards(): Promise<void> {
    const lines = this.sortedDashboardData
      .filter(row => this.selectedCards.has(row.card.id))
      .map(row => {
        const stmt = this.monthlyStatements.find(s => s.cardId === row.card.id);
        const effectiveAmount = stmt ? stmt.amount : row.displayAmount;
        const amountDue = stmt?.adjustedAmount !== undefined ? stmt.adjustedAmount : effectiveAmount;
        return `${row.card.bankName} ${row.card.cardName}\t ${this.utils.formatCurrency(amountDue)}`;
      })
      .filter(line => line !== '');

    await navigator.clipboard.writeText(lines.join('\n'));
    this.batchCopied = true;
    setTimeout(() => (this.batchCopied = false), 2000);
  }

  handleSort(key: string): void {
    this.dashboardSort = {
      key,
      direction: this.dashboardSort.key === key && this.dashboardSort.direction === 'asc' ? 'desc' : 'asc',
    };
  }

  handleTogglePaid(cardId: string): void {
    const cardInstTotal = this.getCardInstallmentTotal(cardId);
    const stmt = this.monthlyStatements.find(s => s.cardId === cardId);
    const effectiveAmount = stmt ? stmt.amount : cardInstTotal;
    const amountDue = stmt?.adjustedAmount !== undefined ? stmt.adjustedAmount : effectiveAmount;
    const wasPaid = stmt?.isPaid || false;

    if (this.bankBalanceTrackingEnabled) {
      if (!wasPaid) {
        this.updateBankBalance(this.currentBankBalance - amountDue);
      } else {
        this.updateBankBalance(this.currentBankBalance + amountDue);
      }
    }

    this.statementService.togglePaid(cardId, this.monthKey, cardInstTotal);
  }

  handleToggleCashInstallmentPaid(cashInstallmentId: string): void {
    const cashInst = this.cashInstallments.find(ci => ci.id === cashInstallmentId);
    if (!cashInst) return;

    if (this.bankBalanceTrackingEnabled) {
      const delta = cashInst.isPaid ? cashInst.amount : -cashInst.amount;
      this.updateBankBalance(this.currentBankBalance + delta);
    }

    this.cashInstallmentService.updateCashInstallment(cashInstallmentId, {
      isPaid: !cashInst.isPaid,
    });
  }

  handleExportMonthCSV(): void {
    const headers = ['Card', 'Bank', 'Due Date', 'Statement Balance', 'Amount Due', 'Status', 'Installments Included'];
    const rows = this.visibleCards.map(card => {
      const stmt = this.monthlyStatements.find(s => s.cardId === card.id);
      const defaultDate = setDate(this.viewDate, card.dueDay);
      const displayDate = stmt?.customDueDate ? parseISO(stmt.customDueDate) : defaultDate;
      const formattedDate = isValid(displayDate) ? format(displayDate, 'yyyy-MM-dd') : '';
      const cardInstTotal = this.getCardInstallmentTotal(card.id);
      const displayAmount = stmt ? stmt.amount : cardInstTotal;
      const amountDue = stmt?.adjustedAmount !== undefined ? stmt.adjustedAmount : displayAmount;
      const status = stmt?.isPaid ? 'Paid' : 'Unpaid';
      return [
        `"${card.cardName}"`,
        `"${card.bankName}"`,
        formattedDate,
        displayAmount.toFixed(2),
        amountDue.toFixed(2),
        status,
        cardInstTotal.toFixed(2),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bills-${this.monthKey}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  disableBankBalanceTracking(): void {
    this.bankBalanceService.setBankBalanceTracking(false);
  }

  enableBankBalanceTracking(): void {
    this.bankBalanceService.setBankBalanceTracking(true);
  }

  onBankBalanceChange(balance: number): void {
    this.updateBankBalance(balance);
  }

  setBulkSelectMode(enabled: boolean): void {
    this.bulkSelectMode = enabled;
    if (!enabled) {
      this.selectedCards = new Set();
    }
  }

  setColumnVisibility(state: ColumnVisibilityState): void {
    this.columnVisibility = state;
  }

  setCopiedId(id: string | null): void {
    this.copiedId = id;
  }

  handleToggleBilled(cardId: string): void {
    const stmt = this.monthlyStatements.find(s => s.cardId === cardId);
    if (stmt) {
      const newIsUnbilled = stmt.isUnbilled === false ? true : false;
      this.statementService.updateStatement(cardId, this.monthKey, {isUnbilled: newIsUnbilled});
    }
  }

  private updateBankBalance(balance: number): void {
    if (this.multiProfileMode && this.selectedProfileIds.length > 0) {
      this.bankBalanceService.updateBankBalance(this.selectedProfileIds[0], this.monthKey, balance);
    } else {
      this.bankBalanceService.updateBankBalance(this.activeProfileId, this.monthKey, balance);
    }
  }

  private getCardInstallmentTotal(cardId: string): number {
    return this.activeInstallments
      .filter(i => i.cardId === cardId)
      .reduce((acc, i) => acc + i.monthlyAmortization, 0);
  }

  private rowAmountNumber(row: DashboardRow): number {
    if (row.type === 'card') return row.displayAmount;
    return row.displayAmount;
  }
}
