// Wallet DTO test — verifies fromJson parsing + edge cases.
// Run: cd apps/user_app && flutter test test/wallet_dto_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:randchat_user_app/core/network/dto/wallet_dto.dart';

void main() {
  group('WalletBalanceDto', () {
    test('parses valid JSON', () {
      const json = {'balance': 42, 'currency': 'COIN'};
      final dto = WalletBalanceDto.fromJson(json);
      expect(dto.balance, 42);
      expect(dto.currency, 'COIN');
    });

    test('parses zero balance', () {
      const json = {'balance': 0, 'currency': 'COIN'};
      final dto = WalletBalanceDto.fromJson(json);
      expect(dto.balance, 0);
    });
  });

  group('TransactionItemDto', () {
    test('parses credit (positive amount)', () {
      final json = {
        'id': 'abc-123',
        'type': 'PURCHASE',
        'amount': 10,
        'balanceAfter': 110,
        'reference': 'coin_pack_small',
        'createdAt': '2024-01-01T00:00:00.000Z',
      };
      final dto = TransactionItemDto.fromJson(json);
      expect(dto.amount > 0, isTrue);
      expect(dto.type, 'PURCHASE');
    });

    test('parses debit (negative amount)', () {
      final json = {
        'id': 'def-456',
        'type': 'SPEND_MATCH',
        'amount': -2,
        'balanceAfter': 108,
        'reference': null,
        'createdAt': '2024-01-02T00:00:00.000Z',
      };
      final dto = TransactionItemDto.fromJson(json);
      expect(dto.amount < 0, isTrue);
      expect(dto.type, 'SPEND_MATCH');
    });
  });

  group('LowBalancePayload', () {
    test('parses needed + remainingFree', () {
      final json = {'needed': 2, 'remainingFree': 0};
      final dto = LowBalancePayload.fromJson(json);
      expect(dto.needed, 2);
      expect(dto.remainingFree, 0);
    });
  });

  group('QueueJoinedPayload', () {
    test('parses position + charge + remainingFree', () {
      final json = {
        'position': 3,
        'charge': 2,
        'remainingFree': 0,
        'ts': '2024-01-01T00:00:00.000Z',
      };
      final dto = QueueJoinedPayload.fromJson(json);
      expect(dto.position, 3);
      expect(dto.charge, 2);
      expect(dto.remainingFree, 0);
    });
  });
}
