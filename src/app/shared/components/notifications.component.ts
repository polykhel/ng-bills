import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, AlertCircle, CheckCircle, Info, X } from 'lucide-angular';
import { NotificationService, type Notification } from '@core/services';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="notifications-container">
      @for (notification of notificationService.notifications(); track notification.id) {
        <div [class]="'notification notification-' + notification.type">
          <div class="notification-content">
            <div class="notification-icon">
              @switch (notification.type) {
                @case ('warning') {
                  <lucide-icon [img]="AlertTriangle" class="w-5 h-5"></lucide-icon>
                }
                @case ('error') {
                  <lucide-icon [img]="AlertCircle" class="w-5 h-5"></lucide-icon>
                }
                @case ('success') {
                  <lucide-icon [img]="CheckCircle" class="w-5 h-5"></lucide-icon>
                }
                @default {
                  <lucide-icon [img]="Info" class="w-5 h-5"></lucide-icon>
                }
              }
            </div>
            <div class="notification-text">
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-message">{{ notification.message }}</div>
            </div>
          </div>
          @if (notification.dismissible) {
            <button 
              class="notification-close"
              (click)="notificationService.removeNotification(notification.id)"
              aria-label="Close notification">
              <lucide-icon [img]="X" class="w-4 h-4"></lucide-icon>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .notification-info {
      background-color: #ecf0f1;
      border-left: 4px solid #3498db;
      color: #2c3e50;
    }

    .notification-success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      color: #155724;
    }

    .notification-warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      color: #856404;
    }

    .notification-error {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
      color: #721c24;
    }

    .notification-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
    }

    .notification-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
    }

    .notification-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .notification-title {
      font-weight: 600;
      font-size: 14px;
    }

    .notification-message {
      font-size: 13px;
      opacity: 0.85;
    }

    .notification-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }

    @media (max-width: 600px) {
      .notifications-container {
        left: 12px;
        right: 12px;
        max-width: none;
      }
    }
  `]
})
export class NotificationsComponent {
  readonly AlertTriangle = AlertTriangle;
  readonly AlertCircle = AlertCircle;
  readonly CheckCircle = CheckCircle;
  readonly Info = Info;
  readonly X = X;

  constructor(protected notificationService: NotificationService) {}
}
