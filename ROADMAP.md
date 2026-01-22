# ng-bills Roadmap

Structured plan for evolving ng-bills into a full personal finance platform. All work is assumed AI-driven; focus on clear specifications and acceptance criteria rather than timeboxes.

## Guiding Principles
- Transactions-first: every money movement is a transaction; other views are aggregations.
- Local-first storage (IndexedDB) with optional Firestore sync; preserve privacy and offline use.
- Standalone Angular 21 + Tailwind; prefer signals for UI state and path aliases for imports.
- Ship behind safe defaults; favor additive/replaceable components over in-place rewrites until stable.

## Phase 0: UI/IA Refactor ✅ COMPLETED
Goal: move from bill-centric UI to a finance hub with clear navigation and reusable components.

**Status: COMPLETED (Jan 22, 2026)**

**What's Completed:**

- ✅ New routes created: Overview, Transactions, Bills, Budget
- ✅ TransactionService implemented with full CRUD and cutoff-date-aware auto-billing
- ✅ TransactionsComponent completed with form, filtering, category integration, and summary metrics
- ✅ BillsComponent fully implemented with transaction breakdowns, payment recording, and manual bill creation
- ✅ CategoryService implemented with 20 predefined categories and custom support
- ✅ BudgetComponent completed with category tracking, progress bars, and real-time spending
- ✅ Navigation structure defined and working

**Transaction Management (Complete):**

- Full income/expense tracking with category integration
- Add transactions with type, amount, date, description, notes, payment method, category
- Card transactions auto-linked to monthly bills based on cutoff day
- Real-time filtering by type, payment method, card, date range, search
- Automatic summary calculation (income, expenses, net)
- Delete transactions with automatic bill updates

**Auto-Bill Logic (The Core Innovation):**

- Formula: `if (transactionDate.day >= card.cutoffDay) → nextMonth else → thisMonth`
- Example: Chase (cutoff 20th) - Jan 19 → Jan bill, Jan 21 → Feb bill
- Statements auto-created/updated when card transactions added
- Statement amounts calculated as sum of linked transactions
- Manual bill creation for quick entry

**Bills & Payment Tracking (Complete):**

- Display auto-generated statements grouped by card/month
- Show linked transactions in expandable sections
- Payment recording modal with amount and date
- Mark as paid/unpaid functionality
- Edit manual bills with notes
- Due date calculation from card.dueDay

**Categories & Budgeting (Complete):**

- 20 predefined categories (Housing, Food, Transportation, etc.)
- Category-based budget allocations
- Real-time spending calculation from transactions
- Color-coded progress bars with alerts
- Custom category support framework

**Responsive UI:**

- Mobile-friendly layouts (1 col, 2 col, 4 col)
- Form validation and error handling
- Color-coded amounts (green income, red expense)
- Empty states with helpful messaging
- Icon-based UI with Lucide Angular

**Build Status:**

- ✅ Production build: 817 KB bundle (successful)
- ✅ All components compile without errors
- ✅ Ready for deployment

**Acceptance Criteria:**

- ✅ Can add/edit/delete transactions with categories
- ✅ Filters work (type, payment method, card, date, search)
- ✅ Statements reflect auto-linked transaction totals
- ✅ Bills show transaction breakdowns
- ✅ Payment recording functional
- ✅ Manual bill creation available
- ✅ Budget tracking shows real-time spending vs allocations

---

## Phase 1: Transaction Layer ✅ COMPLETED

**Status: COMPLETED (Jan 22, 2026)**

All Phase 1 objectives achieved during Phase 0 implementation. Phase 0 and Phase 1 were implemented together as they are
tightly coupled - the transaction layer forms the foundation of the entire financial tracking system.

**Completed Features:**

- ✅ Data model: Transaction with type, amount, date, category, paymentMethod, cardId, description, notes, tags
- ✅ Transaction model includes `isRecurring` and `recurringRule` fields for future installment migration
- ✅ TransactionService: CRUD operations, advanced filtering, auto-bill linking
- ✅ CategoryService: 20 predefined categories + custom category support
- ✅ Card/Statement enhancements: transaction aggregation and breakdown
- ✅ Transactions page: filters, grouping, search, summary stats
- ✅ Auto-linking: card transactions → monthly statements (cutoff-aware)
- ✅ Budget integration: real-time spending from transactions
- ✅ **Shared Card Payments with Profile Linking**
  - Add `paidByOtherProfileId` and `paidByOtherName` fields to transactions
  - Mark transactions as paid by another profile OR manual entry
  - Transaction appears in both profiles' transaction lists
  - Budget calculations exclude shared transactions (no double-counting)

**Acceptance Criteria (All Met):**

- ✅ Can create/edit/delete transactions
- ✅ Filters work (type, payment method, card, date, category, search)
- ✅ Statements reflect auto-linked transaction totals
- ✅ Bills show transaction breakdowns
- ✅ Payment recording functional
- ✅ Manual bill creation available
- ✅ Budget tracking shows real-time spending vs allocations

**⚠️ Known Legacy Code (To Be Migrated in Phase 2):**

The following entities violate the "transactions-first" principle and are **legacy code** that needs migration:
- `Installment` entity and `InstallmentService` - Should become recurring transactions
- `CashInstallment` entity and `CashInstallmentService` - Should become recurring transactions with `paymentMethod: 'cash'`

These are maintained for backward compatibility but will be removed in Phase 2. All new installment tracking should use the Transaction model with `isRecurring: true` and appropriate `recurringRule` metadata.

## Phase 2: Recurring Transactions & Legacy Migration ✅ COMPLETED

**Status: COMPLETED (Jan 22, 2026)**

**Objective:** Migrate legacy Installment/CashInstallment entities to recurring transactions and centralize card/profile management.

### ⚠️ Critical: Legacy Code Migration

**Current Problem:**

- ❌ `Installment` and `CashInstallment` are **legacy entities** that violate the "transactions-first" principle
- ❌ They don't automatically appear in transaction lists or budgets
- ❌ Duplicate logic across InstallmentService and CashInstallmentService
- ❌ Extra services to maintain (should be unified in TransactionService)
- ❌ CashInstallment type should NOT exist - it's a mistake in the current implementation

**Solution: Installments as Recurring Transactions**

All installments (both card-based and cash-based) should be `Transaction` entities with:
- `isRecurring: true`
- `recurringRule.type: 'installment'`
- `paymentMethod: 'card'` for card installments OR `paymentMethod: 'cash'` for cash installments
- `recurringRule.installmentGroupId` to link all payments in the same plan

**Transaction Model (Already Supports This):**

The Transaction model already has the necessary fields:
```typescript
interface Transaction {
  // ... existing fields
  isRecurring?: boolean;
  recurringRule?: {
    type: 'installment' | 'subscription' | 'custom';
    frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';
    totalPrincipal?: number;      // Total amount financed
    currentTerm?: number;          // Current payment number
    totalTerms?: number;           // Total number of payments
    startDate?: string;            // First payment date
    endDate?: string;              // Last payment date
    interestRate?: number;         // Annual percentage rate
    installmentGroupId?: string;   // Links all payments in this installment plan
    nextDate?: string;             // Next scheduled occurrence
    lastDate?: string;             // Last occurrence (for completed)
  };
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'other';
  cardId?: string; // when paymentMethod is card
}
```

**Implementation Steps:**

1. ✅ Transaction model already supports recurring installments (Phase 1 complete)
2. ✅ Create migration script to convert existing `Installment` → `Transaction` with `isRecurring: true`
3. ✅ Create migration script to convert existing `CashInstallment` → `Transaction` with `isRecurring: true` and `paymentMethod: 'cash'`
4. ✅ **Remove `CashInstallment` entity entirely** from types.ts
5. ✅ **Remove `CashInstallmentService`** from codebase
6. ✅ Update TransactionService to handle installment logic (auto-generate monthly payments)
7. ✅ Add installment badge/filter in Transactions page
8. ✅ Show installment progress in transaction cards (e.g., "5/12 payments") with visual progress bars
9. ⚠️ InstallmentService still exists for legacy installments (can be deprecated in future)
10. ✅ Update Bills page to recognize installment transactions
11. ✅ Update Dashboard/Calendar to show recurring transactions instead of installments
12. ✅ Remove CASH_INSTALLMENTS store from IndexedDB schema
13. ✅ Update sync services to handle migrated data
14. ✅ Implement payment tracking for cash installments
15. ✅ Enhanced installment progress visualization with color-coded badges and progress bars

**Benefits:**

- ✅ All expenses in one unified view
- ✅ Installments automatically count toward category budgets
- ✅ Installment payments auto-link to credit card bills
- ✅ Simpler architecture (one service, one storage mechanism)
- ✅ Better analytics (spending reports include installments)
- ✅ Consistent filtering/search across all transactions
- ✅ No more duplicate CashInstallment type (cleaner codebase)

### Management Consolidation

**Objective:** Centralize card, profile, and financial account management.

**Features:**

- **Card Management**
    - Add/Edit/Delete credit cards
    - View card details (bank, name, due day, cutoff day, color)
    - Card-specific transaction history
    - Statement history per card
    - Transfer cards between profiles

- **Profile Management**
    - Create/Edit/Delete profiles
    - Profile settings and preferences
    - Default profile selection
    - Multi-profile view toggle

- **Bank Account Management** (Basic)
    - Add/Edit/Delete bank accounts (for tracking purposes)
    - Link to bank transfer transactions
    - Account balance tracking

- **UI Improvements**
    - Move "Manage" from secondary nav to integrated settings
    - Card management accessible from Bills page
    - Profile switcher in header
    - Quick-add card from transaction form

**Acceptance Criteria (Phase 2):**

- ✅ Can migrate all existing Installments → recurring transactions
- ✅ Can migrate all existing CashInstallments → recurring transactions (paymentMethod: 'cash')
- ✅ Installment progress shown in transaction view (e.g., "5/12 (42%)") with visual progress bars
- ✅ Installments appear in budget calculations automatically
- ✅ Installment payments auto-link to card statements
- ✅ **CashInstallment entity removed from codebase** (types.ts, services, components)
- ✅ **CashInstallmentService removed** from codebase
- ⚠️ InstallmentService still exists for legacy installments (backward compatibility)
- ✅ Can manage cards, profiles, and accounts from centralized UI
- ✅ Card transfer between profiles works
- ✅ Migration preserves all historical installment data
- ✅ Build succeeds without CashInstallment references
- ✅ All components updated to use Transaction model for installments
- ✅ Payment tracking implemented for cash installments (isPaid, paidDate, paidAmount)
- ✅ Enhanced visualization with color-coded status badges and progress indicators

