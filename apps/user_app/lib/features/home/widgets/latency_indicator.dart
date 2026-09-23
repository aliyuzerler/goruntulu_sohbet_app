/// LatencyIndicator — shows a colored dot (green/yellow/red) + RTT in ms.
/// Listens to socketLatencyProvider. If no data, shows grey (no signal).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/socket/socket_provider.dart';

class LatencyIndicator extends ConsumerWidget {
  const LatencyIndicator({super.key});

  @override
  Widget build(BuildContext context, ref) {
    final latencyAsync = ref.watch(socketLatencyProvider);
    final color = latencyAsync.when(
      data: (ms) {
        if (ms <= 200) return const Color(0xFF34C759); // green
        if (ms <= 500) return const Color(0xFFFFCC00); // yellow
        return const Color(0xFFFF3B30); // red
      },
      loading: () => Colors.grey,
      error: (_, __) => Colors.grey,
    );
    final ms = latencyAsync.valueOrNull;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1C1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            ms == null ? '--ms' : '${ms}ms',
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
