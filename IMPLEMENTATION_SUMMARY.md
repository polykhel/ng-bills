# ng-bills Implementation Summary

## Overview
ng-bills is a personal finance management application built with Angular 21, Tailwind CSS, and IndexedDB for local-first storage. The app has recently transitioned from a statement-based view to a **transaction-first model** that bridges the gap between "the moment I swiped" (transaction entry) and "the moment the bill is due" (statement view).

## Architecture

### Tech Stack
- **Frontend**: Angular 21 with standalone components
- **State Management**: Angular Signals (reactive state)
- **Styling**: Tailwind CSS 4
- **Storage**: IndexedDB (local-first) with optional Firebase Firestore sync
- **Date Handling**: date-fns
- **Icons**: Lucide Angular
- **Build**: Angular CLI with Vite

### Core Principles
1. **Transactions-first**: Every money movement is a transaction; other views are aggregations
2. **Local-first**: IndexedDB for primary storage, Firebase sync is optional
3. **Cutoff-aware billing**: Credit card statements calculated based on cutoff days, not calendar months
4. **Three-bucket model**: Transactions categorized as Direct Expense, Recurring Bill, or Installment

## Data Model

### Core Entities

#### Transaction
The foundation of the system. Every financial activity is a transaction:
- **Types**: `income` | `expense`
- **Payment Methods**: `cash` | `card` | `bank_transfer` | `bank_to_bank` | `other`
- **Recurring Support**: Can be marked as recurring with `RecurringRule`
- **Parent/Virtual System**: For installments, parent transaction stores total principal (non-budget impacting), virtual transactions represent monthly payments (budget impacting)
- **Budget Impact Flag**: `isBudgetImpacting` controls whether transaction counts in budget calculations
- **Auto-linking**: Card transactions automatically create/update statements based on cutoff day logic

#### Statement
Monthly credit card bills auto-generated from transactions:
- Linked to a `CreditCard` and `monthStr` (yyyy-MM format)
- Amount calculated from transactions in the statement period
- Cutoff-aware: Statement period = previous month's cutoff day to current month's (cutoff day - 1)
- Supports manual creation/editing
- Payment tracking with multiple payment records

#### CreditCard
- Tracks `dueDay` (when bill is due) and `cutoffDay` (statement cycle boundary)
- Custom colors for visual organization
- Can be marked as cash card (for non-credit-card installments)
- Multi-profile support

#### Profile
- Multiple financial profiles supported
- Each profile has its own cards, transactions, statements, budgets
- Multi-profile view mode for combined data

### Transaction Buckets (Three Categories)

1. **Direct Expense**: Cash/Debit/One-time CC charges
   - One-time transactions
   - Immediate budget impact
   - Category, Date, Amount

2. **Recurring Bill**: Fixed monthly costs (Netflix, Internet, subscriptions)
   - `isRecurring: true` with `recurringRule.type: 'subscription' | 'custom'`
   - Repeats on schedule
   - Due Date, Status (Paid/Unpaid)

3. **Installment**: Long-tail items with terms
   - `isRecurring: true` with `recurringRule.type: 'installment'`
   - Parent transaction: Total principal amount (non-budget impacting)
   - Virtual transactions: Auto-generated monthly payments (budget impacting)
   - Term tracking (X/Y), Monthly Principal, Interest

## Key Services

### TransactionService
- CRUD operations for transactions
- **Auto-bill creation**: When card transaction added, automatically creates/updates statement
- **Cutoff-aware logic**: Determines which statement month a transaction belongs to
- **Virtual transaction generation**: Creates monthly payment transactions for installments
- Signal-based reactive state

### TransactionBucketService
- Categorizes transactions into three buckets
- Calculates statement periods based on cutoff days
- **Buffer calculation**: Total Balance - Total Credit Card Debt (highlights danger zone)
- Auto-incrementing term calculation for installments
- Parent/virtual transaction helpers

### StatementService
- Manages credit card statements
- Payment recording with multiple payment support
- Statement lookup by card + month
- Signal-based reactive state

### CardService
- Credit card CRUD operations
- Profile-based filtering
- Active/inactive status

### BankBalanceService
- Monthly balance tracking per profile
- Account-level balance tracking
- Total balance calculation

### ProfileService
- Multi-profile management
- Active profile selection
- Profile switching

## User Interface & Navigation

### Primary Routes
1. **Overview** (`/overview`) - Financial dashboard
   - Key metrics (available balance, total balance, committed balance)
   - Monthly cash flow (income vs expenses)
   - Upcoming bills widget
   - Recent transactions
   - Budget summary