## Phase 3: Budgeting & Goals

Objective: Enhanced budgeting with savings goals.

- **BudgetService**: Move from localStorage to IndexedDB with proper versioning
- Budgets: monthly/quarterly/yearly budgets with category allocations, rollover flag, alert threshold
- Views: Enhanced Budget page with allocated vs spent vs remaining, per-category progress bars, drill-down to
  transactions
- Goals: goal entities with target, current, deadline, priority; simple progress widgets on Overview
- Goal contributions: Link to recurring transactions for automatic tracking
- Rollover budgets: Unused budget carries to next period
- Acceptance: budget math uses transaction data; alerts trigger at threshold; goals show progress and can be updated;
  rollover works correctly

## Phase 4: Purchases & Loan Planning
Objective: plan future buys and loans using real data.
- Planned purchases: wishlist with priority (need/want/wish), estimated cost, target date, notes, tags; affordability check against available balance.
- Loan planner: scenarios with amount, down payment, rate, term, taxes/insurance, monthly payment, DTI and affordability score; comparison table.
- Integration: convert planned purchase to installment/transaction when purchased; link to budgets/goals.
- Acceptance: can create scenarios, see affordability outputs, and log purchase to transactions/installments.

## Phase 5: Analytics & Insights
Objective: actionable dashboards and reports.
- Visuals: spending trends, category breakdowns, income vs expenses, cash-flow waterfall, YoY/MoM comparisons.
- Reports: monthly and annual summaries, export (CSV/PDF stub), scheduled report hooks.
- Insights: rule/AI hints (overspend alerts, trend deltas, budget suggestions).
- Acceptance: charts render from demo data; insights list generates from rules; exports download placeholder files.

## Phase 6: Sync & Collaboration
Objective: reliable sync and multi-user readiness.
- Firestore sync polish: conflict handling strategy, status indicator, last sync time, selective sync toggles.
- Collaboration: profile sharing roles (view/edit/admin), shared budgets/goals, household rollup view.
- Acceptance: sync toggle works; conflicts surface UI choices; shared profile mock supports basic role checks.

## Phase 7: Automation & Integrations
Objective: reduce manual entry.
- Recurring detection and auto-entry with approval.
- Receipt OCR hook (API placeholder) with amount/date/vendor extraction.
- Bank integration placeholder (Plaid-style) behind feature flag; reconciliation flow design.
- Acceptance: recurring rules execute; OCR stub populates fields; bank connector mocked with sample data.

## Phase 8: Mobile & PWA
Objective: excellent mobile experience.
- PWA: installability, offline-first, push hooks for due bills/budget alerts.
- Mobile UX: quick-add transaction widget, camera path for receipts, touch-friendly lists, biometric gate.
- Acceptance: passes Lighthouse PWA checks; offline transaction queue works; mobile layout verified.

## Phase 9: Monetization
Objective: define free/premium value.
- Free: basic transactions, simple budget, manual sync, single profile, limited history.
- Premium: unlimited history, advanced budgeting/analytics, purchase planner, goals, priority sync, receipt OCR, exports/reports; family tier with shared profiles.
- Acceptance: feature gating toggles exist; upgrade prompts wired; entitlements enforced in UI guards.

## Technical Tracks (ongoing)
- Storage: StorageProvider + IndexedDB migration complete; keep local-first with optional Firestore. Provide export/import, migration guard, storage info UI.
- Performance: virtual scrolling for large lists, lazy data loading, pagination hooks, memoized signals.
- Security & privacy: optional encryption wrappers, privacy mode (hide amounts), secure token handling for cloud.

## Execution Notes for AI
- Use path aliases and barrels; keep components standalone with explicit imports.
- Favor signals/computed for view state; avoid ad hoc globals.
- Build new features behind clear toggles; maintain backward compatibility until parity is proven.
- When adding data features, route through StorageService/SyncService; avoid direct localStorage access.
- This app is not yet in production so don't worry too much about backwards compatibility, no need to maintain
  localstorage.

---

## Recent Completions

### ✅ Phase 0 & Phase 1 (Completed Jan 22, 2026)

The foundational transaction layer is complete with all core functionality:

**Key Achievements:**
  - Freelance income
  - Investment returns
  - Other income sources
  - Recurring income support

- **Expense Transactions**
  - Manual expense entry
  - Link to credit card statements
  - Cash expenses
  - Recurring expenses
  - Split transactions (shared expenses)

#### Transaction Properties
```typescript
interface Transaction {
  id: string;
  profileId: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  categoryId: string;
  subcategoryId?: string;
  description: string;
  notes?: string;
  
  // Payment method
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'other';
  cardId?: string;  // Link to credit card if applicable
  
  // Organization
  tags: string[];
  attachments?: Attachment[];
  
  // Recurring
  isRecurring: boolean;
  recurringRule?: RecurringRule;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  isEstimate: boolean;
}
```

#### Category System
- **Pre-defined Categories** with icons and colors:
  - 🏠 Housing (rent, mortgage, utilities, maintenance)
  - 🍔 Food & Dining (groceries, restaurants, coffee)
  - 🚗 Transportation (gas, public transit, car payment, maintenance)
  - 💊 Healthcare (insurance, medications, doctor visits)
  - 🎭 Entertainment (subscriptions, movies, hobbies)
  - 👔 Shopping (clothing, electronics, household)
  - 📚 Education (tuition, books, courses)
  - ✈️ Travel (flights, hotels, vacation)
  - 💰 Financial (fees, interest, investments)
  - 👨‍👩‍👧 Personal (grooming, gifts, charity)
  
- **Custom Categories & Subcategories**
  - User-defined categories
  - Nested subcategories
  - Category budgets
  - Category-specific analytics

#### Transaction Dashboard
- List view with filtering and sorting
- Search by description, category, amount
- Date range filters
- Category filters
- Payment method filters
- Quick edit/delete
- Bulk operations (tag, categorize, delete)

#### Transaction Entry
- Quick add transaction button (accessible from all views)
- Smart date picker (today, yesterday, custom)
- Category quick select with recent categories
- Payment method selection
- Photo attachment for receipts
- Duplicate transaction feature
- Import from CSV

### Integration with Existing Features

#### Credit Card Statement Integration
- Auto-create transactions from paid credit card statements
- Link transactions to specific card charges
- Reconcile card statements with transactions
- Transaction breakdown per card

#### Bank Balance Integration
- Real bank balance = Starting balance + Income - Expenses
- Transaction-based balance calculation
- Balance reconciliation tool
- Expected vs actual balance alerts

### Advanced Bank Balance & Cash Flow Tracking 💵

#### Available vs Committed Balance
Track what money is truly available vs what's already allocated to upcoming obligations.

```typescript
interface EnhancedBankBalance {
  id: string;
  profileId: string;
  monthStr: string;
  
  // Actual balances
  totalBalance: number;           // What's in the bank
  committedBalance: number;        // Already allocated/owed
  availableBalance: number;        // totalBalance - committedBalance
  
  // Breakdown
  commitments: BalanceCommitment[];
  
  // Cash flow
  projectedBalance: number;        // Balance at end of month
  upcomingIncome: number;
  upcomingExpenses: number;
}

interface BalanceCommitment {
  id: string;
  type: 'credit_card' | 'installment' | 'planned_purchase' | 
        'budget_allocation' | 'savings_goal' | 'bill' | 'custom';
  name: string;
  amount: number;
  dueDate?: string;
  isPaid: boolean;
  isAutoDeducted: boolean;      // Auto-pay from bank
  
  // References
  cardId?: string;
  installmentId?: string;
  goalId?: string;
  transactionId?: string;
}
```

#### Balance Breakdown Dashboard

**Visual Representation:**
```
┌─────────────────────────────────────────┐
│ Bank Balance Overview                   │
├─────────────────────────────────────────┤
│ Total Balance:          $8,500.00       │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ ████████████████░░░░░░░░░░░       │  │
│ │ $6,200 committed  │  $2,300 free  │  │
│ └───────────────────────────────────┘  │
│                                         │
│ 💰 Available Balance:   $2,300.00       │
│ 📊 Committed (73%):     $6,200.00       │
│                                         │
│ What's Committed:                       │
│ • Credit Cards Due:     $3,800.00  🔴   │
│ • Installments:         $1,200.00  🟡   │
│ • Savings Goals:        $1,000.00  🟢   │
│ • Budget Allocations:   $200.00    🟢   │
└─────────────────────────────────────────┘
```

#### Commitment Tracking Features

**1. Auto-Detected Commitments**
Automatically track obligations from existing data:

- **Unpaid Credit Cards**
  - All unpaid statements for current month
  - Shows due date and amount
  - Red alert if due soon
  - Auto-removed when marked as paid

- **Upcoming Installments**
  - Credit card installments due this month
  - Cash installments
  - Loan payments
  - Automatically included in committed balance

- **Planned Purchases**
  - Items from purchase planner with "buy this month" flag
  - Earmark funds for planned expenses
  - Prevents overspending

- **Budget Allocations**
  - Pre-allocate budget amounts for categories
  - "Envelope budgeting" style
  - Track spending against allocation

- **Savings Goal Contributions**
  - Monthly contribution amounts
  - Auto-earmark for goals
  - Visual progress toward goals

**2. Manual Commitments**
Add custom obligations:
- Rent/mortgage (if not tracked as transaction yet)
- Utilities
- Subscriptions
- Upcoming bills
- Debt payments
- Custom obligations

**3. Commitment Timeline**
Calendar view of when committed funds are due:
```
This Week:
• Jan 23: Electric Bill        $150.00
• Jan 25: Credit Card #1       $1,200.00

Next Week:
• Jan 28: Car Payment          $450.00
• Jan 30: Credit Card #2       $2,600.00

Later This Month:
• Feb 1: Rent                  $2,000.00
```

