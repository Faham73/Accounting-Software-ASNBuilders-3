/**
 * Backfill expense_category_id on accounts and category_name_snapshot on expenses.
 * Run after migration 20250206120000_expense_category_improvements.
 *
 * Usage: npm run backfill:expense-category (from packages/db)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    // 1. Ensure "Uncategorized" expense category exists
    let uncategorized = await prisma.expenseCategory.findFirst({
      where: { companyId: company.id, name: 'Uncategorized' },
    });
    if (!uncategorized) {
      uncategorized = await prisma.expenseCategory.create({
        data: {
          companyId: company.id,
          name: 'Uncategorized',
          code: 'UNCAT',
          isActive: true,
          sortOrder: 9999,
        },
      });
      console.log(`Created Uncategorized category for company ${company.id}`);
    }

    // 2. Assign EXPENSE accounts without expenseCategoryId to Uncategorized
    const updated = await prisma.account.updateMany({
      where: {
        companyId: company.id,
        type: 'EXPENSE',
        expenseCategoryId: null,
      },
      data: { expenseCategoryId: uncategorized.id },
    });
    if (updated.count > 0) {
      console.log(`Company ${company.id}: assigned ${updated.count} expense accounts to Uncategorized`);
    }
  }

  // 3. Backfill category_name_snapshot on expenses (from category.name)
  const expenses = await prisma.expense.findMany({
    where: { categoryNameSnapshot: null },
    include: { category: { select: { name: true } } },
  });

  for (const exp of expenses) {
    await prisma.expense.update({
      where: { id: exp.id },
      data: { categoryNameSnapshot: exp.category.name },
    });
  }
  if (expenses.length > 0) {
    console.log(`Backfilled category_name_snapshot for ${expenses.length} expenses`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