2. **Transactions** (`/transactions`) - Transaction management
   - **Dual-view system**:
     - **Cash Flow View**: Shows budget-impacting transactions (real-time spending)
     - **Statement Prep View**: Shows transactions grouped by statement cycle
   - Add/edit/delete transactions
   - Filtering (type, payment method, card, date range, search)
   - Bucket badges (Direct Expense, Recurring Bill, Installment)
   - Virtual transaction indicators
   - Buffer calculation display (danger zone warning)
   - Bank balance management

3. **Bills** (`/bills`) - Credit card statements
   - Auto-generated bills from transactions
   - Manual bill creation/editing
   - Payment recording
   - Transaction breakdown per bill
   - Bulk copy functionality
   - Statement period display

4. **Budget** (`/budget`) - Budget management
   - Category-based allocations
   - Real-time spending tracking
   - Progress indicators
   - Rollover settings

5. **Calendar** (`/calendar`) - Due date visualization
   - Monthly calendar view
   - Color-coded by card
   - Paid/unpaid indicators

6. **Manage** (`/manage`) - Configuration
   - Credit card management
   - Installment management
   - Category management

7. **Sync** (`/sync`) - Data synchronization
   - Firebase cloud sync
   - Local export/import (encrypted)
   - Sync status

8. **Savings Goals** (`/savings-goals`) - Goal tracking
9. **Planned Purchases** (`/planned-purchases`) - Purchase planning
10. **Loan Planning** (`/loan-planning`) - Loan affordability analysis

## Key Features & Flows

### Transaction Entry Flow
1. User adds transaction in Transactions page
2. If payment method is `card`:
   - System determines statement month using cutoff day logic
   - Auto-creates or updates statement
   - Transaction linked to statement
3. If transaction is installment:
   - Parent transaction created with total principal (non-budget impacting)
   - Virtual transactions auto-generated for each term (budget impacting)
   - Each virtual transaction appears in monthly statement view

### Statement Generation Logic
**Cutoff-Aware Billing Cycle:**
```
If transactionDate.day >= card.cutoffDay:
  → Belongs to NEXT month's statement
Else:
  → Belongs to THIS month's statement
```

**Example:**
- Chase card: cutoffDay = 20, dueDay = 25
- Jan 19 purchase → January statement (due Jan 25)
- Jan 21 purchase → February statement (due Feb 25)

**Statement Period Calculation:**
- For February statement: Jan 20 - Feb 19 (if cutoff = 20)
- Transactions in this period are grouped into the February statement