**4. Real Available Balance**
The key metric - what can you actually spend:

```
Bank Balance:              $8,500.00
─────────────────────────────────────
Commitments Due:
  Credit Cards:           -$3,800.00
  Installments:           -$1,200.00
  Savings (auto-transfer): -$500.00
  Budgeted (groceries):    -$400.00
  Budgeted (gas):          -$200.00
  Emergency buffer:        -$400.00
─────────────────────────────────────
= Available to Spend:      $2,000.00
```

**5. Cash Flow Projection**

Show projected balance for next 30/60/90 days:
```
Today:        $8,500 (Available: $2,300)
In 7 days:    $7,200 (after credit card payment)
In 14 days:   $6,800 (after installments)
In 30 days:   $9,100 (after paycheck + expenses)

⚠️ Warning: Balance will dip to $4,200 on Jan 30
💡 Tip: Delay planned purchase to Feb to avoid low balance
```

**6. Buffer/Safety Net**
Set a minimum balance threshold:
- Never let available balance go below $500
- Factor into commitment calculations
- Alert when approaching minimum
- Recommend budget adjustments

#### Smart Alerts & Warnings

**Balance Warnings:**
- 🔴 "Your available balance is only $200 after commitments"
- ⚠️ "Credit card due in 3 days - $1,800 committed"
- 🟡 "You have $500 available, but groceries budget needs $400"
- ⚠️ "Balance will go negative on Jan 28 without paycheck"

**Spending Alerts:**
- "This purchase would leave you with only $50 available"
- "You have $800 available for discretionary spending"
- "Paying this bill now will reduce available balance to $100"

**Optimization Suggestions:**
- "Pay Credit Card #2 early to free up committed funds"
- "Delay savings contribution this month to maintain buffer"
- "Consider reducing grocery budget by $100 to improve cash flow"

#### Commitment Management

**Mark as Paid:**
- When you pay a bill, automatically remove from commitments
- Money becomes available again
- Update available balance in real-time

**Defer Commitment:**
- Push commitment to next month
- Adjust available balance
- Track deferred items

**Commitment Categories:**
Colors and priority levels:
- 🔴 Critical (credit cards, rent, utilities)
- 🟡 Important (installments, savings)
- 🟢 Flexible (budget allocations, planned purchases)

#### Integration Features

**Transaction Entry:**
When entering a new transaction:
- Check available balance before saving
- Warning if it exceeds available funds
- Suggest which commitment to adjust

**Credit Card Payments:**
When marking statement as paid:
- Auto-remove from commitments
- Log transaction
- Update available balance

**Budget Tracking:**
Sync with budget allocations:
- Pre-commit budgeted amounts
- Show remaining in each category
- Prevent overspending

**Savings Goals:**
Link to goal tracking:
- Auto-commit monthly contributions
- Option to skip month if cash is tight
- Adjust commitment based on priority

#### Mobile Widget
Quick glance view:
```
┌───────────────────────┐
│ 💰 Available Now      │
│ $2,300.00             │
│                       │
│ 🏦 Bank Balance       │
│ $8,500.00             │
│                       │
│ 📌 Committed          │
│ $6,200.00             │
└───────────────────────┘
```

#### Reports & Analytics

**Monthly Cash Flow Report:**
- Starting balance
- Income received
- Expenses paid
- Commitments added/removed
- Ending available balance
- Average available balance
- Days with low balance

**Commitment History:**
- Track how commitments change over time
- See patterns in committed vs available
- Identify months with tight cash flow

---

## Phase 2: Financial Planning & Budgeting 📊

### Budget Management

#### Budget Creation
```typescript
interface Budget {
  id: string;
  profileId: string;
  name: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;  // null for ongoing budgets
  
  // Category allocations
  allocations: CategoryAllocation[];
  
  // Settings
  rolloverUnspent: boolean;
  alertThreshold: number;  // Percentage (e.g., 80%)
}

interface CategoryAllocation {
  categoryId: string;
  allocatedAmount: number;
  spent: number;  // Auto-calculated from transactions
  remaining: number;  // Auto-calculated
}
```

#### Budget Features
- Monthly/quarterly/yearly budgets
- Per-category budget allocation
- Budget vs actual spending tracking
- Visual progress bars (green/yellow/red zones)
- Budget alerts when approaching limit
- Rollover unused budget to next period
- Budget templates (50/30/20 rule, etc.)
- Multi-profile budget consolidation

#### Budget Dashboard
- Overview of all budgets
- Current period progress
- Category spending breakdown
- Overspent categories highlighted
- Spending trends over time
- Budget recommendations based on history

### Savings Goals

#### Goal Tracking
```typescript
interface SavingsGoal {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  
  // Contribution
  monthlyContribution?: number;
  autoContribute: boolean;
  
  // Visualization
  icon: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
}
```

#### Goal Features
- Visual goal cards with progress bars
- Multiple concurrent goals
- Priority ranking
- Deadline tracking with countdown
- Monthly contribution suggestions
- "On track" vs "Behind" indicators
- Goal achievement celebrations
- Linked bank account for auto-transfers

#### Goal Types
- Emergency fund
- Down payment (house, car)
- Vacation
- Large purchase
- Debt payoff
- Custom goals

---

## Phase 3: Future Purchases & Planning 🛒

### Purchase Planner

#### Planned Purchase Tracking
```typescript
interface PlannedPurchase {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  estimatedCost: number;
  priority: 'need' | 'want' | 'wish';
  
  // Timeline
  targetDate?: string;
  isPurchased: boolean;
  purchasedDate?: string;
  actualCost?: number;
  
  // Financing
  paymentMethod?: 'cash' | 'card' | 'installment';
  installmentPlan?: {
    months: number;
    monthlyPayment: number;
    interestRate?: number;
  };
  
  // Research
  links: string[];
  notes: string;
  attachments?: Attachment[];
  
  // Categorization
  category: string;
  tags: string[];
}
```

#### Purchase Planner Features
- Wishlist of planned purchases
- Priority ranking (need/want/wish)
- Cost estimation tools
- Timeline planning
- Affordability calculator
- "Can I afford this?" analysis
- Installment plan simulator
- Comparison shopping notes
- Price tracking/alerts (if integrated with price APIs)

#### Affordability Analysis
When adding a planned purchase, show:
- Current available budget
- Impact on monthly budget if purchased now
- Suggested savings timeline
- Alternative financing options
- Trade-off analysis (what to sacrifice)

### Large Purchase Workflow
1. **Add to Planner**: Log the item with estimated cost
2. **Research Phase**: Add links, notes, price comparisons
3. **Budget Check**: See impact on current finances
4. **Savings Plan**: Create dedicated savings goal
5. **Purchase Decision**: Mark as purchased, log actual cost
6. **Tracking**: If financed, auto-create installment tracking

### Loan Planning & Affordability Calculator 🏠🚗

#### Major Loan Planner
Plan and simulate major loans (mortgage, auto loan, personal loan) based on your actual financial situation.

```typescript
interface LoanPlan {
  id: string;
  profileId: string;
  name: string;
  type: 'mortgage' | 'auto' | 'personal' | 'student' | 'other';
  
  // Loan details
  totalAmount: number;
  downPayment: number;
  loanAmount: number;  // totalAmount - downPayment
  interestRate: number;  // Annual percentage rate
  termMonths: number;
  
  // Calculated values
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  
  // Additional costs (for mortgages/auto)
  propertyTax?: number;  // Monthly
  insurance?: number;  // Monthly
  pmi?: number;  // Private mortgage insurance
  hoa?: number;  // HOA fees
  maintenance?: number;  // Estimated monthly maintenance
  
  // Affordability analysis
  affordabilityScore: number;  // 0-100
  monthlyIncomeRequired: number;
  debtToIncomeRatio: number;
  impactOnBudget: BudgetImpact;
  
  // Status
  status: 'planning' | 'saving_for_down_payment' | 'approved' | 'active' | 'completed';
  targetDate?: string;
  notes: string;
}

interface BudgetImpact {
  currentMonthlyIncome: number;
  currentMonthlyExpenses: number;
  currentMonthlyDebt: number;
  
  newMonthlyPayment: number;
  newTotalMonthlyDebt: number;
  newDebtToIncomeRatio: number;
  
  remainingAfterLoan: number;
  percentageOfIncomeUsed: number;
  
  recommendations: string[];
  warnings: string[];
}
```

#### Loan Affordability Features

**1. Pre-Qualification Calculator**
- Enter desired purchase price
- Input down payment ($ or %)
- Select loan term (15, 20, 30 years for mortgages; 3-7 years for auto)
- Input estimated interest rate
- Auto-calculate: monthly payment, total interest, total cost

**2. Real Affordability Analysis**
Based on your actual data from the app:
- **Income Analysis**
  - Average monthly income (last 3-6 months)
  - Stable vs variable income identification
  - Income trends

- **Expense Analysis**
  - Average monthly expenses by category
  - Essential vs discretionary spending
  - Existing debt obligations

- **Debt-to-Income Ratio**
  - Current DTI calculation
  - DTI with new loan
  - Lender requirements (typically <43%)
  - Color-coded indicators (green/yellow/red)

**3. Affordability Score (0-100)**
Based on:
- DTI ratio (40 points)
- Emergency fund coverage (20 points)
- Down payment saved (15 points)
- Payment history (10 points)
- Income stability (10 points)
- Budget headroom (5 points)

Score interpretation:
- 80-100: Excellent - Ready to proceed
- 60-79: Good - Minor improvements needed
- 40-59: Fair - Significant planning required
- 0-39: Poor - Not recommended at this time

**4. Loan Comparison Tool**
Compare multiple loan scenarios side-by-side:
```
Scenario A vs Scenario B vs Scenario C
----------------------------------------
Loan Amount:     $300K      $350K      $300K
Down Payment:    $60K       $70K       $90K
Term:            30 years   30 years   15 years
Interest Rate:   6.5%       6.5%       5.75%
Monthly Payment: $1,896     $2,212     $2,483
Total Interest:  $382K      $447K      $147K
DTI Ratio:       28%        33%        37%
Affordability:   ✅ 85      ⚠️ 72      ⚠️ 68
```

