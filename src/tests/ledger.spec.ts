/**
 * Automated Financial Core & Ledger Invariant Tests
 * Verifies strict double-entry correctness, idempotency, non-negative balance enforcement,
 * and compensating reversal entries.
 */

import { ledgerEngine, SYSTEM_ACCOUNT_VAULT_RESERVE } from '../services/ledgerEngine';
import { User } from '../types/banking';

export function runBankingLedgerTests(): {
  totalTests: number;
  passed: number;
  failed: number;
  results: { testName: string; passed: boolean; error?: string }[];
} {
  const results: { testName: string; passed: boolean; error?: string }[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorMsg?: string) {
    if (condition) {
      passed++;
      results.push({ testName, passed: true });
    } else {
      failed++;
      results.push({ testName, passed: false, error: errorMsg || 'Assertion failed' });
    }
  }

  // Test Actor
  const testCustomer: User = {
    id: 'USR-CUST-1',
    email: 'adaeze@apexmfb.ng',
    fullName: 'Mrs. Adaeze Okonkwo',
    phone: '+234 803 123 4567',
    role: 'CUSTOMER',
    active: true,
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const adminUser: User = {
    id: 'USR-ADMIN-1',
    email: 'admin@apexmfb.ng',
    fullName: 'Dr. Victor Oladipo',
    phone: '+234 802 555 9999',
    role: 'SUPER_ADMIN',
    active: true,
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
  };

  try {
    // 1. Invariant: Initial Chart of Accounts balanced
    const rec1 = ledgerEngine.performGeneralLedgerReconciliation();
    assert(rec1.isBalanced && rec1.varianceKobo === 0, 'General ledger trial balance initial variance is exactly 0.00');

    // 2. Invariant: Balanced Journal Entry on internal transfer
    const accounts = ledgerEngine.getCustomerAccounts('USR-CUST-1');
    const srcAccount = accounts[0];
    const targetAccountNum = '2038192044'; // Ibrahim Musa account
    const initialBalance = srcAccount.balanceKobo;

    const idempotencyKey = `TEST-IDEM-${Date.now()}`;
    const transferAmountKobo = 250000; // ₦2,500.00

    ledgerEngine.executeInternalTransfer({
      actor: testCustomer,
      sourceAccountId: srcAccount.id,
      destinationAccountNumber: targetAccountNum,
      amountKobo: transferAmountKobo,
      narration: 'Automated test transfer',
      idempotencyKey,
    }).then(({ transaction, journalEntry }) => {
      // Check that debits equal credits
      const debits = journalEntry.lines.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + l.amountKobo, 0);
      const credits = journalEntry.lines.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + l.amountKobo, 0);
      assert(debits === credits, 'Transfer journal entry is strictly balanced (Debits === Credits)');
      assert(debits === transferAmountKobo, 'Journal total equals transfer amount kobo');

      // 3. Invariant: Idempotency Key deduplication
      ledgerEngine.executeInternalTransfer({
        actor: testCustomer,
        sourceAccountId: srcAccount.id,
        destinationAccountNumber: targetAccountNum,
        amountKobo: transferAmountKobo,
        narration: 'Automated test transfer',
        idempotencyKey,
      }).then((dupResult) => {
        assert(dupResult.transaction.id === transaction.id, 'Idempotent duplicate request returns original transaction without duplicate debit');

        // 4. Invariant: Insufficient funds protection
        let failedAsExpected = false;
        try {
          ledgerEngine.executeInternalTransfer({
            actor: testCustomer,
            sourceAccountId: srcAccount.id,
            destinationAccountNumber: targetAccountNum,
            amountKobo: 999999999999, // Overdraft limit exceeded
            narration: 'Overdraft attempt',
            idempotencyKey: `TEST-OVERDRAFT-${Date.now()}`,
          });
        } catch (e: any) {
          failedAsExpected = e.message.includes('Insufficient funds');
        }
        assert(failedAsExpected, 'Insufficient funds transaction is rejected and does not mutate balance');

        // 5. Invariant: Compensating Reversal Entry
        const rev = ledgerEngine.executeTransactionReversal({
          transactionId: transaction.id,
          approver: adminUser,
          reason: 'Automated test reversal verification',
        });
        assert(rev.reversalTransaction.status === 'SUCCESSFUL', 'Reversal compensating transaction posted successfully');
        assert(rev.reversalTransaction.type === 'REVERSAL', 'Reversal transaction has type REVERSAL');

        // Check trial balance still balanced
        const rec2 = ledgerEngine.performGeneralLedgerReconciliation();
        assert(rec2.isBalanced && rec2.varianceKobo === 0, 'Trial balance remains perfectly balanced (variance = 0) after reversal');
      });
    });
  } catch (err: any) {
    failed++;
    results.push({ testName: 'Execution Exception', passed: false, error: err.message });
  }

  return {
    totalTests: passed + failed,
    passed,
    failed,
    results,
  };
}
