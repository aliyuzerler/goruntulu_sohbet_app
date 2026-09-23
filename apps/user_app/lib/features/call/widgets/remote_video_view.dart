/// Remote video — full screen behind everything else.
/// When no remote video (peer hasn't joined yet), shows a placeholder.
///
/// Phase 4: imports the service via provider and renders its view.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/video/video_provider.dart';
import '../../../core/video/agora_video_call_service.dart' as agora;
import '../../../core/video/video_call_service.dart';

class RemoteVideoView extends ConsumerWidget {
  final int? remoteUid;
  const RemoteVideoView({super.key, this.remoteUid});

  @override
  Widget build(BuildContext context, ref) {
    if (remoteUid == null) {
      return _buildWaiting();
    }
    final svc = ref.watch(videoCallServiceProvider);
    if (svc is agora.AgoraVideoCallService) {
      return svc.createRemoteVideoView(remoteUid!);
    }
    // Future: LiveKit branch.
    return _buildWaiting();
  }

  Widget _buildWaiting() {
    return Container(
      color: const Color(0xFF0B0B0B),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.videocam_off, color: Colors.white30, size: 64),
            SizedBox(height: 12),
            Text(
              'Karşı tarafla bağlantı kuruluyor…',
              style: TextStyle(color: Colors.white54),
            ),
          ],
        ),
      ),
    );
  }
}