**5. Down Payment Planner**
- Target down payment amount (20% recommended)
- Current savings
- Time to save calculator
- Monthly savings needed
- Integration with savings goals
- PMI cost comparison (< 20% vs ≥ 20%)

**6. Budget Impact Simulator**
Visual representation of budget before/after loan:

**Current Monthly Budget:**
- Income: $8,000
- Expenses: $4,500
- Savings: $3,500

**With New Mortgage:**
- Income: $8,000
- Expenses: $4,500
- Mortgage: $2,200 (principal, interest, taxes, insurance)
- Remaining: $1,300
- Savings Reduction: -63%

**7. What-If Scenarios**
Interactive sliders to adjust:
- Purchase price
- Down payment %
- Interest rate
- Loan term
- See real-time impact on affordability

**8. Hidden Costs Calculator**

For **Mortgages**:
- Closing costs (2-5% of loan)
- Property taxes (estimated from location)
- Homeowners insurance
- PMI (if < 20% down)
- HOA fees
- Maintenance (1% of home value/year)
- Utilities
- Moving costs

For **Auto Loans**:
- Sales tax
- Registration & title fees
- Insurance (liability + comprehensive)
- Fuel costs
- Maintenance
- Parking/tolls

**9. Qualification Checker**
Typical lender requirements:
- ✅ DTI < 43% (yours: 28%)
- ✅ Credit score > 620 (not tracked in app)
- ✅ Employment history (stable income)
- ✅ Down payment saved
- ⚠️ Emergency fund 3-6 months (yours: 2 months)

**10. Amortization Schedule**
Detailed payment breakdown:
- Month-by-month principal vs interest
- Remaining balance over time
- Visual chart showing equity build-up
- Payoff date
- Total interest paid

**11. Pre-Approval Preparation**
Checklist and document tracker:
- [ ] 2 years of tax returns
- [ ] Recent pay stubs
- [ ] Bank statements
- [ ] Employment verification
- [ ] Debt documentation
- [ ] Down payment proof

**12. Loan Progress Tracking**
Once approved/active:
- Link to actual installment tracking
- Payment history
- Remaining balance
- Equity tracking (for mortgages)
- Payoff progress
- Early payoff calculator

#### Smart Recommendations

Based on analysis, provide actionable advice:
- ✅ "Your DTI is excellent. You qualify for this loan."
- ⚠️ "Consider reducing dining expenses by $200/month to improve affordability."
- ❌ "Your DTI would be 48%. Aim for a lower purchase price or increase down payment."
- 💡 "Saving $500/month, you'll have 20% down payment in 18 months."
- 💡 "A 15-year term saves $120K in interest but increases monthly payment by $600."
- ⚠️ "Build your emergency fund to 6 months before committing to this loan."

#### Integration with Existing Features

- **Transaction History**: Auto-calculate average monthly income/expenses
- **Current Debt**: Factor in existing credit card payments and installments
- **Bank Balance**: Down payment savings tracking
- **Savings Goals**: Create dedicated goal for down payment
- **Budgets**: Show impact on existing budgets
- **Planned Purchases**: Convert to loan plan when needed
- **Notifications**: Remind about saving milestones

#### Mobile-Optimized Calculator
- Quick loan calculator widget
- Swipe between scenarios
- Share loan plan with partner/family
- Export PDF report for lender meetings

---

## Phase 4: Advanced Analytics & Insights 📈

### Spending Analytics

#### Visualizations
- **Monthly Spending Trends**
  - Line chart of income vs expenses
  - Category breakdown pie chart
  - Month-over-month comparison
  - Year-over-year comparison

- **Category Analysis**
  - Top spending categories
  - Category trends over time
  - Category % of total spending
  - Unusual spending alerts

- **Cash Flow**
  - Income vs expenses waterfall chart
  - Net savings per month
  - 3-month/6-month/12-month averages
  - Forecast based on trends

#### Reports
- **Monthly Summary Report**
  - Total income/expenses
  - Net savings
  - Top categories
  - Budget performance
  - Notable changes from last month

- **Annual Report**
  - Year in review
  - Total income/expenses
  - Savings rate
  - Category breakdown
  - Financial health score

- **Custom Reports**
  - Date range selection
  - Category filtering
  - Export to PDF/Excel
  - Scheduled email reports

### Financial Health Score
Calculate a score (0-100) based on:
- Savings rate
- Debt-to-income ratio
- Emergency fund coverage
- Budget adherence
- Bill payment history
- Overall financial trends

Provide recommendations for improvement.

### Insights & Recommendations
AI-powered or rule-based insights:
- "You spent 30% more on dining this month"
- "You're on track to save $X this year"
- "Consider reducing spending in category Y"
- "You have room in your budget for goal Z"
- "Your credit card due date is approaching"

---

## Phase 5: Enhanced Sync & Collaboration 🔄

### Improved Sync Features
- **Conflict Resolution UI**
  - Visual diff for conflicts
  - Choose local/remote/merge
  - Automatic merge for non-conflicting changes

- **Sync Status Indicator**
  - Real-time sync status in header
  - Last synced timestamp
  - Pending changes count
  - Offline mode indicator

- **Data Versioning**
  - Change history/audit log
  - Revert to previous version
  - See who made changes (if shared)

- **Selective Sync**
  - Choose which data types to sync
  - Profile-specific sync settings
  - Bandwidth-conscious syncing

### Family & Shared Finance
- **Profile Sharing**
  - Invite family members to profiles
  - Role-based permissions (view-only, edit, admin)
  - Shared budgets and goals
  - Individual + shared transaction views

- **Household View**
  - Combined financial overview
  - Household budget
  - Shared expenses tracking
  - Individual contribution tracking

---

## Phase 6: Advanced Features 🚀

### Automated Features
- **Recurring Transaction Auto-Entry**
  - Auto-create recurring transactions
  - Smart detection of recurring patterns
  - Approval workflow for new recurring items

- **Receipt Scanning (OCR)**
  - Upload receipt photo
  - Extract amount, vendor, date
  - Auto-categorize based on vendor
  - Attach to transaction

- **Bank Integration** (Future consideration)
  - Connect to bank accounts (via Plaid or similar)
  - Auto-import transactions
  - Real-time balance updates
  - Account reconciliation

### Debt Management
```typescript
interface Debt {
  id: string;
  profileId: string;
  name: string;
  type: 'credit_card' | 'loan' | 'mortgage' | 'other';
  totalAmount: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  dueDay: number;
  
  // Payoff strategy
  targetPayoffDate?: string;
  extraPaymentAmount?: number;
}
```

- Debt snowball/avalanche calculators
- Payoff timeline visualization
- Interest savings calculator
- Debt-free date projections

### Investment Tracking (Basic)
- Track investment accounts (manual entry)
- Portfolio allocation overview
- Return tracking
- Net worth calculation

### Tax Preparation Helpers
- Tag transactions as tax-deductible
- Generate tax category reports
- Charitable donation tracking
- Business expense tracking

---

## Phase 7: Mobile & PWA 📱

### Progressive Web App
- Installable on mobile devices
- Offline-first architecture
- Push notifications (bills due, budget alerts)
- Fast performance on mobile
- Touch-optimized UI

### Mobile-Specific Features
- Quick transaction entry widget
- Camera integration for receipts
- Location-based transaction tagging
- Voice entry for transactions
- Biometric authentication

---

## Phase 8: Premium Features (Monetization) 💎

### Free Tier
- Basic transaction tracking
- Simple budgeting
- Manual sync
- 1 profile
- 3 months of history

### Premium Tier
- Unlimited transactions & history
- Advanced budgeting & analytics
- Savings goals & purchase planner
- Automated features
- Multi-profile support
- Priority sync
- Receipt scanning
- Export & reports
- Email support

### Family Plan
- All premium features
- Up to 5 users
- Shared profiles
- Household view
- Family analytics

---

## Implementation Priority

### Phase 0: Foundation (Weeks 1-6) 🏗️

#### Part 1: Storage Architecture Migration
- [ ] Create StorageProvider abstraction layer
- [ ] Implement IndexedDBProvider
- [ ] Build LocalStorage → IndexedDB migration tool
- [ ] Auto-migrate existing users
- [ ] Test with large datasets
- [ ] Keep Firebase sync as optional cloud backup

#### Part 2: UI/UX Redesign & Information Architecture 🎨

**Current State Analysis:**
The existing app is designed around **bill tracking** with these views:
- Dashboard: Monthly credit card bills
- Calendar: Due dates for cards
- Manage: Add/edit cards and installments
- Sync: Data backup

**New Requirement:**
Transform into **comprehensive finance management** that handles:
- All transactions (not just bills)
- Income tracking
- Expense tracking
- Bank balance with available vs committed
- Budget management
- Savings goals
- Planned purchases

**Core Design Principle:**
> **Transactions are the foundation.** Everything links to transactions:
> - Credit card charges → Transactions
> - Cash payments → Transactions  
> - Income → Transactions
> - Bills paid → Transactions

---

#### New Information Architecture

**Primary Navigation (Redesigned):**

```
┌──────────────────────────────────────────────────────────────┐
│  ng-bills                    [Month Selector]  [⚙️]          │
├──────────────────────────────────────────────────────────────┤
│  Overview  │  Transactions  │  Bills  │  Budget              │
│                                                     [More ▼]  │
│                                             Calendar         │
│                                             Sync             │
└──────────────────────────────────────────────────────────────┘
```

**Navigation Structure (Status):**

- ✅ Primary: Overview, Transactions, Bills, Budget
- ✅ Secondary (More menu): Calendar, Sync
- ⚠️ TODO: Integrate manage functionality into Bills (or separate tab)

**1. Overview (New - Replaces Dashboard)**
The financial command center - see everything at a glance.

**Overview Features (Status):**

- ⚠️ TODO: Display key metrics (available, total, committed balance)
- ⚠️ TODO: Show monthly cash flow (income vs expenses)
- ⚠️ TODO: Upcoming bills widget (next 7 days)
- ⚠️ TODO: Recent transactions widget
- ⚠️ TODO: Budget summary widget
- ⚠️ TODO: Savings goals progress widget
- ⚠️ TODO: Quick actions (add transaction, pay bill, view budget)

