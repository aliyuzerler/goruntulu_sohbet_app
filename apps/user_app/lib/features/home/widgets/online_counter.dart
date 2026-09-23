/// OnlineCounter — shows the total online user count.
/// Listens to socketOnlineCountProvider (server broadcasts every 30s).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/socket/socket_provider.dart';

class OnlineCounter extends ConsumerWidget {
  const OnlineCounter({super.key});

  @override
  Widget build(BuildContext context, ref) {
    final countAsync = ref.watch(socketOnlineCountProvider);
    final count = countAsync.valueOrNull;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1C1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.circle, color: Color(0xFF34C759), size: 8),
          const SizedBox(width: 6),
          Text(
            count == null ? '--' : '$count online',
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
