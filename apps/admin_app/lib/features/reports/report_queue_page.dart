/// Admin report queue — list of pending reports with ban/unban actions.
/// Phase 8 simple impl — pagination + status filter via dropdown.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/dio_client.dart';
import '../../i18n/strings.dart';

class ReportQueuePage extends ConsumerStatefulWidget {
  const ReportQueuePage({super.key});

  @override
  ConsumerState<ReportQueuePage> createState() => _ReportQueuePageState();
}

class _ReportQueuePageState extends ConsumerState<ReportQueuePage> {
  final List<Map<String, dynamic>> _items = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  String _statusFilter = 'PENDING';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await DioClient.instance.get<dynamic>(
        '/moderation/reports',
        queryParameters: {'status': _statusFilter, 'take': 20},
      );
      final data = res.data as Map<String, dynamic>;
      final items = (data['items'] as List?) ?? [];
      setState(() {
        _items
          ..clear()
          ..addAll(items.cast<Map<String, dynamic>>());
        _cursor = data['nextCursor'] as String?;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_cursor == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final res = await DioClient.instance.get<dynamic>(
        '/moderation/reports',
        queryParameters: {'status': _statusFilter, 'take': 20, 'cursor': _cursor},
      );
      final data = res.data as Map<String, dynamic>;
      final items = (data['items'] as List?) ?? [];
      setState(() {
        _items.addAll(items.cast<Map<String, dynamic>>());
        _cursor = data['nextCursor'] as String?;
        _loadingMore = false;
      });
    } catch (_) {
      setState(() => _loadingMore = false);
    }
  }

  Future<void> _ban(String userId, String reason) async {
    try {
      await DioClient.instance.post<dynamic>(
        '/moderation/ban',
        data: {'userId': userId, 'reason': reason},
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Banned $userId')),
      );
      await _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ban failed: $e')),
      );
    }
  }

  Future<void> _unban(String userId) async {
    try {
      await DioClient.instance.post<dynamic>(
        '/moderation/unban',
        data: {'userId': userId, 'reason': 'manual_unban'},
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unbanned $userId')),
      );
      await _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unban failed: $e')),
      );
    }
  }

  Future<void> _resolve(String reportId, String resolution) async {
    try {
      await DioClient.instance.post<dynamic>(
        '/moderation/resolve/$reportId',
        data: {'resolution': resolution},
      );
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final i18n = T();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Report Queue'),
        actions: [
          DropdownButton<String>(
            value: _statusFilter,
            items: const [
              DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
              DropdownMenuItem(value: 'REVIEWING', child: Text('Reviewing')),
              DropdownMenuItem(value: 'RESOLVED', child: Text('Resolved')),
              DropdownMenuItem(value: 'DISMISSED', child: Text('Dismissed')),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _statusFilter = v);
              _load();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(child: Text('No reports'))
              : ListView.builder(
                  itemCount: _items.length + 1,
                  itemBuilder: (context, i) {
                    if (i == _items.length) {
                      if (_cursor == null) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.all(16),
                        child: OutlinedButton(
                          onPressed: _loadMore,
                          child: Text(_loadingMore ? 'Loading…' : 'Load more'),
                        ),
                      );
                    }
                    final r = _items[i];
                    final reported = (r['reported'] as Map<String, dynamic>?) ?? {};
                    final strike = (reported['strike'] as Map<String, dynamic>?) ?? {};
                    final profile = (reported['profile'] as Map<String, dynamic>?) ?? {};
                    return Card(
                      child: ListTile(
                        title: Text('Reason: ${r['reason']}'),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Reported: ${profile['displayName'] ?? '—'} (${reported['status'] ?? '—'}, strike ${strike['level'] ?? 0})'),
                            if (r['details'] != null) Text('Details: ${r['details']}'),
                            Text('Created: ${r['createdAt']}'),
                          ],
                        ),
                        trailing: PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'ban') _ban(reported['id'] as String, r['reason'] as String);
                            else if (v == 'unban') _unban(reported['id'] as String);
                            else if (v == 'resolve') _resolve(r['id'] as String, 'RESOLVED');
                            else if (v == 'dismiss') _resolve(r['id'] as String, 'DISMISSED');
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'ban', child: Text('Ban user')),
                            PopupMenuItem(value: 'unban', child: Text('Unban user')),
                            PopupMenuItem(value: 'resolve', child: Text('Resolve (action taken)')),
                            PopupMenuItem(value: 'dismiss', child: Text('Dismiss (no action)')),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