```typescript
// Component: overview.component.ts
interface OverviewView {
  // Top Section: Key Metrics
  metrics: {
    availableBalance: number;      // What you can spend now
    totalBalance: number;           // Bank balance
    committedBalance: number;       // Money already allocated
    monthlyIncome: number;          // This month's income
    monthlyExpenses: number;        // This month's expenses
    netCashFlow: number;            // Income - Expenses
  };
  
  // Middle Section: Quick Actions
  quickActions: {
    addTransaction: () => void;
    payBill: () => void;
    viewBudget: () => void;
  };
  
  // Bottom Section: Widgets (Customizable)
  widgets: [
    'upcoming-bills',              // Next 7 days
    'recent-transactions',         // Last 10 transactions
    'budget-summary',              // Category spending
    'savings-goals-progress',      // Goal cards
    'spending-by-category'         // Pie chart
  ];
}
```

Visual Layout:
```
┌─────────────────────────────────────────────────────────┐
│ Overview                              January 2026      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │💰 $2,300 │  │🏦 $8,500 │  │📊 $6,200│            │
│  │Available │  │  Total   │  │Committed│            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
│  ┌─────────────────────────────────────────┐          │
│  │ 📈 Cash Flow This Month                 │          │
│  │ Income:    $7,500  ████████████████░░░  │          │
│  │ Expenses:  $4,200  ████████░░░░░░░░░░░  │          │
│  │ Net:       $3,300  ████████████░░░░░░░  │          │
│  └─────────────────────────────────────────┘          │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Upcoming Bills   │  │ Budget Status    │          │
│  │ Jan 23: $1,200   │  │ Food: 80% 🟢     │          │
│  │ Jan 25: $450     │  │ Transport: 95% 🟡│          │
│  │ Jan 30: $2,600   │  │ Shopping: 110% 🔴│          │
│  └──────────────────┘  └──────────────────┘          │
│                                                         │
│  [+ Add Transaction]  [Pay Bill]  [View All →]        │
└─────────────────────────────────────────────────────────┘
```

**2. Transactions (New - Core Feature)**
Central hub for all money movement: income, expenses, and card payments.

**Transactions Features (Status):**

- ⚠️ TODO: Add/Edit/Delete transactions
- ⚠️ TODO: Filter by date range, type, category, payment method, card
- ⚠️ TODO: Quick add transaction modal
- ⚠️ TODO: Group by date/category/card
- ⚠️ TODO: Summary stats (income, expenses, net)
- ⚠️ TODO: Search/filter functionality
- ⚠️ TODO: Auto-link to credit card bills when paymentMethod='card'

```typescript
// Component: transactions.component.ts
interface TransactionView {
  // Filter Bar
  filters: {
    dateRange: { start: string; end: string };
    type: 'all' | 'income' | 'expense';
    category: string[];
    paymentMethod: 'all' | 'cash' | 'card' | 'bank_transfer';
    cardId?: string;  // Filter by specific card
    searchQuery: string;
  };
  
  // Transaction List
  transactions: Transaction[];
  
  // Summary Stats
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netChange: number;
    transactionCount: number;
  };
  
  // Grouped Display Options
  groupBy: 'date' | 'category' | 'card' | 'none';
}
```

Visual Layout:
```
┌─────────────────────────────────────────────────────────┐
│ Transactions                          [+ Add]           │
├─────────────────────────────────────────────────────────┤
│ Filters: [Jan 2026 ▼] [All Types ▼] [All Cards ▼] 🔍  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Today - Jan 21                                          │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 🍔 Lunch at Restaurant        💳 Chase Freedom   │   │
│ │ Food & Dining                       -$45.00     │   │
│ │ 12:30 PM                                        │   │
│ └─────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ ⛽ Gas Station                💳 Citi Rewards    │   │
│ │ Transportation                      -$60.00     │   │
│ │ 8:15 AM                                         │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Yesterday - Jan 20                                      │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 💰 Salary Payment             🏦 Bank Transfer   │   │
│ │ Income - Salary                  +$7,500.00     │   │
│ │ 9:00 AM                                         │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Summary: Income $7,500 | Expenses $105 | Net $7,395    │
└─────────────────────────────────────────────────────────┘
```

**Key Feature: Transaction → Credit Card Link**
```typescript
// When adding transaction with card payment method
interface TransactionForm {
  amount: number;
  description: string;
  category: Category;
  paymentMethod: 'cash' | 'card' | 'bank_transfer';
  
  // If paymentMethod === 'card'
  cardId: string;  // Select from user's credit cards
  
  // If paymentMethod === 'cash'
  cardId: null;    // No card association
  
  // Auto-linking
  autoAddToStatement: boolean;  // Add to card's monthly statement
}
```

**3. Bills (Redesigned - From Current Dashboard)**
Focused view for managing credit card bills, installments, and card administration.

**KEY ARCHITECTURE: Transactions → Statements (Auto-Bills)**

- Credit card transactions automatically create/update monthly statements
- Every card generates one statement per month (based on `monthStr: "YYYY-MM"`)
- Statement amount = sum of all transactions for that card in that month
- Statement due date = card's `dueDay` property
- Transactions with `paymentMethod: 'card'` and `cardId` automatically link to the statement

**Bills View Features (Status):**

- ✅ Display credit card bills (unpaid statements)
- ✅ Display installments due this month
- ⚠️ TODO: Show transactions breakdown in bill details
- ⚠️ TODO: Mark as paid (payment tracking)
- ⚠️ TODO: Quick payment action
- ⚠️ TODO: Edit bill due date (custom due dates)

**Card Management (Status - Integrated into Bills):**

- ✅ Add/Edit/Delete credit cards
- ✅ View card details (bank name, card name, due day, cutoff day)
- ⚠️ TODO: Integrate with new transaction linking
- ⚠️ TODO: Show card-specific transaction history
- ⚠️ TODO: Show bill history for card

**Installment Management (Status - Integrated into Bills):**

- ✅ Add/Edit/Delete installments
- ✅ Track installment progress
- ⚠️ TODO: Show in Bills as monthly items
- ⚠️ TODO: Link to transaction when paying

```typescript
// Component: bills.component.ts
interface BillsView {
  // Current month's bills
  monthlyBills: {
    creditCards: {
      card: CreditCard;
      statement: Statement;
      transactions: Transaction[];  // Auto-linked transactions
      amountDue: number;             // Sum of linked transactions
      dueDate: string;               // Set from card.dueDay
      isPaid: boolean;               // Manual payment tracking
    }[];
    
    installments: {
      installment: Installment | CashInstallment;
      amount: number;
      dueDate: string;
      isPaid: boolean;
    }[];
  };
  
  // Upcoming bills (next 30 days)
  upcomingBills: Bill[];
  
  // Calendar view toggle
  viewMode: 'list' | 'calendar';
}

// Example: How Statements Auto-Generate
// User adds transaction on Jan 15: { amount: 45, cardId: 'chase-1', paymentMethod: 'card' }
// ↓
// Statement lookup: "chase-1" + "2026-01" = January 2026 statement
// ↓
// If not exists: Create with amount = 45, dueDate = card.dueDay (e.g., 25th)
// If exists: Add 45 to existing amount
// ↓
// Bills page shows: "Chase Freedom - Jan 25 - $45.00" → [Transactions: 1]
```

Visual Layout:
```
┌─────────────────────────────────────────────────────────┐
│ Bills                        January 2026               │
├─────────────────────────────────────────────────────────┤
│ [List View] [Calendar View]         Total Due: $5,250  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Credit Cards Due This Month                             │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Chase Freedom             Due: Jan 25           │   │
│ │ $1,850.00                 [View Charges]  [Pay] │   │
│ │ 15 transactions • Shopping, Dining, Gas         │   │
│ └─────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Citi Rewards              Due: Jan 30           │   │
│ │ $2,600.00                 [View Charges]  [Pay] │   │
│ │ 22 transactions • Utilities, Subscriptions      │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Installments                                            │
│ ┌─────────────────────────────────────────────────┐   │
│ │ iPhone 15 Pro (5/12)      Due: Jan 28           │   │
│ │ $450.00                                   [Pay] │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**4. Budget (New)**
Budget management and category tracking.

**Budget View Features (Status):**

- ⚠️ TODO: Create/Edit/Delete budgets
- ⚠️ TODO: Set category allocations
- ⚠️ TODO: Display allocated vs spent vs remaining
- ⚠️ TODO: Category progress bars
- ⚠️ TODO: Drill-down to transactions by category
- ⚠️ TODO: Budget vs actual tracking
- ⚠️ TODO: Overspend warnings

**5. Calendar (Enhanced)**
Visual calendar view showing due dates for bills, installments, and recurring transactions.

**Calendar Features (Status):**

- ✅ Existing calendar view shows payment due dates
- ✅ Navigation between months
- ⚠️ TODO: Integrate with new transaction system
- ⚠️ TODO: Show linked transactions on due dates
- ⚠️ TODO: Click to view/pay bill
- ⚠️ TODO: Month/week/day view options

**6. More (Dropdown/Menu)**

- Savings Goals (Phase 2)
- Planned Purchases (Phase 3)
- Loan Planning (Phase 3)
- Analytics & Reports (Phase 4)
- Settings & Sync (ongoing)

---

#### Transaction-to-Card Linking System

**CORE REQUIREMENT: Transactions Linked to Credit Cards = Monthly Bills**

Every credit card transaction automatically creates/updates a monthly bill (statement). No manual bill entry needed.

**Core Concept:**
Every transaction can be linked to a payment method:

1. **Credit Card** → Automatically creates/updates monthly statement (bill) with due date
2. **Cash** → No card, just tracks spending (no bill created)
3. **Bank Transfer** → Direct debit from account (no bill created)

**Auto-Bill Generation Logic (Cutoff-Date Aware):**

```
When user adds transaction with:
  - paymentMethod: 'card'
  - cardId: 'chase-1'
  - amount: $50
  - date: '2026-01-25'
  - card.cutoffDay: 20

