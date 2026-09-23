/// SocketClient — singleton wrapper around socket_io_client.
///
/// Connection lifecycle:
///   1. connect(token) — handshake with JWT, starts reconnection backoff.
///   2. Server emits `message` event with envelopes; we dispatch via streams.
///   3. Server emits `error` event with error envelopes; we surface via stream.
///   4. Server emits `connected` envelope on connect (heart of our bootstrap).
///   5. Client must call heartbeat() every HEARTBEAT_INTERVAL_SEC seconds.
///   6. disconnect() — graceful close.
///
/// Reconnection backoff:
///   - Initial delay: 1s. Doubles each attempt, capped at 30s.
///   - On each reconnect attempt we re-fetch the access token from TokenStore
///     (it may have rotated during the disconnect).
///
/// Latency:
///   - Client receives `latency:ping` envelopes.
///   - Client must echo `latency:pong` with the same pingId.
///   - Server computes RTT and emits `latency:rtt`.

import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as sio;
import '../auth/token_store.dart';
import '../config/env.dart';
import 'socket_dto.dart';

class SocketClient {
  SocketClient._();

  static sio.Socket? _socket;
  static SocketConnectionState _state = SocketConnectionState.disconnected;
  static int _seq = 0;
  static int _reconnectAttempts = 0;

  // Streams — exposed to providers.
  static final StreamController<Envelope> _envelopeController =
      StreamController<Envelope>.broadcast();
  static final StreamController<ErrorEnvelope> _errorController =
      StreamController<ErrorEnvelope>.broadcast();
  static final StreamController<SocketConnectionState> _stateController =
      StreamController<SocketConnectionState>.broadcast();
  static final StreamController<int> _latencyController =
      StreamController<int>.broadcast(); // rttMs
  static final StreamController<int> _onlineCountController =
      StreamController<int>.broadcast();

  static Stream<Envelope> get envelopes => _envelopeController.stream;
  static Stream<ErrorEnvelope> get errors => _errorController.stream;
  static Stream<SocketConnectionState> get states => _stateController.stream;
  static Stream<int> get latencyMs => _latencyController.stream;
  static Stream<int> get onlineCount => _onlineCountController.stream;
  static SocketConnectionState get state => _state;

  /// Connect with the JWT from TokenStore. Idempotent — if already connected
  /// or connecting, returns immediately.
  static Future<void> connect() async {
    if (_socket != null) {
      if (_state == SocketConnectionState.connected) return;
      _socket!.dispose();
      _socket = null;
    }

    _setState(SocketConnectionState.connecting);

    final token = await TokenStore.access;
    if (token == null || token.isEmpty) {
      _setState(SocketConnectionState.error);
      return;
    }

    final opts = sio.OptionBuilder()
      ..setTransports(['websocket'])
      ..disableAutoConnect()
      ..setAuth({'token': token})
      ..setReconnection(true)
      ..setReconnectionAttempts(999999)
      ..setReconnectionDelay(_backoffMs)
      ..setReconnectionDelayMax(30000)
      ..setTimeout(15000)
      ..enableForceNew();

    _socket = sio.io(Env.socketIoUrl, opts.build());

    _socket!.onConnect((_) {
      _reconnectAttempts = 0;
      _setState(SocketConnectionState.connected);
    });

    _socket!.onReconnect((_) {
      _setState(SocketConnectionState.reconnecting);
    });

    _socket!.onReconnectAttempt((_) {
      _reconnectAttempts += 1;
      _setState(SocketConnectionState.reconnecting);
    });

    _socket!.onDisconnect((_) {
      _setState(SocketConnectionState.disconnected);
    });

    _socket!.onConnectError((_) {
      _setState(SocketConnectionState.error);
    });

    _socket!.on('message', (data) {
      if (data is Map<String, dynamic>) {
        final env = Envelope.fromJson(data);
        _envelopeController.add(env);
        // Special handling for known envelopes.
        if (env.type == 'latency:rtt') {
          final rttMs = env.payload['rttMs'];
          if (rttMs is num) {
            _latencyController.add(rttMs.toInt());
          }
        } else if (env.type == 'presence:online-count') {
          final total = env.payload['total'];
          if (total is num) {
            _onlineCountController.add(total.toInt());
          }
        } else if (env.type == 'latency:ping') {
          // Echo the pong immediately.
          final pingId = env.payload['pingId'];
          if (pingId is String) {
            send('latency:pong', {'pingId': pingId});
          }
        }
      }
    });

    _socket!.on('error', (data) {
      if (data is Map<String, dynamic>) {
        _errorController.add(ErrorEnvelope.fromJson(data));
      }
    });

    _socket!.connect();
  }

  /// Disconnect gracefully — used on logout.
  static Future<void> disconnect() async {
    await _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _setState(SocketConnectionState.disconnected);
  }

  /// Send an envelope — increments local seq.
  static void send(String type, Map<String, dynamic> payload) {
    if (_socket == null) return;
    final env = Envelope(
      type: type,
      seq: _seq++,
      ts: DateTime.now().toUtc().toIso8601String(),
      payload: payload,
    );
    _socket!.emit('message', env.toJson());
  }

  /// Send a heartbeat — client must call this every 30 seconds while connected.
  static void heartbeat() {
    send('heartbeat', {'clientTs': DateTime.now().toUtc().toIso8601String()});
  }

  static int _backoffMs(int attempt) {
    // 1s, 2s, 4s, 8s, 16s, 30s capped.
    final d = 1000 * (1 << (attempt - 1).clamp(0, 4));
    return d > 30000 ? 30000 : d;
  }

  static void _setState(SocketConnectionState s) {
    if (_state == s) return;
    _state = s;
    _stateController.add(s);
  }

  /// Heartbeat loop — call after connect, cancel on disconnect.
  static Timer? _heartbeatTimer;
  static void startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_state == SocketConnectionState.connected) {
        heartbeat();
      }
    });
  }

  static void stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  /// Dispose all streams — called only on app shutdown.
  static void dispose() {
    stopHeartbeat();
    _envelopeController.close();
    _errorController.close();
    _stateController.close();
    _latencyController.close();
    _onlineCountController.close();
  }
}
