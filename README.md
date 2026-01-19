# Bills

A personal finance management application built with Angular. Track credit cards, manage installments, monitor bank balances, and sync your data across devices.

## Features

- 📊 **Dashboard**: Overview of your financial status
- 💳 **Credit Cards**: Manage multiple credit cards and their statements
- 📅 **Calendar**: Monthly view of all your bills and installments
- 💰 **Installments**: Track recurring and one-time payments
- 🏦 **Bank Balance**: Monitor your account balances
- 🔄 **Multi-sync Options**:
  - **Firebase Cloud Sync** (Recommended): Real-time sync with authentication
  - **Google Drive Sync**: Manual or automatic backup to Google Drive
  - **Local Sync**: Export/import encrypted files without any account

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

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Future Enhancements

Potential improvements for future iterations:

1. **Conflict Resolution**: Handle simultaneous edits from multiple devices
2. **Sync Status Indicator**: Show sync progress in the app header
3. **Data Versioning**: Track change history
4. **Selective Sync**: Choose which data types to sync
5. **Family Sharing**: Share specific profiles with family members
6. **Export to Firebase Storage**: Store file attachments
7. **Push Notifications**: Notify about upcoming bills
8. **Analytics**: Track usage patterns (privacy-respecting)