System automatically determines the STATEMENT MONTH:
  1. Check card.cutoffDay (e.g., 20th)
  2. Get transaction date (Jan 25)
  3. Compare: Is Jan 25 > Jan 20? YES → Transaction belongs to NEXT month (Feb)
  4. Calculate statement month:
     - If day >= cutoffDay: statement month = transaction month
     - If day < cutoffDay: statement month = transaction month - 1
     
  Example Timeline (cutoffDay = 20):
    Jan 1-20:   → January statement (due ~Jan 25)
    Jan 21-31:  → February statement (due ~Feb 25)
    Feb 1-20:   → February statement
    Feb 21-28:  → March statement
  
  5. Look up Statement for (cardId: 'chase-1', monthStr: '2026-02')
  6. If NOT found: Create new February statement with $50
  7. If found: Add $50 to existing February statement
  8. Links transaction to statement
  9. Bills view shows: "Chase Freedom (Feb 2026) - Due Feb 25 - $50.00"

Result: User sees transaction on correct monthly bill based on cutoff date!
```

**Real Example:**

- Chase card has: cutoffDay=20, dueDay=25
- Jan 1: Buy lunch ($45) → Jan statement (Jan 1 < 20) → Due Jan 25
- Jan 21: Buy gas ($60) → Feb statement (Jan 21 > 20) → Due Feb 25
- Jan 25: Pay statement → Only sees $45 due (Jan 1-20 purchases)
- Feb: Sees $60 in new bill for Jan 21-31 purchases

**Implementation:**

```typescript
// 1. Transaction Service - Auto-Bill Creation
class TransactionService {
  async addTransaction(transaction: Transaction): Promise<void> {
    // Save transaction
    await this.storage.saveTransaction(transaction);

    // ⭐ KEY: Credit card transactions auto-create bills
    if (transaction.paymentMethod === 'card' && transaction.cardId) {
      await this.autoCreateOrUpdateBill(transaction);
    }
    
    // Update bank balance
    await this.updateBankBalance(transaction);
    
    // Update budget category
    if (transaction.type === 'expense') {
      await this.updateBudgetSpending(transaction);
    }
  }

  private async autoCreateOrUpdateBill(transaction: Transaction): Promise<void> {
    const cardId = transaction.cardId!;

    // Get card for due date and cutoff calculation
    const card = await this.cardService.getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);

    // ⭐ CUTOFF-AWARE: Determine which statement month this transaction belongs to
    const transactionDate = parseISO(transaction.date);
    const dayOfMonth = transactionDate.getDate();

    // Determine statement month based on cutoff day
    let statementDate: Date;
    if (dayOfMonth >= card.cutoffDay) {
      // Transaction is after cutoff → belongs to NEXT month's statement
      statementDate = addMonths(startOfMonth(transactionDate), 1);
    } else {
      // Transaction is before cutoff → belongs to THIS month's statement
      statementDate = startOfMonth(transactionDate);
    }

    const monthStr = format(statementDate, 'yyyy-MM');

    // Get existing statement or create new one
    let statement = await this.storage.getStatement(cardId, monthStr);

    if (!statement) {
      // AUTO-CREATE: New monthly bill
      const dueDate = new Date(
        statementDate.getFullYear(),
        statementDate.getMonth(),
        card.dueDay
      );

      statement = {
        id: `stmt-${cardId}-${monthStr}`,
        cardId,
        monthStr,
        amount: transaction.amount,
        isPaid: false,
        customDueDate: format(dueDate, 'yyyy-MM-dd'),
        cutoffDay: card.cutoffDay,  // Track cutoff for reconciliation
        dueDay: card.dueDay
      };

      console.log(`✅ Bill auto-created: ${card.cardName} - ${monthStr} (cutoff: ${card.cutoffDay}) - $${transaction.amount}`);
    } else {
      // UPDATE: Add to existing bill
      statement.amount += transaction.amount;
      console.log(`✅ Bill updated: ${card.cardName} - ${monthStr} - New total: $${statement.amount}`);
    }

    // Save/update the bill
    await this.storage.saveStatement(statement);
  }
}

// 2. Card Statement with Transaction Breakdown
interface EnhancedStatement extends Statement {
  transactionIds?: string[];  // Links to transactions (optional tracking)
  dueDay?: number;  // Reference to card's dueDay
}

// 3. Get Statement with Linked Transactions
async
getStatementWithTransactions(
  cardId
:
string,
  monthStr
:
string
):
Promise < StatementWithTransactions > {
  const statement = await this.getStatement(cardId, monthStr);

  // Get all transactions for this card in this month
  const transactions = await this.transactionService.getTransactions({
    cardId,
    paymentMethod: 'card',
    dateRange: {
      start: `${monthStr}-01`,
      end: `${monthStr}-31`
    }
  });

  // Calculate amount from transactions (should match statement.amount)
  const calculatedTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    ...statement,
    transactions,
    calculatedTotal,
    discrepancy: Math.abs(statement.amount - calculatedTotal)
  };
}
```

**Monthly Bill Examples (Cutoff-Date Aware):**

**Example 1: Chase Freedom (cutoffDay: 20, dueDay: 25)**

```
Jan 1: User buys lunch ($45)
  → Day 1 < cutoffDay 20 → Jan statement
  → System: "Creating Chase Freedom Jan 2026 bill ($45)"
  
Jan 15: User buys gas ($60)
  → Day 15 < cutoffDay 20 → Jan statement
  → System: "Updating Chase Freedom Jan 2026 bill ($105)"
  
Jan 20: User buys groceries ($120)
  → Day 20 >= cutoffDay 20 → Feb statement (cutoff reached!)
  → System: "Creating Chase Freedom Feb 2026 bill ($120)"
  
Jan 25: User pays Jan bill
  → Bills shows: Chase Freedom Jan 2026: $105 DUE
  → (Jan 21-31 purchases will be in Feb bill)
  
Bills View (Jan 25):
┌──────────────────────────────────────────┐
│ Chase Freedom - Jan 2026                 │
│ Due: Jan 25, 2026          Amount: $105  │
├──────────────────────────────────────────┤
│ Transactions (2):                        │
│  • Jan 1  - Lunch              -$45     │
│  • Jan 15 - Gas                -$60     │
└──────────────────────────────────────────┘

Bills View (Same day after transaction):
┌──────────────────────────────────────────┐
│ Chase Freedom - Feb 2026                 │
│ Due: Feb 25, 2026          Amount: $120  │
├──────────────────────────────────────────┤
│ Transactions (1):                        │
│  • Jan 20 - Groceries          -$120    │
└──────────────────────────────────────────┘
```

**Example 2: Citi Card (cutoffDay: 10, dueDay: 5 next month)**

```
Jan 1-9:   → Jan statement (due Feb 5)
Jan 10-31: → Feb statement (due Mar 5)
Feb 1-9:   → Feb statement
Feb 10-28: → Mar statement (due Apr 5)
```

This ensures transactions are grouped into the **correct billing cycle** automatically!

**Relationship Diagram:**

```
CreditCard "Chase Freedom" (dueDay: 25)
  ↓
  └─ Monthly Bills (auto-created per month based on transactions)
      │
      ├─ Jan 2026 Statement
      │   amount: $225 (auto-calculated)
      │   dueDate: 2026-01-25 (from card.dueDay)
      │   isPaid: false
      │   ↓ Contains:
      │   ├─ Transaction: Lunch $45 (Jan 1, paymentMethod: 'card')
      │   ├─ Transaction: Gas $60 (Jan 5, paymentMethod: 'card')
      │   └─ Transaction: Groceries $120 (Jan 15, paymentMethod: 'card')
      │
      ├─ Feb 2026 Statement
      │   amount: $180 (auto-calculated)
      │   dueDate: 2026-02-25
      │   isPaid: false
      │   ↓ Contains:
      │   ├─ Transaction: Rent $150 (Feb 1, paymentMethod: 'card')
      │   └─ Transaction: Coffee $30 (Feb 8, paymentMethod: 'card')
      │
      └─ Mar 2026 Statement
          amount: $0 (auto-created, waiting for transactions)
          dueDate: 2026-03-25
          isPaid: false
          ↓ Contains: (none yet)
```

**Key Features:**

- ✅ Bills are **automatically generated** - no manual entry required
- ✅ One bill per card per month (statement with monthStr)
- ✅ Bill amount = **sum of all transactions for that card that month**
- ✅ Bill due date = **card's `dueDay` property**
- ✅ **Cutoff-aware**: Transactions automatically assigned to correct statement month based on `card.cutoffDay`
    - If transaction day >= cutoffDay → belongs to NEXT month's statement
    - If transaction day < cutoffDay → belongs to THIS month's statement
- ✅ Any transaction with `paymentMethod: 'card'` auto-links to bill
- ✅ Editing transaction = bill amount updates automatically
- ✅ Deleting transaction = bill amount updates automatically
- ✅ Mark as paid manually (payment tracking)
- ✅ Each bill shows breakdown of transactions
- ✅ Transactions grouped into correct billing cycle automatically

// Get statement with transactions
async getStatementWithTransactions(cardId: string, monthStr: string) {
  const statement = await this.getStatement(cardId, monthStr);
  const transactions = await this.transactionService.getTransactions({
    cardId,
    dateRange: {
      start: `${monthStr}-01`,
      end: `${monthStr}-31`
    }
  });
  
  return {
    ...statement,
    transactions,
    calculatedTotal: transactions.reduce((sum, t) => sum + t.amount, 0)
  };
}
```

**UI Flow: Adding Transaction**

```
User clicks [+ Add Transaction]
↓
Modal/Page Opens:
┌─────────────────────────────────────┐
│ Add Transaction                     │
├─────────────────────────────────────┤
│ Amount: [_______]                   │
│ Type: (•) Expense  ( ) Income       │
│ Description: [___________]          │
│ Category: [Food & Dining ▼]         │
│ Date: [Jan 21, 2026 ▼]             │
│                                     │
│ Payment Method:                     │
│ (•) Credit Card                     │
│     [Chase Freedom ▼]              │
│     ✓ Add to card statement        │
│                                     │
│ ( ) Cash                            │
│ ( ) Bank Transfer                   │
│                                     │
│ Notes: [___________]                │
│                                     │
│ [Cancel]              [Save]        │
└─────────────────────────────────────┘
```

**Card Statement View with Transactions**

