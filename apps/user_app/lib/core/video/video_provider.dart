/// Riverpod providers for the video call service.
/// Phase 4: AgoraVideoCallService singleton. Phase 7 may add a feature flag
/// to swap in LiveKitVideoCallService.
///
/// The provider is created lazily on first use (when the call screen opens)
/// and disposed when the call screen is popped (consumer must call
/// ref.read(videoCallServiceProvider).dispose()).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'video_call_service.dart';
import 'agora_video_call_service.dart';
import '../config/env.dart';

final videoCallServiceProvider = Provider<VideoCallService>((ref) {
  // AgoraVideoCallService factory returns singleton by app design.
  // Phase 7 will switch based on a feature flag here.
  final svc = AgoraVideoCallService(appId: Env.agoraAppId);
  ref.onDispose(() {
    // Phase 4: leave dispose to the call page itself; provider just tears down
    // the reference. Singleton service may be reused across calls.
  });
  return svc;
});

/// Stream of remote video state — wraps the service's stream.
final remoteVideoStateProvider = StreamProvider.autoDispose
    .family<RemoteVideoState, void>((ref, _) {
  final svc = ref.watch(videoCallServiceProvider);
  return svc.onRemoteVideoChanged;
});

final localVideoStateProvider = StreamProvider.autoDispose
    .family<LocalVideoState, void>((ref, _) {
  final svc = ref.watch(videoCallServiceProvider);
  return svc.onLocalVideoChanged;
});

final callQualityProvider = StreamProvider.autoDispose
    .family<CallQuality, void>((ref, _) {
  final svc = ref.watch(videoCallServiceProvider);
  return svc.onQualityChanged;
});
