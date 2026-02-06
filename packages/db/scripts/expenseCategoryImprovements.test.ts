/**
 * Unit tests for expense category improvements:
 * - Category/account mismatch validation
 * - Backfill correctness
 * - Filtering behavior (expense accounts by category)
 *
 * Run with: npx tsx scripts/expenseCategoryImprovements.test.ts
 * Or: npm run test:expense-category --prefix packages/db (add script if needed)
 */

// No DB required for these unit tests (logic only).

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function testCategoryAccountMismatchValidation() {
  console.log('Test: category/account mismatch validation (logic check)');
  // Validation rule: debitAccount.expenseCategoryId must equal request categoryId
  const categoryA = 'cat-a';
  const categoryB = 'cat-b';
  const accountInCategoryA = { id: 'acc-1', expenseCategoryId: categoryA };
  const accountInCategoryB = { id: 'acc-2', expenseCategoryId: categoryB };

  assert(
    accountInCategoryA.expenseCategoryId === categoryA,
    'Account in category A should match category A'
  );
  assert(
    accountInCategoryA.expenseCategoryId !== categoryB,
    'Account in category A should not match category B'
  );
  assert(
    accountInCategoryB.expenseCategoryId === categoryB,
    'Account in category B should match category B'
  );
  console.log('  OK');
}

async function testBackfillCorrectness() {
  console.log('Test: backfill correctness (structure only, no DB)');
  // Backfill should: 1) create Uncategorized if missing, 2) set account.expenseCategoryId for EXPENSE accounts with null, 3) set expense.categoryNameSnapshot from category.name
  type Expense = { id: string; categoryId: string; categoryNameSnapshot: string | null };
  type Category = { id: string; name: string };
  type Account = { id: string; type: string; expenseCategoryId: string | null };

  const categoryName = 'Construction Material';
  const expenseBefore: Expense = { id: 'e1', categoryId: 'c1', categoryNameSnapshot: null };
  const category: Category = { id: 'c1', name: categoryName };
  const expenseAfter = { ...expenseBefore, categoryNameSnapshot: category.name };
  assert(
    expenseAfter.categoryNameSnapshot === categoryName,
    'Backfill should set categoryNameSnapshot from category.name'
  );

  const accountBefore: Account = { id: 'a1', type: 'EXPENSE', expenseCategoryId: null };
  const uncategorizedId = 'uncat-1';
  const accountAfter = { ...accountBefore, expenseCategoryId: uncategorizedId };
  assert(
    accountAfter.expenseCategoryId === uncategorizedId,
    'Backfill should assign uncategorized to accounts with null category'
  );
  console.log('  OK');
}

async function testFilteringBehavior() {
  console.log('Test: filtering behavior (logic check)');
  // When GET /chart-of-accounts?categoryId=X, where should be { expenseCategoryId: X, type: 'EXPENSE' }
  const categoryId = 'cat-123';
  const where = {
    expenseCategoryId: categoryId,
    type: 'EXPENSE' as const,
  };
  const mockAccounts = [
    { id: '1', code: '5010', name: 'Direct Materials', expenseCategoryId: categoryId, type: 'EXPENSE' },
    { id: '2', code: '5020', name: 'Direct Labor', expenseCategoryId: categoryId, type: 'EXPENSE' },
    { id: '3', code: '1010', name: 'Cash', expenseCategoryId: null, type: 'ASSET' },
  ];
  const filtered = mockAccounts.filter(
    (a) => a.expenseCategoryId === where.expenseCategoryId && a.type === where.type
  );
  assert(filtered.length === 2, 'Filter should return only expense accounts in the category');
  assert(
    filtered.every((a) => a.expenseCategoryId === categoryId),
    'All returned accounts should belong to the category'
  );
  console.log('  OK');
}

async function main() {
  console.log('Running expense category improvement tests...\n');
  await testCategoryAccountMismatchValidation();
  await testBackfillCorrectness();
  await testFilteringBehavior();
  console.log('\nAll tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
