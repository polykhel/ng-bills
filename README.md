# ng-bills

A comprehensive personal finance management application built with Angular 21 and Tailwind CSS. Track credit cards, manage installments, monitor bank balances, and sync your data across devices with multiple sync options.

## Current Features

### 📊 Dashboard
- Monthly overview of all bills and financial obligations
- Real-time calculation of total amounts due, unpaid totals, and installment totals
- Bank balance tracking with positive/negative balance indicators
- Quick pay/unpay toggle for statements
- Custom due dates and statement amounts
- Notes field for each statement
- Bulk copy functionality for payment information
- CSV export for monthly statements
- Sortable columns (bank, card, due date, amount, status)
- Column visibility controls

### 💳 Credit Card Management
- Support for multiple credit cards with custom colors
- Track bank name, card name, due day, and cutoff day
- Cash card support (for tracking non-credit-card installments)
- Card transfer between profiles
- Active/inactive card status

### 📅 Calendar View
- Monthly calendar displaying all due dates
- Visual indicators for paid/unpaid bills
- Credit card statements and cash installments on their due dates
- Color-coded by card
- Today's date highlighting

### 💰 Installment Tracking
- **Credit Card Installments**: Track recurring installments tied to credit cards
  - Total principal, number of terms, monthly amortization
  - Automatic calculation of current term based on start date
  - Active/finished/upcoming status indicators
- **Cash Installments**: One-time or recurring payments not tied to credit cards
  - Custom due dates
  - Individual payment tracking
  - Multi-profile support

### 🏦 Bank Balance Monitoring
- Monthly bank balance tracking per profile
- Visual status indicators (positive/negative balance)
- Quick enable/disable toggle
- Balance history

### 👥 Multi-Profile Support
- Create and manage multiple financial profiles
- Switch between profiles easily
- Multi-profile view mode to see combined data
- Profile-specific filtering throughout the app

### 🔄 Data Synchronization
Three flexible sync options to suit your privacy and convenience needs:

- **🔥 Firebase Cloud Sync** (Recommended for most users)
  - Real-time synchronization across devices
  - Email/password or Google authentication
  - Automatic cloud backup
  - Offline support with automatic sync when online
  
- **📁 Local Export/Import**
  - Password-encrypted JSON files
  - No cloud account required
  - Complete data portability
  - Manual backup and restore

### 🔔 Notifications
- Browser notifications for upcoming bills (3 days before due date)
- In-app notification center
- Mark as read/unread functionality
- Auto-dismiss for paid bills

### 🎨 UI/UX Features
- Responsive design (mobile-friendly)
- Dark mode compatible
- Month navigation (previous/next month)
- Lucide icons throughout
- Tailwind CSS styling
- Standalone Angular components

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Angular CLI (`npm install -g @angular/cli`)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure (optional for cloud sync):
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open your browser to `http://localhost:4200/`

## Sync Options

### 🔥 Firebase Cloud Sync (Recommended)

Real-time synchronization with authentication. Your data syncs automatically across all devices.

**Features**:
- Real-time sync across devices
- Secure authentication (email/password or Google)
- Automatic backup to cloud
- Offline support

### ☁️ Google Drive Sync

Manual or scheduled backups to your Google Drive account.

**Features**:
- Manual upload/download
- Auto-sync at set intervals
- Optional encryption
- Stored in hidden or visible Drive folder

### 📁 Local Sync (No Account Required)

Export and import encrypted JSON files. Perfect for complete privacy.

**Features**:
- No cloud account needed
- Password-encrypted files
- Manual file transfer between devices
- Store anywhere (USB, email, cloud storage)

## Development

### Tech Stack
- **Frontend**: Angular 21 (Standalone components)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide Angular
- **Date handling**: date-fns
- **Backend/Sync**: Firebase (Authentication & Firestore)
- **Build**: Angular CLI with Vite
- **State Management**: Angular Signals

### Project Structure
```
src/app/
├── core/services/          # Core business logic services
│   ├── app-state.service.ts      # Global app state
│   ├── profile.service.ts        # Profile management
│   ├── card.service.ts           # Credit card CRUD
│   ├── statement.service.ts      # Monthly statements
│   ├── installment.service.ts    # Installment tracking
│   ├── cash-installment.service.ts
│   ├── bank-balance.service.ts   # Bank balance tracking
│   ├── notification.service.ts   # Notification system
│   ├── sync.service.ts           # Local sync logic
│   ├── firebase-auth.service.ts  # Firebase authentication
│   ├── firebase-sync.service.ts  # Firebase sync logic
│   ├── encryption.service.ts     # Data encryption
│   └── storage.service.ts        # LocalStorage wrapper
├── features/               # Feature modules
│   ├── dashboard/          # Main dashboard view
│   ├── calendar/           # Calendar view
│   ├── manage/             # Card & installment management
│   └── sync/               # Sync & backup interface
├── shared/
│   ├── components/         # Reusable components
│   └── types.ts            # TypeScript interfaces
└── environments/           # Environment configs
```

## Development server

To start a local development server, run:

```bash
npm start
# or
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project for production:

```bash
npm run build
# or
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory with optimizations for performance and speed.

## Testing

To execute unit tests:

```bash
npm test
# or
ng test
```

Uses [Karma](https://karma-runner.github.io) test runner with Jasmine framework.

## Code Formatting

This project uses Prettier for code formatting:

```bash
npx prettier --write .
```

Configuration in [package.json](package.json) (printWidth: 100, singleQuote: true).

## Additional Resources

- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [Angular Signals Documentation](https://angular.dev/guide/signals)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including transaction tracking, budgeting, financial planning, and analytics.