/// Call page — Phase 4: full screen remote video + PIP local + bottom bar.
///
/// Lifecycle:
///   1. receiveMatch (from /home match button → match:found envelope)
///   2. requestCameraAndMic — if denied, show PermissionDialog
///   3. POST /calls/:id/agora-token → token + channel + uid
///   4. service.join({channelName, token, uid})
///   5. POST /calls/:id/start → mark ACTIVE
///   6. POST /socket room:join {room: 'call:<id>'} — receives peer events
///   7. ringing timeout 30s — if peer doesn't connect, leave + return to /home
///
/// Resilience:
///   - wakelock_plus on init, off on dispose
///   - lifecycle observer: on app background → service.leave() (audio continues
///     via foreground service in Phase 8; for Phase 4 we just leave)
///   - network drop → service rejoin after 3s (with retry budget of 3)
///   - peer disconnect → call:end envelope from server → leave + return

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/call_dto.dart';
import '../../core/permissions/permission_service.dart';
import '../../core/socket/socket_client.dart';
import '../../core/socket/socket_provider.dart';
import '../../core/video/video_provider.dart';
import '../../core/video/video_call_service.dart';
import '../../i18n/strings.dart';
import 'widgets/remote_video_view.dart';
import 'widgets/local_pip_view.dart';
import 'widgets/call_controls_bar.dart';
import 'widgets/permission_dialog.dart';
import 'widgets/report_sheet.dart';
import 'widgets/rating_sheet.dart';

class CallPage extends ConsumerStatefulWidget {
  final String callId;
  final String agoraChannel;
  final String? initialAgoraToken;
  final int? initialUid;
  final String peerId;
  final String peerDisplayName;

  const CallPage({
    super.key,
    required this.callId,
    required this.agoraChannel,
    this.initialAgoraToken,
    this.initialUid,
    required this.peerId,
    required this.peerDisplayName,
  });

  @override
  ConsumerState<CallPage> createState() => _CallPageState();
}

class _CallPageState extends ConsumerState<CallPage> with WidgetsBindingObserver {
  int? _remoteUid;
  bool _connecting = true;
  String? _status;
  Timer? _ringingTimer;
  Timer? _rejoinTimer;
  int _rejoinAttempts = 0;
  StreamSubscription? _envelopeSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WakelockPlus.enable();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    WakelockPlus.disable();
    _ringingTimer?.cancel();
    _rejoinTimer?.cancel();
    _envelopeSub?.cancel();
    final svc = ref.read(videoCallServiceProvider);
    svc.leave().catchError((_) {});
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Phase 4: on background, leave the call (foreground service for audio is Phase 8).
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _endCall(reason: 'system_error');
    }
  }

  Future<void> _start() async {
    final i18n = t;
    setState(() => _status = i18n.callPermissionRequired);
    final has = await PermissionService.hasCameraAndMic();
    if (!has) {
      final ok = await PermissionService.requestCameraAndMic();
      if (!ok) {
        if (!mounted) return;
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => PermissionDialog(onRetry: () => _start()),
        );
        return;
      }
    }
    // Get token.
    setState(() => _status = i18n.callConnecting);
    final svc = ref.read(videoCallServiceProvider);
    AgoraTokenDto token;
    try {
      token = await ApiClient.getAgoraToken(widget.callId);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = i18n.callRejoinFailed;
        _connecting = false;
      });
      return;
    }
    // Join the RTC channel.
    try {
      await svc.join(
        channelName: widget.agoraChannel,
        token: token.token,
        uid: token.uid,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = i18n.callRejoinFailed;
        _connecting = false;
      });
      return;
    }
    // Mark call ACTIVE on server.
    try {
      await ApiClient.startCall(widget.callId);
    } catch (_) {}
    // Join the socket.io call room so we get call:end / call:ice events.
    SocketClient.send('room:join', {'room': 'call:${widget.callId}'});
    // Subscribe to envelopes — listen for call:end / peer connection.
    _envelopeSub = SocketClient.envelopes.listen((env) {
      if (env.type == 'call:end' && env.payload['callId'] == widget.callId) {
        _handleCallEnd(env.payload['reason'] as String?);
      }
    });

    setState(() {
      _connecting = false;
      _status = i18n.callConnected;
    });

    // Ringing timeout — if no remote in 30s, give up.
    _ringingTimer = Timer(const Duration(seconds: 30), () {
      if (_remoteUid == null) {
        _endCall(reason: 'match_timeout');
      }
    });
  }

  void _handleCallEnd(String? reason) {
    final i18n = t;
    setState(() {
      _status = reason == 'match_timeout'
          ? i18n.callMatchTimeout
          : i18n.callPeerDisconnected;
    });
    // Auto-return to /home after 1.5s.
    Future<void>.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      context.go('/home');
    });
  }

  Future<void> _endCall({String? reason}) async {
    final i18n = t;
    _ringingTimer?.cancel();
    final isModeration = reason == 'moderation';
    setState(() => _status = isModeration ? i18n.moderationCallEndedModeration : i18n.callEnded);
    try {
      await ApiClient.endCall(widget.callId, reason: reason);
    } catch (_) {}
    final svc = ref.read(videoCallServiceProvider);
    await svc.leave().catchError((_) {});
    if (!mounted) return;
    // Phase 8: show rating sheet (30s) — but skip if moderation ended the call.
    if (!isModeration) {
      await showModalBottomSheet<void>(
        context: context,
        isDismissible: false,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0B0B0B),
        builder: (_) => RatingSheet(
          callId: widget.callId,
          targetUserId: widget.peerId,
          targetDisplayName: widget.peerDisplayName,
        ),
      ).catchError((_) {});
    }
    if (!mounted) return;
    context.go('/home');
  }

  Future<void> _nextCall() async {
    // "Next" = end current + re-queue immediately.
    await _endCall(reason: 'user_hangup');
    // Re-queue — server side handles the match.
    SocketClient.send('queue:join', {
      'genderFilters': [],
      'countryFilters': [],
    });
  }

  void _report() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0B0B0B),
      builder: (_) => ReportSheet(
        reportedUserId: widget.peerId,
        callId: widget.callId,
        reportedDisplayName: widget.peerDisplayName,
      ),
    );
  }

  /// On network drop → try to rejoin. Phase 4 simple impl: 3 retries at 3s.
  void _scheduleRejoin() {
    if (_rejoinAttempts >= 3) {
      setState(() => _status = t.callRejoinFailed);
      _endCall(reason: 'system_error');
      return;
    }
    _rejoinAttempts += 1;
    setState(() => _status = t.callReconnecting);
    _rejoinTimer?.cancel();
    _rejoinTimer = Timer(const Duration(seconds: 3), () async {
      // Try to get a fresh token + re-join.
      try {
        final token = await ApiClient.getAgoraToken(widget.callId);
        final svc = ref.read(videoCallServiceProvider);
        await svc.join(channelName: widget.agoraChannel, token: token.token, uid: token.uid);
        setState(() => _status = t.callRejoined);
        _rejoinAttempts = 0;
      } catch (_) {
        _scheduleRejoin();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Full screen remote video.
          RemoteVideoView(remoteUid: _remoteUid),
          // PIP local preview.
          const LocalPipView(),
          // Top status bar (peer name + quality indicator).
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Text(
                      widget.peerDisplayName,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 8),
                    if (_status != null)
                      Expanded(
                        child: Text(
                          _status!,
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          // Bottom controls.
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: CallControlsBar(
              onEnd: () => _endCall(reason: 'user_hangup'),
              onNext: _nextCall,
              onReport: _report,
            ),
          ),
        ],
      ),
    );
  }
}
