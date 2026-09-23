/// Permission dialog — shown when camera/mic permission is denied.
/// Two CTA buttons: "Open settings" (system) and "Retry".

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../i18n/strings.dart';
import '../../../core/permissions/permission_service.dart';

class PermissionDialog extends ConsumerWidget {
  final VoidCallback? onRetry;
  const PermissionDialog({super.key, this.onRetry});

  @override
  Widget build(BuildContext context, ref) {
    final i18n = t;
    return AlertDialog(
      title: Text(i18n.callPermissionRequired),
      content: Text(i18n.callPermissionDenied),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(i18n.commonCancel),
        ),
        FilledButton(
          onPressed: () async {
            await PermissionService.openSettings();
            onRetry?.call();
            if (context.mounted) Navigator.of(context).pop();
          },
          child: Text(i18n.callOpenSettings),
        ),
        OutlinedButton(
          onPressed: () async {
            final ok = await PermissionService.requestCameraAndMic();
            if (ok) {
              onRetry?.call();
              if (context.mounted) Navigator.of(context).pop();
            }
          },
          child: Text(i18n.callRetryPermissions),
        ),
      ],
    );
  }
}
