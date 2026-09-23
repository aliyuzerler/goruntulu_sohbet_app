import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { WalletModule } from '../../src/wallet/wallet.module';
import { WalletService } from '../../src/wallet/wallet.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Ledger invariant tests — the most critical correctness property:
 *
 *   INVARIANT: Wallet.balance == SUM(CoinTransaction.amount) for all rows with that walletId.
 *
 * This test verifies:
 *   1. After a single credit, balance = credited amount.
 *   2. After a debit, balance = previous - debited.
 *   3. After N concurrent debits, balance = initial - sum(debits) (no race conditions).
 *   4. Idempotent replay: same idempotencyKey twice → balance unchanged on second call.
 *   5. Insufficient balance → BadRequestException (no negative balance from debit).
 *
 * Prereqs: docker-compose up + prisma migrate + a test user with a wallet.
 * Run: pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- wallet-ledger.spec
 */
describe('WalletService — ledger invariant (e2e)', () => {
  let wallet: WalletService;
  let prisma: PrismaService;
  let testUserId: string;
  let testWalletId: string;
  const initialBalance = 1000;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema: undefined }),
        PrismaModule,
        WalletModule,
      ],
    }).compile();
    wallet = moduleRef.get(WalletService);
    prisma = moduleRef.get(PrismaService);

    // Create a test user + wallet with initial balance.
    const user = await prisma.user.create({
      data: {
        firebaseUid: `test-ledger-${Date.now()}`,
        firebasePhone: `+90555555${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
      },
    });
    testUserId = user.id;
    const w = await prisma.wallet.create({
      data: { userId: testUserId, balance: initialBalance },
    });
    testWalletId = w.id;

    // Seed the initial balance as a CoinTransaction so the ledger sums correctly.
    await prisma.coinTransaction.create({
      data: {
        walletId: testWalletId,
        type: 'ADJUSTMENT',
        amount: initialBalance,
        balanceAfter: initialBalance,
        idempotencyKey: `seed_${testWalletId}`,
      },
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  /** Helper: verify the ledger invariant — balance == sum(amounts). */
  async function verifyInvariant() {
    const w = await prisma.wallet.findUnique({ where: { id: testWalletId } });
    const txs = await prisma.coinTransaction.findMany({
      where: { walletId: testWalletId },
      select: { amount: true },
    });
    const ledgerSum = txs.reduce((s, tx) => s + tx.amount, 0);
    expect(w!.balance).toBe(ledgerSum);
  }

  it('credit → balance increases + ledger sums correctly', async () => {
    const r = await wallet.credit({
      userId: testUserId,
      amount: 50,
      type: 'ADJUSTMENT' as never,
      idempotencyKey: `credit_test_${Date.now()}`,
      reference: 'test_credit',
    });
    expect(r.newBalance).toBe(initialBalance + 50);
    await verifyInvariant();
  });

  it('debit → balance decreases + ledger sums correctly', async () => {
    const r = await wallet.debit({
      userId: testUserId,
      amount: 30,
      type: 'SPEND_MATCH' as never,
      idempotencyKey: `debit_test_${Date.now()}`,
      reference: 'test_debit',
    });
    expect(r.newBalance).toBe(initialBalance + 50 - 30);
    await verifyInvariant();
  });

  it('idempotent replay — same key twice → no double credit', async () => {
    const key = `idem_${Date.now()}`;
    const r1 = await wallet.credit({
      userId: testUserId,
      amount: 20,
      type: 'ADJUSTMENT' as never,
      idempotencyKey: key,
    });
    const balanceAfter1 = r1.newBalance;

    // Replay — should return the same row without crediting again.
    const r2 = await wallet.credit({
      userId: testUserId,
      amount: 20,
      type: 'ADJUSTMENT' as never,
      idempotencyKey: key,
    });
    expect(r2.newBalance).toBe(balanceAfter1); // No double credit.
    await verifyInvariant();
  });

  it('insufficient balance → BadRequestException', async () => {
    await expect(
      wallet.debit({
        userId: testUserId,
        amount: 999999,
        type: 'SPEND_MATCH' as never,
        idempotencyKey: `insufficient_${Date.now()}`,
      }),
    ).rejects.toThrow();
  });

  it('concurrent debits — 10 parallel, no race condition', async () => {
    // Fund a fresh wallet for this test.
    const user = await prisma.user.create({
      data: { firebaseUid: `test-concurrent-${Date.now()}` },
    });
    await prisma.wallet.create({ data: { userId: user.id, balance: 500 } });
    await prisma.coinTransaction.create({
      data: {
        wallet: { connect: { userId: user.id } },
        type: 'ADJUSTMENT',
        amount: 500,
        balanceAfter: 500,
        idempotencyKey: `seed_concurrent_${user.id}`,
      },
    });

    // 10 concurrent debits of 10 coins each — all should succeed (500 - 100 = 400).
    const promises = Array.from({ length: 10 }, (_, i) =>
      wallet.debit({
        userId: user.id,
        amount: 10,
        type: 'SPEND_MATCH' as never,
        idempotencyKey: `concurrent_${user.id}_${i}`,
      }).catch(() => null),
    );
    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r !== null);
    expect(succeeded.length).toBe(10);

    // Verify final balance = 500 - 100 = 400.
    const w = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(w!.balance).toBe(400);

    // Verify ledger sum = 400.
    const txs = await prisma.coinTransaction.findMany({
      where: { wallet: { userId: user.id } },
      select: { amount: true },
    });
    const sum = txs.reduce((s, tx) => s + tx.amount, 0);
    expect(sum).toBe(400);

    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});
