import { computed, effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import type { CreditCard } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private cardsSignal = signal<CreditCard[]>([]);

  // Public signals
  cards = this.cardsSignal.asReadonly();

  // Computed active cards (cards for current profile)
  activeCards = computed(() => {
    const cards = this.cardsSignal().sort(
      (c1, c2) => c1.bankName.localeCompare(c2.bankName) || c1.cardName.localeCompare(c2.cardName),
    );
    const activeProfileId = this.profileService.activeProfileId();
    return cards.filter((c) => c.profileId === activeProfileId);
  });

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
  ) {
    void this.initializeCards();
    this.setupAutoSave();
  }

  addCard(card: Omit<CreditCard, 'id'>): void {
    const newCard: CreditCard = { ...card, id: this.generateId() };
    this.cardsSignal.update((cards) => [...cards, newCard]);
  }

  updateCard(id: string, updates: Partial<CreditCard>): void {
    this.cardsSignal.update((cards) => cards.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  deleteCard(id: string): boolean {
    if (confirm('Delete this card and all its history?')) {
      this.cardsSignal.update((cards) => cards.filter((c) => c.id !== id));
      return true;
    }
    return false;
  }

  transferCard(cardId: string, targetProfileId: string): void {
    this.cardsSignal.update((cards) =>
      cards.map((c) => (c.id === cardId ? { ...c, profileId: targetProfileId } : c)),
    );
  }

  getCardsForProfiles(profileIds: string[]): CreditCard[] {
    return this.cardsSignal()
      .filter((c) => profileIds.includes(c.profileId))
      .sort(
        (c1, c2) =>
          c1.bankName.localeCompare(c2.bankName) || c1.cardName.localeCompare(c2.cardName),
      );
  }

  getCardById(cardId: string): CreditCard | undefined {
    return this.cardsSignal().find((c) => c.id === cardId);
  }

  /**
   * Synchronous version of getCardById for use in services
   * Returns card from current signal state
   */
  getCardSync(cardId: string): CreditCard | undefined {
    return this.cardsSignal().find((c) => c.id === cardId);
  }

  private async initializeCards(): Promise<void> {
    const db = this.idb.getDB();
    const loadedCards = await db.getAll<CreditCard>(STORES.CARDS);
    const activeProfileId = this.profileService.activeProfileId();
    let cardsChanged = false;

    const migratedCards = loadedCards.map((c) => {
      if (!c.profileId) {
        cardsChanged = true;
        return { ...c, profileId: activeProfileId };
      }
      return c;
    });

    if (cardsChanged) {
      await db.putAll(STORES.CARDS, migratedCards);
    }

    this.cardsSignal.set(migratedCards);
  }

  private setupAutoSave(): void {
    // Auto-save cards when they change
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.CARDS, this.cardsSignal());
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
