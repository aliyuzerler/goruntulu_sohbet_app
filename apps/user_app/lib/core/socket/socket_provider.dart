/// Riverpod providers for socket state.
/// - socketConnectionStateProvider: StreamProvider<SocketConnectionState>
/// - socketLatencyProvider: StreamProvider<int> (RTT in ms)
/// - socketOnlineCountProvider: StreamProvider<int> (total online users)
/// - socketErrorsProvider: StreamProvider<ErrorEnvelope> (for snackbar/UI)

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/socket/socket_client.dart';
import '../../core/socket/socket_dto.dart';

final socketConnectionStateProvider = StreamProvider<SocketConnectionState>((ref) {
  return SocketClient.states;
});

final socketLatencyProvider = StreamProvider<int>((ref) {
  return SocketClient.latencyMs;
});

final socketOnlineCountProvider = StreamProvider<int>((ref) {
  return SocketClient.onlineCount;
});

final socketErrorsProvider = StreamProvider<ErrorEnvelope>((ref) {
  return SocketClient.errors;
});

final socketEnvelopesProvider = StreamProvider<Envelope>((ref) {
  return SocketClient.envelopes;
});

/// Connect action — call from a ConsumerWidget's initState via ref.read.
final socketConnectProvider = FutureProvider<void>((ref) async {
  await SocketClient.connect();
  SocketClient.startHeartbeat();
});

final socketDisconnectProvider = FutureProvider<void>((ref) async {
  SocketClient.stopHeartbeat();
  await SocketClient.disconnect();
});
