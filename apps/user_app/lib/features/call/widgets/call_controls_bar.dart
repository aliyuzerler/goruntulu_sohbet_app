/// Call controls bar — bottom bar with: mute / camera toggle / switch camera
/// / report / next / end. Designed for thumb reach on a phone.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../i18n/strings.dart';
import '../../../core/video/video_provider.dart';
import '../../../core/video/video_call_service.dart';

class CallControlsBar extends ConsumerStatefulWidget {
  final VoidCallback onEnd;
  final VoidCallback onNext;
  final VoidCallback onReport;

  const CallControlsBar({
    super.key,
    required this.onEnd,
    required this.onNext,
    required this.onReport,
  });

  @override
  ConsumerState<CallControlsBar> createState() => _CallControlsBarState();
}

class _CallControlsBarState extends ConsumerState<CallControlsBar> {
  bool _muted = false;
  bool _videoOff = false;

  Future<void> _toggleMute() async {
    final svc = ref.read(videoCallServiceProvider);
    setState(() => _muted = !_muted);
    await svc.toggleAudio(!_muted);
  }

  Future<void> _toggleVideo() async {
    final svc = ref.read(videoCallServiceProvider);
    setState(() => _videoOff = !_videoOff);
    await svc.toggleVideo(!_videoOff);
  }

  Future<void> _switchCamera() async {
    final svc = ref.read(videoCallServiceProvider);
    await svc.switchCamera();
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 40),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black87],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ControlButton(
            icon: _muted ? Icons.mic_off : Icons.mic,
            label: _muted ? i18n.callUnmute : i18n.callMute,
            color: _muted ? Colors.redAccent : Colors.white,
            onPressed: _toggleMute,
          ),
          _ControlButton(
            icon: _videoOff ? Icons.videocam_off : Icons.videocam,
            label: _videoOff ? i18n.callCameraOn : i18n.callCameraOff,
            color: _videoOff ? Colors.redAccent : Colors.white,
            onPressed: _toggleVideo,
          ),
          _ControlButton(
            icon: Icons.cameraswitch,
            label: i18n.callSwitchCamera,
            color: Colors.white,
            onPressed: _switchCamera,
          ),
          _ControlButton(
            icon: Icons.report_outlined,
            label: i18n.callReport,
            color: Colors.orangeAccent,
            onPressed: widget.onReport,
          ),
          _ControlButton(
            icon: Icons.skip_next,
            label: i18n.callNext,
            color: Colors.blueAccent,
            onPressed: widget.onNext,
          ),
          _ControlButton(
            icon: Icons.call_end,
            label: i18n.callEnd,
            color: Colors.redAccent,
            onPressed: widget.onEnd,
            filled: true,
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;
  final bool filled;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: filled ? color : const Color(0x33000000),
              shape: BoxShape.circle,
              border: filled ? null : Border.all(color: color, width: 1.5),
            ),
            child: Icon(icon, color: filled ? Colors.white : color, size: 24),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
