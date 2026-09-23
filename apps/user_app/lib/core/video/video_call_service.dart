/// VideoCallService — abstract interface for video call providers.
/// Default impl: AgoraVideoCallService.
/// Designed to be transportable: a LiveKitVideoCallService can implement
/// the same interface and replace Agora via DI without touching call UI.
///
/// Lifecycle:
///   1. create(provider) → service instance
///   2. join({channelName, token, uid}) → joins RTC channel
///   3. onRemoteVideoChanged stream → emits RemoteVideoState changes
///   4. onNetworkQuality stream → emits CallQuality (good/fair/poor)
///   5. toggleAudio/toggleVideo/switchCamera → mute/cam/camera controls
///   6. leave() → leaves channel + releases native resources
///
/// UI never imports agora_rtc_engine directly — always through this interface.

import 'dart:async';

/// Quality buckets — must match server's LATENCY_GOOD_MS / LATENCY_FAIR_MS.
enum CallQuality { good, fair, poor, disconnected }

/// State of a remote video stream (peer).
class RemoteVideoState {
  final int uid;
  final bool videoEnabled;
  final bool audioEnabled;
  final CallQuality quality;
  final bool isSpeaking;

  const RemoteVideoState({
    required this.uid,
    required this.videoEnabled,
    required this.audioEnabled,
    required this.quality,
    required this.isSpeaking,
  });
}

/// Local video state — used by PIP widget to show mute/cam-off overlays.
class LocalVideoState {
  final bool videoEnabled;
  final bool audioEnabled;
  final bool isFrontCamera;

  const LocalVideoState({
    required this.videoEnabled,
    required this.audioEnabled,
    required this.isFrontCamera,
  });
}

/// Abstract interface.
abstract class VideoCallService {
  /// Stream of remote peer video state changes.
  /// Emits at most every 500ms — caller throttles.
  Stream<RemoteVideoState> get onRemoteVideoChanged;

  /// Stream of local video state changes (mute, cam off, camera switch).
  Stream<LocalVideoState> get onLocalVideoChanged;

  /// Stream of network quality — emitted on every Agora quality report.
  Stream<CallQuality> get onQualityChanged;

  /// Join the channel — caller must have requested a token from
  /// POST /api/calls/:id/agora-token first.
  Future<void> join({
    required String channelName,
    required String token,
    required int uid,
  });

  /// Leave the channel — also called on app background (Phase 4 resilience).
  Future<void> leave();

  /// Mute / unmute the local microphone.
  Future<void> toggleAudio(bool enabled);

  /// Enable / disable the local camera. Other peer sees a "camera off" placeholder.
  Future<void> toggleVideo(bool enabled);

  /// Switch between front and back camera.
  Future<void> switchCamera();

  /// Whether auto-bitrate-reduction on poor network is enabled. Default true.
  /// Phase 5 may expose this to the user as a setting.
  bool get autoBitrateReduction;
  set autoBitrateReduction(bool value);

  /// Release native resources — call before disposing the service.
  Future<void> dispose();
}