```
┌─────────────────────────────────────────────────────────┐
│ Chase Freedom - January 2026                            │
├─────────────────────────────────────────────────────────┤
│ Statement Amount: $1,850.00        Due: Jan 25          │
│ [Mark as Paid]                     [Export CSV]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Transactions (15)                                       │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 🍔 Restaurant - Jan 21            -$45.00       │   │
│ │ 🛒 Grocery Store - Jan 20         -$150.00      │   │
│ │ ⛽ Gas Station - Jan 19           -$60.00       │   │
│ │ 💊 Pharmacy - Jan 18              -$25.00       │   │
│ │ ... and 11 more                                 │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ By Category:                                            │
│ Food & Dining:    $580.00 (31%)                        │
│ Shopping:         $450.00 (24%)                        │
│ Transportation:   $340.00 (18%)                        │
│ Healthcare:       $230.00 (12%)                        │
│ Other:            $250.00 (14%)                        │
└─────────────────────────────────────────────────────────┘
```

---

#### Component Refactoring Checklist

**Phase 0.2: UI Component Architecture**

**1. Shared Components (Reusable)**
```
src/app/shared/components/
├── transaction-card.component.ts       # Display single transaction
├── transaction-list.component.ts       # List with virtual scroll
├── transaction-form.component.ts       # Add/Edit transaction modal
├── payment-method-selector.component.ts # Card/Cash/Bank selector
├── category-selector.component.ts      # Category picker
├── amount-input.component.ts           # Currency input with validation
├── date-range-picker.component.ts      # Filter by date range
├── balance-overview-card.component.ts  # Total/Available/Committed
├── quick-stats-card.component.ts       # Metric cards
├── spending-chart.component.ts         # Category pie/bar charts
└── budget-progress-bar.component.ts    # Category budget bars
```

**2. Feature Components (Pages)**
```
src/app/features/
├── overview/                           # NEW - Replaces dashboard
│   ├── overview.component.ts
│   ├── overview.component.html
│   └── components/
│       ├── metrics-cards.component.ts
│       ├── quick-actions.component.ts
│       ├── upcoming-bills-widget.component.ts
│       ├── recent-transactions-widget.component.ts
│       └── budget-summary-widget.component.ts
│
├── transactions/                       # NEW - Core feature
│   ├── transactions.component.ts
│   ├── transactions.component.html
│   └── components/
│       ├── transaction-filters.component.ts
│       ├── transaction-summary.component.ts
│       └── transaction-group.component.ts
│
├── bills/                              # RENAMED from dashboard
│   ├── bills.component.ts             # Focused on bills only
│   ├── bills.component.html
│   └── components/
│       ├── credit-card-bill.component.ts
│       ├── installment-bill.component.ts
│       ├── bills-calendar.component.ts
│       └── bill-detail-modal.component.ts
│
├── budget/                             # NEW
│   ├── budget.component.ts
│   ├── budget.component.html
│   └── components/
│       ├── budget-overview.component.ts
│       ├── category-budget-card.component.ts
│       └── budget-form-modal.component.ts
│
├── calendar/                           # KEEP - Enhanced
│   └── (existing calendar view)
│
├── manage/                             # KEEP - Cards & Installments
│   └── (existing manage view)
│
└── sync/                               # KEEP
    └── (existing sync view)
```

**3. Services (Enhanced)**
```
src/app/core/services/
├── transaction.service.ts              # NEW - Core transaction CRUD
├── category.service.ts                 # NEW - Category management
├── budget.service.ts                   # NEW - Budget tracking
├── commitment.service.ts               # NEW - Available balance logic
├── card.service.ts                     # ENHANCED - Link to transactions
├── statement.service.ts                # ENHANCED - Transaction breakdown
├── bank-balance.service.ts             # ENHANCED - Transaction-based calc
└── (existing services...)
```

**4. Routes Update**
```typescript
// src/app/app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: '/overview', pathMatch: 'full' },
  
  // Primary Navigation
  { path: 'overview', component: OverviewComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'bills', component: BillsComponent },
  { path: 'budget', component: BudgetComponent },
  
  // Secondary Pages
  { path: 'calendar', component: CalendarComponent },
  { path: 'manage', component: ManageComponent },
  { path: 'savings-goals', component: SavingsGoalsComponent },
  { path: 'planned-purchases', component: PlannedPurchasesComponent },
  { path: 'loan-planning', component: LoanPlanningComponent },
  { path: 'analytics', component: AnalyticsComponent },
  { path: 'sync', component: SyncComponent },
];
```

**5. Navigation Component Update**
```typescript
// src/app/app.component.html
<nav class="primary-nav">
  <a routerLink="/overview" routerLinkActive="active">Overview</a>
  <a routerLink="/transactions" routerLinkActive="active">Transactions</a>
  <a routerLink="/bills" routerLinkActive="active">Bills</a>
  <a routerLink="/budget" routerLinkActive="active">Budget</a>
  
  <div class="dropdown">
    <button>More ▼</button>
    <div class="menu">
      <a routerLink="/calendar">Calendar</a>
      <a routerLink="/manage">Manage Cards</a>
      <a routerLink="/savings-goals">Savings Goals</a>
      <a routerLink="/planned-purchases">Planned Purchases</a>
      <a routerLink="/analytics">Analytics</a>
      <a routerLink="/sync">Sync & Settings</a>
    </div>
  </div>
</nav>
```

---

#### Migration Path: Old UI → New UI

**Step-by-Step Refactoring:**

