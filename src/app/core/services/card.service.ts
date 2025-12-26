import { Injectable, signal, computed, effect } from '@angular/core';
import { StorageService } from './storage.service';
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
    const cards = this.cardsSignal();
    const activeProfileId = this.profileService.activeProfileId();
    return cards.filter(c => c.profileId === activeProfileId);
  });

  constructor(
    private storageService: StorageService,
    private profileService: ProfileService
  ) {
    this.initializeCards();
    this.setupAutoSave();
  }

  private initializeCards(): void {
    const loadedCards = this.storageService.getCards();
    const activeProfileId = this.profileService.activeProfileId();
    let cardsChanged = false;

    const migratedCards = loadedCards.map(c => {
      if (!c.profileId) {
        cardsChanged = true;
        return { ...c, profileId: activeProfileId };
      }
      return c;
    });

    if (cardsChanged) {
      this.storageService.saveCards(migratedCards);
    }

    this.cardsSignal.set(migratedCards);
  }

  private setupAutoSave(): void {
    // Auto-save cards when they change
    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveCards(this.cardsSignal());
      }
    });
  }

  addCard(card: Omit<CreditCard, 'id'>): void {
    const newCard: CreditCard = { ...card, id: this.generateId() };
    this.cardsSignal.update(cards => [...cards, newCard]);
  }

  updateCard(id: string, updates: Partial<CreditCard>): void {
    this.cardsSignal.update(cards =>
      cards.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  deleteCard(id: string): boolean {
    if (confirm('Delete this card and all its history?')) {
      this.cardsSignal.update(cards => cards.filter(c => c.id !== id));
      return true;
    }
    return false;
  }

  transferCard(cardId: string, targetProfileId: string): void {
    this.cardsSignal.update(cards =>
      cards.map(c => (c.id === cardId ? { ...c, profileId: targetProfileId } : c))
    );
  }

  getCardsForProfiles(profileIds: string[]): CreditCard[] {
    return this.cardsSignal().filter(c => profileIds.includes(c.profileId));
  }

  getCardById(cardId: string): CreditCard | undefined {
    return this.cardsSignal().find(c => c.id === cardId);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
