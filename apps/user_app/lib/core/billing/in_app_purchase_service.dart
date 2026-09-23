/// InAppPurchaseService — wraps the in_app_purchase Flutter plugin.
///
/// Lifecycle:
///   1. initialize() — connect to the store; sets up purchase stream listener.
///   2. queryProducts() — fetches ProductDetails for our 4 coin pack IDs.
///   3. buyPack(pack) — initiates a nonConsumable purchase via the plugin.
///   4. Stream emits purchase events:
///      - PurchaseStatus.pending → UI spinner
///      - PurchaseStatus.purchased → call ApiClient.verifyPurchase(productId, purchaseToken)
///      - PurchaseStatus.error → show error snackbar
///      - PurchaseStatus.canceled → no-op
///   5. On server verification success → complete() the purchase (so Play
///      knows it was delivered).
///
/// Phase 6 dev bypass: in_app_purchase supports a mock store in dev mode
/// (`InAppPurchaseStoreKitPlatformAddition.enableStoreKitTestingOnMacos`
/// + `InAppPurchaseAndroidPlatformAddition.enablePendingPurchase`).
/// For CI/local without Google Play Services, we expose a "buy" method that
/// synthesizes a fake purchaseToken.

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../network/api_client.dart';
import '../network/dto/billing_dto.dart';

class InAppPurchaseService {
  InAppPurchaseService._();
  static final InAppPurchaseService instance = InAppPurchaseService._();
  final _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _sub;

  /// Pending purchase events that haven't been verified yet — UI uses this
  /// to show "Processing…" spinner.
  final StreamController<String> _processingController = StreamController<String>.broadcast();
  Stream<String> get onProcessing => _processingController.stream;

  /// Successfully verified purchase — UI shows SnackBar + refresh balance.
  final StreamController<VerifyPurchaseResponseDto> _verifiedController = StreamController<VerifyPurchaseResponseDto>.broadcast();
  Stream<VerifyPurchaseResponseDto> get onVerified => _verifiedController.stream;

  /// Failed purchase — UI shows error.
  final StreamController<String> _failedController = StreamController<String>.broadcast();
  Stream<String> get onFailed => _failedController.stream;

  /// Initialize — connect to store + subscribe to purchase stream.
  Future<void> initialize() async {
    final ok = await _iap.isAvailable();
    if (!ok) {
      debugPrint('IAP store not available — dev/CI mode');
      return;
    }
    _sub = _iap.purchaseStream.listen(_handlePurchase);
  }

  void dispose() {
    _sub?.cancel();
    _processingController.close();
    _verifiedController.close();
    _failedController.close();
  }

  /// Query our 4 coin packs from the store.
  Future<Set<ProductDetails>> queryProducts(List<String> productIds) async {
    final ok = await _iap.isAvailable();
    if (!ok) return {};
    final res = await _iap.queryProductDetails(productIds.toSet());
    if (res.error != null) {
      debugPrint('IAP query error: ${res.error}');
      return {};
    }
    return res.productDetails;
  }

  /// Initiate a buy for a coin pack.
  Future<void> buyPack(CoinPackDto pack) async {
    final ok = await _iap.isAvailable();
    if (!ok) {
      // Dev bypass — synthesize a fake purchase and call verify-purchase.
      _processingController.add(pack.productId);
      try {
        final res = await ApiClient.verifyPurchase(
          productId: pack.productId,
          purchaseToken: 'dev_token_${pack.productId}_${DateTime.now().millisecondsSinceEpoch}',
        );
        _verifiedController.add(res);
      } catch (e) {
        _failedController.add(e.toString());
      }
      return;
    }
    final res = await _iap.queryProductDetails({pack.productId});
    if (res.productDetails.isEmpty) {
      _failedController.add('Product ${pack.productId} not found in store');
      return;
    }
    final pd = res.productDetails.first;
    final param = PurchaseParam(productDetails: pd);
    await _iap.buyNonConsumable(purchaseParam: param);
  }

  void _handlePurchase(List<PurchaseDetails> purchases) {
    for (final p in purchases) {
      _handleSingle(p);
    }
  }

  Future<void> _handleSingle(PurchaseDetails p) async {
    switch (p.status) {
      case PurchaseStatus.pending:
        _processingController.add(p.productID);
        break;
      case PurchaseStatus.purchased:
        _processingController.add(p.productID);
        try {
          final res = await ApiClient.verifyPurchase(
            productId: p.productID,
            purchaseToken: p.billingClientPurchase?.purchaseToken ?? p.purchaseID ?? '',
          );
          _verifiedController.add(res);
          // Complete the purchase so Play knows it was delivered.
          if (p.pendingCompletePurchase) {
            await InAppPurchase.instance.completePurchase(p);
          }
        } catch (e) {
          _failedController.add(e.toString());
        }
        break;
      case PurchaseStatus.error:
        _failedController.add(p.error?.details ?? 'Purchase error');
        break;
      case PurchaseStatus.canceled:
      case PurchaseStatus.restored:
        // No-op for canceled; restored is handled separately.
        break;
    }
  }
}
