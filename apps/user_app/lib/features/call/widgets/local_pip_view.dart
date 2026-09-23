/// Local PIP — corner overlay showing the user's own camera preview.
/// Movable via drag, snaps to corners (Phase 8).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/video/agora_video_call_service.dart' as agora;
import '../../../core/video/video_provider.dart';
import '../../../core/video/video_call_service.dart';

class LocalPipView extends ConsumerWidget {
  const LocalPipView({super.key});

  @override
  Widget build(BuildContext context, ref) {
    final localState = ref.watch(localVideoStateProvider(const ()).callAs(null));
    final svc = ref.watch(videoCallServiceProvider);
    final isVideoOn = localState.valueOrNull?.videoEnabled ?? true;
    final isAudioOn = localState.valueOrNull?.audioEnabled ?? true;
    return Positioned(
      top: 60,
      right: 16,
      child: Container(
        width: 100,
        height: 140,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white24, width: 1),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (isVideoOn && svc is agora.AgoraVideoCallService)
                svc.createLocalVideoView()
              else
                Container(
                  color: const Color(0xFF1C1C1E),
                  child: const Icon(Icons.videocam_off, color: Colors.white38),
                ),
              // Mic-off badge
              if (!isAudioOn)
                const Positioned(
                  bottom: 4,
                  right: 4,
                  child: Icon(Icons.mic_off, color: Colors.redAccent, size: 14),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
