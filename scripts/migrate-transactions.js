#!/usr/bin/env node

/**
 * Migration script: backfill isVirtual and isBudgetImpacting for transactions
 * created before the parent/virtual installment model.
 *
 * Use with ng-bills export JSON:
 *   1. Export data from app (Settings → Export / backup).
 *   2. node scripts/migrate-transactions.js backup.json > migrated.json
 *   3. Import migrated.json via app, or use --in-place to overwrite backup.json.
 *
 * Usage:
 *   node scripts/migrate-transactions.js [input.json] [--in-place]
 *   cat backup.json | node scripts/migrate-transactions.js
 */

const fs = require('fs');
const path = require('path');

function migrateTransaction(t) {
  let isVirtual = t.isVirtual;
  let isBudgetImpacting = t.isBudgetImpacting;
  if (isVirtual === undefined) isVirtual = false;
  if (isBudgetImpacting === undefined) isBudgetImpacting = true;
  return { ...t, isVirtual, isBudgetImpacting };
}

function migrateTransactions(transactions) {
  if (!Array.isArray(transactions)) return { data: [], changed: false };
  let changed = false;
  const result = transactions.map((t) => {
    const migrated = migrateTransaction(t);
    if (
      t.isVirtual !== migrated.isVirtual ||
      t.isBudgetImpacting !== migrated.isBudgetImpacting
    ) {
      changed = true;
    }
    return migrated;
  });
  return { data: result, changed };
}

function main() {
  const args = process.argv.slice(2);
  const inPlace = args.includes('--in-place');
  const files = args.filter((a) => a !== '--in-place');

  let input;
  let inputPath;

  if (files.length) {
    inputPath = path.resolve(files[0]);
    if (!fs.existsSync(inputPath)) {
      console.error('Input file not found:', inputPath);
      process.exit(1);
    }
    input = fs.readFileSync(inputPath, 'utf8');
  } else if (process.stdin.isTTY) {
    console.error('Usage: node scripts/migrate-transactions.js [input.json] [--in-place]');
    console.error('       cat backup.json | node scripts/migrate-transactions.js');
    process.exit(1);
  } else {
    input = fs.readFileSync(0, 'utf8');
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  const key = 'transactions';
  if (!(key in data)) {
    console.error('Expected export JSON with "transactions" key.');
    process.exit(1);
  }

  const { data: migrated, changed } = migrateTransactions(data[key]);
  data[key] = migrated;

  const out = JSON.stringify(data, null, 2);

  if (inPlace && inputPath) {
    fs.writeFileSync(inputPath, out, 'utf8');
    console.error(
      changed
        ? `Migrated ${migrated.length} transactions; updated ${inputPath}`
        : `No changes needed; ${inputPath} unchanged`
    );
  } else {
    process.stdout.write(out);
    if (process.stderr.isTTY && changed) {
      console.error(`Migrated ${migrated.length} transactions.`);
    }
  }
}

main();
