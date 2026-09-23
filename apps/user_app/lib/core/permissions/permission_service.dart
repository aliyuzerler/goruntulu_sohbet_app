/// PermissionService — runtime permission requests for camera + mic + storage.
/// Uses permission_handler package. Provides a unified API for the call screen.

import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  PermissionService._();

  /// Request camera + microphone permission. Returns true if both granted.
  /// On first call, shows the system permission dialog.
  /// On subsequent calls (after denial), shows the system settings prompt.
  static Future<bool> requestCameraAndMic() async {
    final cam = await Permission.camera.request();
    if (!cam.isGranted) return false;
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) return false;
    return true;
  }

  /// Check current permission status without requesting.
  static Future<bool> hasCameraAndMic() async {
    final cam = await Permission.camera.status;
    final mic = await Permission.microphone.status;
    return cam.isGranted && mic.isGranted;
  }

  /// Open system settings — used when user permanently denied permission.
  static Future<void> openSettings() async {
    await openAppSettings();
  }

  /// True if permission was permanently denied (must open settings).
  static Future<bool> isPermanentlyDenied(Permission p) async {
    final s = await p.status;
    return s.isPermanentlyDenied;
  }
}