1. **Week 1-2: Create New Components (Parallel)**
   - Build new Overview page (doesn't break existing)
   - Build Transaction components
   - Build Budget components
   - Keep old Dashboard running

2. **Week 3: Add New Routes**
   - Add /overview, /transactions, /budget routes
   - Old /dashboard still works
   - Users can switch between old/new

3. **Week 4: Data Layer Integration**
   - Connect new components to services
   - Ensure transaction → card linking works
   - Test data flow

4. **Week 5: Rename & Redirect**
   - Rename Dashboard → Bills
   - Redirect /dashboard → /overview
   - Update all internal links

5. **Week 6: Polish & Remove Old Code**
   - Remove deprecated components
   - Clean up unused services
   - Update documentation

**Feature Flag Approach:**
```typescript
// Enable gradual rollout
const UI_VERSION = localStorage.getItem('ui-version') || 'new';

if (UI_VERSION === 'new') {
  // Use new Overview page
  defaultRoute = '/overview';
} else {
  // Use old Dashboard
  defaultRoute = '/dashboard';
}

// Settings toggle
<button (click)="switchToNewUI()">Try New Interface (Beta)</button>
```

---

#### Design System Updates

**Color Coding:**
- 🟢 Green: Income, Savings, Positive
- 🔴 Red: Expenses, Overbudget, Critical
- 🟡 Yellow: Warnings, Approaching limit
- 🔵 Blue: Information, Neutral
- ⚫ Gray: Inactive, Paid

**Icons:**
- 💰 Available Balance
- 🏦 Bank Balance
- 📊 Committed
- 💳 Credit Card
- 💵 Cash
- 📈 Income
- 📉 Expense
- 🍔 Food & Dining
- 🚗 Transportation
- 🏠 Housing
- ... (category icons)

**Typography:**
- Large amounts: 32px bold (key metrics)
- Medium amounts: 20px (cards, lists)
- Small amounts: 16px (details)
- Labels: 14px (descriptions)

---

### High Priority (Next 3-6 months)
1. ✅ **Transaction tracking foundation**
   - Basic transaction CRUD
   - Category system
   - Transaction list/dashboard
   - Integration with existing features

2. ✅ **Available vs Committed Balance**
   - Bank balance breakdown
   - Commitment tracking
   - Real available balance calculation
   - Cash flow projection
   - Smart spending alerts

3. ✅ **Budget management**
   - Monthly budgets
   - Category allocations
   - Budget vs actual tracking
   - Basic alerts

4. ✅ **Planned purchases**
   - Purchase planner
   - Affordability calculator
   - Basic wishlist

### Medium Priority (6-12 months)
5. **Enhanced analytics**
   - Charts and visualizations
   - Spending insights
   - Financial health score

6. **Savings goals**
   - Goal tracking
   - Progress visualization
   - Contribution planning

7. **Loan planning**
   - Mortgage/auto loan calculator
   - Affordability analysis based on real data
   - Down payment planner
   - Amortization schedules

8. **Advanced budgeting**
   - Budget templates
   - Rollover budgets
   - Multi-period budgets

### Low Priority (12+ months)
9. **Automation & ML**
   - Receipt scanning
   - Recurring transaction detection
   - Smart categorization

10. **Bank integration**
    - Account linking
    - Auto-import transactions

11. **Mobile app**
    - Native mobile apps
    - Advanced mobile features

---

## Technical Considerations

### Storage Architecture Migration 💾

#### Current State
- **Primary Storage**: LocalStorage with JSON serialization
- **Sync**: Optional Firebase Firestore for cloud backup
- **Limitation**: ~10MB LocalStorage limit

#### Recommended Migration: LocalStorage → IndexedDB

**Why IndexedDB?**
- ✅ **50MB+ storage** (vs 10MB LocalStorage)
- ✅ **Structured data**: Better than JSON strings
- ✅ **Indexed queries**: Fast lookups on large datasets
- ✅ **Transaction support**: ACID guarantees
- ✅ **Async API**: Non-blocking performance
- ✅ **Browser support**: All modern browsers
- ✅ **Still local-first**: Privacy preserved

**Migration Strategy:**

```typescript
// Phase 0: Create abstraction layer
interface StorageProvider {
  // Profiles
  getProfiles(): Promise<Profile[]>;
  saveProfile(profile: Profile): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  
  // Cards
  getCards(): Promise<CreditCard[]>;
  saveCard(card: CreditCard): Promise<void>;
  deleteCard(id: string): Promise<void>;
  
  // Transactions
  getTransactions(filters?: TransactionFilter): Promise<Transaction[]>;
  saveTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  
  // Statements
  getStatements(): Promise<Statement[]>;
  saveStatement(statement: Statement): Promise<void>;
  
  // ... etc for all entities
}

// Implementation 1: LocalStorage (current)
class LocalStorageProvider implements StorageProvider {
  private storage = new StorageService();
  
  async getProfiles(): Promise<Profile[]> {
    return this.storage.getProfiles();
  }
  // ... existing implementation
}

// Implementation 2: IndexedDB (new)
class IndexedDBProvider implements StorageProvider {
  private db: IDBDatabase;
  private dbName = 'ng-bills';
  private version = 1;
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('profileId', 'profileId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('profileId', 'profileId', { unique: false });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('categoryId', 'categoryId', { unique: false });
          txStore.createIndex('cardId', 'cardId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('statements')) {
          const stmtStore = db.createObjectStore('statements', { keyPath: 'id' });
          stmtStore.createIndex('cardId', 'cardId', { unique: false });
          stmtStore.createIndex('monthStr', 'monthStr', { unique: false });
        }
        
        // ... other stores
      };
    });
  }
  
  async getProfiles(): Promise<Profile[]> {
    return this.getAll<Profile>('profiles');
  }
  
  async saveProfile(profile: Profile): Promise<void> {
    return this.put('profiles', profile);
  }
  
  async getTransactions(filters?: TransactionFilter): Promise<Transaction[]> {
    // Use indexes for efficient filtering
    if (filters?.profileId) {
      return this.getByIndex('transactions', 'profileId', filters.profileId);
    }
    return this.getAll('transactions');
  }
  
  private async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  private async put(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  private async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Implementation 3: Firestore (optional, existing)
class FirestoreProvider implements StorageProvider {
  // Firebase implementation for cloud sync
}

// Factory pattern
class StorageFactory {
  static create(type: 'local' | 'indexeddb' | 'firestore'): StorageProvider {
    switch(type) {
      case 'local':
        return new LocalStorageProvider();
      case 'indexeddb':
        return new IndexedDBProvider();
      case 'firestore':
        return new FirestoreProvider();
    }
  }
}
```

#### Migration Steps

**Phase 0.5: Storage Abstraction (Before Phase 1)**

1. **Create StorageProvider interface**
   - Define all storage operations
   - Make it async-first
   
2. **Wrap existing LocalStorage**
   - Implement LocalStorageProvider
   - No behavior changes, just abstraction
   
3. **Update all services**
   - ProfileService, CardService, etc.
   - Use StorageProvider interface
   - All existing code still works

4. **Implement IndexedDBProvider**
   - Create database schema
   - Implement all operations
   - Add indexes for performance

5. **Data Migration Tool**
   ```typescript
   async migrateLocalStorageToIndexedDB(): Promise<void> {
     const localProvider = new LocalStorageProvider();
     const idbProvider = new IndexedDBProvider();
     await idbProvider.init();
     
     // Migrate all data
     const profiles = await localProvider.getProfiles();
     for (const profile of profiles) {
       await idbProvider.saveProfile(profile);
     }
     
     const cards = await localProvider.getCards();
     for (const card of cards) {
       await idbProvider.saveCard(card);
     }
     
     // ... migrate all entities
     
     // Mark migration complete
     localStorage.setItem('migrated-to-indexeddb', 'true');
   }
   ```

6. **User Settings**
   - Add storage preference: "Local" (IndexedDB) or "Cloud" (Firestore)
   - Default to IndexedDB for new users
   - Auto-migrate existing users on first load
   - Keep LocalStorage as fallback if IndexedDB fails

7. **Backwards Compatibility**
   - Detect if user has LocalStorage data
   - Auto-migrate to IndexedDB on app load
   - Show migration progress
   - Keep LocalStorage backup until confirmed

#### Hybrid Sync Strategy

**Local-First, Cloud-Optional:**

```typescript
class HybridStorageService {
  private localProvider: IndexedDBProvider;
  private cloudProvider?: FirestoreProvider;
  private syncEnabled: boolean;
  
  constructor() {
    this.localProvider = new IndexedDBProvider();
    this.syncEnabled = this.getSyncPreference();
    
    if (this.syncEnabled) {
      this.cloudProvider = new FirestoreProvider();
      this.setupBidirectionalSync();
    }
  }
  
  async saveProfile(profile: Profile): Promise<void> {
    // Always save locally first (fast)
    await this.localProvider.saveProfile(profile);
    
    // Sync to cloud if enabled (background)
    if (this.syncEnabled && this.cloudProvider) {
      this.cloudProvider.saveProfile(profile).catch(err => {
        console.error('Cloud sync failed', err);
        // Still works offline
      });
    }
  }
  
  private setupBidirectionalSync(): void {
    // Listen for remote changes (Firestore real-time)
    this.cloudProvider?.onProfileChange((profile) => {
      this.localProvider.saveProfile(profile);
    });
    
    // Sync local changes to cloud
    // ... implement conflict resolution
  }
}
```

#### Performance Benefits

**For Transactions (thousands of records):**

LocalStorage:
```typescript
// Slow: Parse entire JSON, filter in memory
const allTransactions = JSON.parse(localStorage.getItem('transactions'));
const filtered = allTransactions.filter(t => t.categoryId === 'food');
```

IndexedDB:
```typescript
// Fast: Use index, return only matches
const filtered = await idb.getByIndex('transactions', 'categoryId', 'food');
```

**Query Performance Comparison:**

| Operation | LocalStorage | IndexedDB | Firestore |
|-----------|--------------|-----------|-----------|
| 100 transactions | 5ms | 2ms | 50ms (network) |
| 1,000 transactions | 50ms | 5ms | 80ms |
| 10,000 transactions | 500ms | 20ms | 150ms |
| 100,000 transactions | ❌ Crashes | 100ms | 300ms |

#### Storage Limits

| Storage Type | Limit | Best For |
|--------------|-------|----------|
| LocalStorage | ~10MB | Current MVP |
| IndexedDB | 50MB-500MB+ | Years of transactions |
| Firestore | Unlimited | Power users, families |

#### Rollout Plan

**Week 1-2: Foundation**
- [ ] Create StorageProvider interface
- [ ] Wrap existing services
- [ ] Write comprehensive tests

**Week 3-4: IndexedDB Implementation**
- [ ] Build IndexedDBProvider
- [ ] Create database schema
- [ ] Add indexes for common queries

**Week 5: Migration Tool**
- [ ] Auto-detect LocalStorage data
- [ ] Build migration UI with progress
- [ ] Test with production-like data

**Week 6: Testing & Rollout**
- [ ] Beta test with sample users
- [ ] Monitor for issues
- [ ] Full rollout with fallback option

**Post-Migration:**
- [ ] Keep LocalStorage as backup (read-only)
- [ ] Add data export/import tools
- [ ] Monitor storage usage analytics
- [ ] Optimize indexes based on usage

#### Future: Firestore Enhancement

Once IndexedDB is stable, enhance Firestore option:

- **Firestore Security Rules**
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```

- **Optimistic Updates**: Save locally, sync in background
- **Conflict Resolution**: Last-write-wins or manual merge
- **Selective Sync**: Choose which profiles to sync
- **Offline Persistence**: Firestore offline mode

#### Decision Matrix

**Choose IndexedDB (Local) if:**
- Privacy is top priority
- Single device usage
- Don't want cloud costs
- Want instant performance

**Choose Firestore (Cloud) if:**
- Multi-device sync needed
- Family/shared profiles
- Want automatic backup
- Have lots of data (100K+ transactions)

**Hybrid (Recommended):**
- Default to IndexedDB
- Offer Firestore as premium option
- Best user experience for all

### Data Model Extensions
- New services: `TransactionService`, `BudgetService`, `GoalService`, `PurchaseService`
- Enhanced storage layer for larger datasets
- Database migration system for schema changes
- Data archival for old transactions

### Performance Optimizations
- Virtual scrolling for large transaction lists
- Lazy loading of historical data
- IndexedDB for client-side storage
- Background sync for offline mode
- Pagination for API calls

### UI/UX Improvements
- Onboarding flow for new users
- Feature tours
- Keyboard shortcuts
- Customizable dashboard widgets
- Dark mode refinements

### Security & Privacy
- End-to-end encryption for sensitive data
- Local data encryption at rest (IndexedDB encryption wrapper)
- Secure token handling
- Privacy mode (hide amounts)
- Data export for user control
- IndexedDB encryption for offline security

---

## Recent Completions

### ✅ Phase 0 & Phase 1 (Completed Jan 22, 2026)

The foundational transaction layer is complete with all core functionality:

**Key Achievements:**

- **Full Transaction Management**: Income/expense tracking with category support, advanced filtering, real-time search
- **Auto-Bill Generation**: Cutoff-date-aware automatic bill creation from card transactions
- **Bills & Payments**: Complete statement management with transaction breakdowns, payment recording, manual bill
  creation
- **Category System**: 20 predefined categories with icons/colors, custom category framework
- **Budget Tracking**: Real-time category-based budgets with progress bars and alerts
- **Production Ready**: 817 KB bundle, all components compile successfully

**What Works Now:**

- Add transactions → automatically creates/updates monthly bills
- Filter transactions by type, payment method, card, date, category
- View bills with linked transaction breakdowns
- Record payments and track payment history
- Create manual bills for quick entry (when no time for individual transactions)
- Track spending against category budgets in real-time
- Color-coded progress indicators and overspend alerts

**Technology Stack:**

- Angular 21 standalone components with signals
- IndexedDB for local-first storage
- Tailwind CSS for responsive UI
- Lucide Angular for icons
- date-fns for date manipulation

**Next Phase:** Phase 2 (Budgeting & Goals) - Enhanced budgeting with BudgetService, savings goals, rollover budgets,
and goal progress tracking.

---

## Feedback & Contributions

This roadmap is a living document. Priorities may change based on:
- User feedback
- Technical feasibility
- Market trends
- Development resources

Have suggestions? Open an issue or contribute to the discussion!

---

**Last Updated**: January 22, 2026  
**Version**: 3.0  
**Status**: Phase 0, 1 & 2 Complete

**Current State Summary:**
- ✅ Phase 0: UI/IA Refactor - COMPLETE
- ✅ Phase 1: Transaction Layer - COMPLETE
- ✅ Phase 2: Legacy Migration - COMPLETE
  - ✅ All Installments and CashInstallments migrated to recurring Transactions
  - ✅ CashInstallment entity and service removed from codebase
  - ✅ CASH_INSTALLMENTS store removed from IndexedDB
  - ✅ Payment tracking implemented for cash installments
  - ✅ Enhanced installment progress visualization with color-coded badges
  - ✅ All components updated to use Transaction model
  - ✅ Sync services updated to handle migrated data
