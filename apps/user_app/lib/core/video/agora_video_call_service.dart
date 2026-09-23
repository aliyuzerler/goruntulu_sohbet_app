/// AgoraVideoCallService — wraps agora_rtc_engine to satisfy VideoCallService.
///
/// Notes:
///   - Implements auto-bitrate reduction on poor network by switching the
///     video profile to a lower one (Phase 4 simple impl).
///   - Uses the engine's NetworkType → CallQuality mapping.
///   - Single-instance singleton — Agora recommends one RtcEngine per app.
///   - In dev bypass mode (no AGORA_APP_ID), join() fails fast with a clear
///     message so the UI doesn't hang.

import 'dart:async';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'video_call_service.dart';

class AgoraVideoCallService implements VideoCallService {
  AgoraVideoCallService._(this._appId);
  static AgoraVideoCallService? _instance;

  final String _appId;
  RtcEngine? _engine;
  bool _autoBitrateReduction = true;
  int? _currentUid;
  bool _localVideo = true;
  bool _localAudio = true;
  bool _isFrontCamera = true;
  int? _remoteUid;

  // Stream controllers
  final StreamController<RemoteVideoState> _remoteController =
      StreamController<RemoteVideoState>.broadcast();
  final StreamController<LocalVideoState> _localController =
      StreamController<LocalVideoState>.broadcast();
  final StreamController<CallQuality> _qualityController =
      StreamController<CallQuality>.broadcast();

  /// Factory — only creates one instance per app session.
  factory AgoraVideoCallService({required String appId}) {
    _instance ??= AgoraVideoCallService._(appId);
    return _instance!;
  }

  @override
  Stream<RemoteVideoState> get onRemoteVideoChanged => _remoteController.stream;
  @override
  Stream<LocalVideoState> get onLocalVideoChanged => _localController.stream;
  @override
  Stream<CallQuality> get onQualityChanged => _qualityController.stream;

  @override
  bool get autoBitrateReduction => _autoBitrateReduction;
  @override
  set autoBitrateReduction(bool v) => _autoBitrateReduction = v;

  Future<void> _ensureEngine() async {
    if (_engine != null) return;
    if (_appId.isEmpty) {
      throw StateError(
        'AGORA_APP_ID is not set — Agora SDK requires an App ID. '
        'Set it in lib/main/main_dev.dart (or production main_prod.dart).',
      );
    }
    _engine = createAgoraRtcEngine();
    await _engine!.initialize(RtcEngineContext(
      appId: _appId,
      channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
    ));
    _engine!.registerEventHandler(RtcEngineEventHandler(
      onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
        debugPrint('[Agora] joined: ${connection.channelId} (uid=${connection.localUid})');
      },
      onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
        _remoteUid = remoteUid;
        _emitRemote();
      },
      onUserOffline: (RtcConnection connection, int remoteUid, UserOfflineReasonType reason) {
        _remoteUid = null;
        _emitRemote();
      },
      onNetworkQuality: (RtcConnection connection, int remoteUid, int quality, int delay, int jitter, int packetLoss) {
        final q = _mapQuality(quality);
        _qualityController.add(q);
        // Phase 4 simple auto-bitrate: on poor, downgrade profile.
        if (_autoBitrateReduction && q == CallQuality.poor) {
          _engine?.setVideoEncoderConfiguration(VideoEncoderConfiguration(
            dimensions: const VideoDimensions(width: 320, height: 240),
            frameRate: 15,
            bitrate: 400,
          ));
        } else if (_autoBitrateReduction && q == CallQuality.good) {
          _engine?.setVideoEncoderConfiguration(VideoEncoderConfiguration(
            dimensions: const VideoDimensions(width: 640, height: 480),
            frameRate: 30,
            bitrate: 1200,
          ));
        }
      },
      onLocalAudioStateChanged: (RtcConnection connection, LocalAudioStreamState state, LocalAudioStreamError error) {
        // No-op — local state is tracked via toggle methods.
      },
    ));
  }

  CallQuality _mapQuality(int quality) {
    // 0/1 = excellent/good, 2 = poor, 3/4/5/6 = bad/very bad/down, 8 = unknown.
    switch (quality) {
      case 0:
      case 1:
        return CallQuality.good;
      case 2:
        return CallQuality.fair;
      case 3:
      case 4:
      case 5:
      case 6:
        return CallQuality.poor;
      default:
        return CallQuality.disconnected;
    }
  }

  void _emitRemote() {
    _remoteController.add(RemoteVideoState(
      uid: _remoteUid ?? 0,
      videoEnabled: _remoteUid != null,
      audioEnabled: _remoteUid != null,
      quality: CallQuality.good,
      isSpeaking: false,
    ));
  }

  void _emitLocal() {
    _localController.add(LocalVideoState(
      videoEnabled: _localVideo,
      audioEnabled: _localAudio,
      isFrontCamera: _isFrontCamera,
    ));
  }

  @override
  Future<void> join({
    required String channelName,
    required String token,
    required int uid,
  }) async {
    await _ensureEngine();
    _currentUid = uid;
    await _engine!.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
    await _engine!.enableVideo();
    await _engine!.enableAudio();
    await _engine!.startPreview();
    final res = await _engine!.joinChannel(
      token: token,
      channelId: channelName,
      uid: uid,
      options: const ChannelMediaOptions(
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
        publishCameraTrack: true,
        publishMicrophoneTrack: true,
      ),
    );
    if (res != 0) {
      throw StateError('Agora join failed: code $res');
    }
  }

  @override
  Future<void> leave() async {
    await _engine?.leaveChannel();
    _remoteUid = null;
    _emitRemote();
  }

  @override
  Future<void> toggleAudio(bool enabled) async {
    _localAudio = enabled;
    await _engine?.enableLocalAudio(enabled);
    _emitLocal();
  }

  @override
  Future<void> toggleVideo(bool enabled) async {
    _localVideo = enabled;
    await _engine?.enableLocalVideo(enabled);
    _emitLocal();
  }

  @override
  Future<void> switchCamera() async {
    _isFrontCamera = !_isFrontCamera;
    await _engine?.switchCamera();
    _emitLocal();
  }

  @override
  Future<void> dispose() async {
    await _engine?.leaveChannel();
    await _engine?.release();
    _engine = null;
    await _remoteController.close();
    await _localController.close();
    await _qualityController.close();
    _instance = null;
  }

  /// Render helpers — exposed so the call UI doesn't import agora_rtc_engine.
  /// Agora's view surface is created lazily.
  Widget createLocalVideoView() {
    _ensureEngine();
    return AgoraVideoView(
      controller: VideoViewController(
        rtcEngine: _engine!,
        canvas: const VideoCanvas(uid: 0),
      ),
    );
  }

  Widget createRemoteVideoView(int remoteUid) {
    _ensureEngine();
    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: _engine!,
        connection: RtcConnection(channelId: ''), // Phase 4 simple — channel set on join.
        remoteUid: remoteUid,
        canvas: VideoCanvas(uid: remoteUid),
      ),
    );
  }
}
