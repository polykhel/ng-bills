import { computed, Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  dismissible: boolean;
}

/**
 * Service to manage user notifications
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  /**
   * Add a notification
   */
  addNotification(notification: Omit<Notification, 'id'>): string {
    const id = this.generateId();
    const fullNotification: Notification = {
      ...notification,
      id
    };
    this._notifications.update(prev => [...prev, fullNotification]);

    // Auto-dismiss info and success notifications after 5 seconds
    if (notification.type === 'info' || notification.type === 'success') {
      setTimeout(() => this.removeNotification(id), 5000);
    }

    return id;
  }

  /**
   * Show an info notification
   */
  info(title: string, message: string, dismissible = true): string {
    return this.addNotification({
      type: 'info',
      title,
      message,
      dismissible
    });
  }

  /**
   * Show a warning notification
   */
  warning(title: string, message: string, dismissible = true): string {
    return this.addNotification({
      type: 'warning',
      title,
      message,
      dismissible
    });
  }

  /**
   * Show an error notification
   */
  error(title: string, message: string, dismissible = true): string {
    return this.addNotification({
      type: 'error',
      title,
      message,
      dismissible
    });
  }

  /**
   * Show a success notification
   */
  success(title: string, message: string, dismissible = true): string {
    return this.addNotification({
      type: 'success',
      title,
      message,
      dismissible
    });
  }

  /**
   * Remove a notification by ID
   */
  removeNotification(id: string): void {
    this._notifications.update(prev => prev.filter(n => n.id !== id));
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this._notifications.set([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
