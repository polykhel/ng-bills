# ng-bills Roadmap

This document outlines planned features and enhancements to transform ng-bills into a comprehensive personal finance management platform.

## Phase 1: Transaction Tracking 💸

### Core Transaction Features
Transform the app from bill tracking to full transaction management.

#### Transaction Types
- **Income Transactions**
  - Salary/wages
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
**Storage Architecture Migration**
- [ ] Create StorageProvider abstraction layer
- [ ] Implement IndexedDBProvider
- [ ] Build LocalStorage → IndexedDB migration tool
- [ ] Auto-migrate existing users
- [ ] Test with large datasets
- [ ] Keep Firebase sync as optional cloud backup

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

## Feedback & Contributions

This roadmap is a living document. Priorities may change based on:
- User feedback
- Technical feasibility
- Market trends
- Development resources

Have suggestions? Open an issue or contribute to the discussion!

---

**Last Updated**: January 2026  
**Version**: 2.0  
**Status**: Planning Phase