### Cash Flow vs Statement View
- **Cash Flow View**: "How much did I spend this week?"
  - Shows only budget-impacting transactions
  - Excludes parent transactions (they're for net worth tracking)
  - Real-time spending visibility
  
- **Statement Prep View**: "What will my CC bill look like on the 15th?"
  - Shows transactions grouped by statement cycle
  - Includes all transactions for statement period
  - Helps prepare for upcoming bills

### Buffer Calculation
- **Formula**: Total Bank Balance - Total Unpaid Credit Card Debt
- **Danger Zone**: Negative buffer (debt exceeds balance)
- Displayed prominently in Transactions page
- Updates in real-time as transactions and payments are recorded

### Auto-Incrementing Terms
- Installment terms automatically calculated from `startDate` and current date
- Uses `differenceInCalendarMonths` for accurate calculation
- No manual "4/12 → 5/12" updates needed

## Current User Flows

### Adding a Credit Card Transaction
1. Navigate to Transactions page
2. Click "Add Transaction"
3. Fill form: type (expense), amount, date, description, payment method (card), select card
4. System automatically:
   - Determines statement month (cutoff-aware)
   - Creates/updates statement
   - Links transaction to statement
5. Transaction appears in both Transactions and Bills views

### Adding an Installment Purchase
1. Navigate to Transactions page
2. Click "Add Transaction"
3. Fill form, enable "Recurring Transaction"
4. Select "Installment" type
5. Enter: total principal, number of terms, start date (or current term)
6. System creates:
   - Parent transaction (total principal, non-budget impacting)
   - Virtual transactions (one per term, budget impacting)
7. Virtual transactions appear in monthly statement views
8. Parent transaction visible for net worth/debt tracking

### Paying a Bill
1. Navigate to Bills page
2. View statement with transaction breakdown
3. Click "Pay" button
4. Enter payment amount and date
5. System:
   - Marks statement as paid
   - Marks all linked transactions as paid
   - Updates buffer calculation

### Viewing Cash Flow
1. Navigate to Transactions page
2. Select "Cash Flow" view mode
3. See only budget-impacting transactions
4. View summary: income, expenses, net change
5. Buffer calculation shows available funds

### Preparing for Statement
1. Navigate to Transactions page
2. Select "Statement Prep" view mode
3. See transactions grouped by statement period
4. Filter by specific card to see upcoming bill
5. Navigate to Bills page to see full statement

## Storage & Sync

### Local Storage (IndexedDB)
- Primary storage mechanism
- Stores: Profiles, Cards, Statements, Transactions, Bank Balances, Categories, Budgets, etc.
- Auto-saves on changes (via signal effects)
- Offline-first approach

### Firebase Sync (Optional)
- Real-time synchronization across devices
- Email/password or Google authentication
- Automatic cloud backup
- Syncs all collections and settings
- Offline support with auto-sync when online

### Local Export/Import
- Password-encrypted JSON files
- Complete data portability
- Manual backup/restore

## Current Pain Points & Areas for Improvement

### User Experience
1. **Multiple entry points**: Transactions can be added in Transactions page, but bills can also be created manually in Bills page - potential confusion
2. **View switching**: Dual-view toggle exists but may not be discoverable
3. **Installment creation**: Complex form with multiple modes (date vs term) - could be simplified
4. **Statement period visibility**: Statement periods not always clearly displayed in UI
5. **Bucket visibility**: Bucket badges help but may need more prominent categorization

### Data Flow
1. **Parent/virtual transaction visibility**: Users may not understand why parent transactions don't appear in cash flow
2. **Statement reconciliation**: No clear way to reconcile statement amounts with transaction totals
3. **Buffer calculation**: Only shown in Transactions page, could be more prominent
4. **Multi-profile complexity**: Switching between profiles and multi-profile mode could be clearer

### Feature Gaps
1. **Transaction editing impact**: When editing a transaction, statement updates may not be immediately clear
2. **Installment management**: No centralized view of all active installments
3. **Recurring bill management**: Recurring bills (subscriptions) could have better management UI
4. **Statement period navigation**: No easy way to navigate between statement periods

## Technical Implementation Details

### Signal-Based State Management
- All services use Angular Signals for reactive state
- Components use `computed()` for derived state
- Auto-save via `effect()` watching signal changes

### Cutoff Day Logic
Implemented in `TransactionService.autoCreateOrUpdateBill()`:
```typescript
const dayOfMonth = transactionDate.getDate();
if (dayOfMonth >= card.cutoffDay) {
  statementDate = addMonths(startOfMonth(transactionDate), 1); // Next month
} else {
  statementDate = startOfMonth(transactionDate); // This month
}
```

### Virtual Transaction Generation
Implemented in `TransactionService.generateVirtualTransactions()`:
- Creates one transaction per term
- Each marked as `isVirtual: true` and `isBudgetImpacting: true`
- Linked to parent via `parentTransactionId`
- Auto-linked to statements if payment method is card

### Statement Period Calculation
Implemented in `TransactionBucketService.getStatementPeriod()`:
- Calculates period from previous month's cutoff day to current month's (cutoff day - 1)
- Handles edge cases (cutoff day = 1)
- Returns period with start/end dates and monthStr

## Questions for Streamlining

1. **How can we simplify the transaction entry flow?** Currently requires understanding of buckets, parent/virtual transactions, cutoff days
2. **How can we make the dual-view system more intuitive?** Users may not understand when to use Cash Flow vs Statement Prep
3. **How can we improve installment management?** Currently scattered across Transactions and Manage pages
4. **How can we make statement reconciliation clearer?** Users may want to verify statement amounts match transactions
5. **How can we reduce cognitive load?** Multiple concepts (buckets, parent/virtual, cutoff days, statement periods) may overwhelm users
6. **How can we improve discoverability?** Features like buffer calculation, statement periods, bucket categorization may not be obvious
7. **How can we streamline the multi-profile experience?** Switching and combining profiles could be smoother
8. **How can we make recurring bills more manageable?** Subscriptions and recurring expenses could have dedicated management

## File Structure
```
src/app/
├── core/
│   ├── services/          # Business logic services
│   │   ├── transaction.service.ts
│   │   ├── transaction-bucket.service.ts
│   │   ├── statement.service.ts
│   │   ├── card.service.ts
│   │   ├── profile.service.ts
│   │   └── ...
│   └── storage/
│       └── indexeddb.ts   # IndexedDB wrapper
├── features/              # Feature pages
│   ├── overview/
│   ├── transactions/
│   ├── bills/
│   ├── budget/
│   ├── calendar/
│   ├── manage/
│   └── ...
├── shared/
│   ├── components/        # Reusable UI components
│   └── types.ts           # TypeScript interfaces
└── environments/
    └── firebase.ts
```

---

**This summary provides a comprehensive overview of the ng-bills implementation. Use this to ask an AI how to streamline features, improve user flows, and make the application more seamless and intuitive.**
