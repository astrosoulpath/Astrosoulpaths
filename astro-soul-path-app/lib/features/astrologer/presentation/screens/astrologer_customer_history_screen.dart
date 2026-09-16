import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_portal_api.dart';
import '../../../kundli/presentation/screens/astrologer_manual_kundli_report_editor_screen.dart';

class AstrologerCustomerHistoryScreen extends StatefulWidget {
  const AstrologerCustomerHistoryScreen({super.key});

  @override
  State<AstrologerCustomerHistoryScreen> createState() =>
      _AstrologerCustomerHistoryScreenState();
}

class _AstrologerCustomerHistoryScreenState
    extends State<AstrologerCustomerHistoryScreen> {
  final _api = AstrologerPortalApi();
  final _sessionStore = AuthSessionStore();

  bool _loading = true;
  bool _loadingMore = false;
  String _error = '';

  int _page = 1;
  int _totalPages = 1;

  final List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<String> _token() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = '';
        _page = 1;
      });
    } else {
      if (_loadingMore || _page >= _totalPages) {
        return;
      }

      setState(() {
        _loadingMore = true;
      });
    }

    try {
      final token = await _token();

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
        );
      }

      final targetPage = reset ? 1 : _page + 1;

      final response = await _api.getCustomerHistory(
        accessToken: token,
        page: targetPage,
        limit: 20,
      );

      final rawData = response['data'];
      final newItems = <Map<String, dynamic>>[];

      if (rawData is List) {
        for (final item in rawData) {
          if (item is Map) {
            newItems.add(Map<String, dynamic>.from(item));
          }
        }
      }

      final pagination = response['pagination'];

      if (!mounted) {
        return;
      }

      setState(() {
        if (reset) {
          _items
            ..clear()
            ..addAll(newItems);
        } else {
          _items.addAll(newItems);
        }

        _page = targetPage;

        if (pagination is Map) {
          _totalPages =
              int.tryParse(pagination['totalPages']?.toString() ?? '') ?? 1;
        }

        _error = '';
      });
    } on AstrologerPortalApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load customer history.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  String _customerName(Map<String, dynamic> item) {
    final user = item['user'];

    if (user is Map) {
      final profile = user['userProfile'];

      if (profile is Map) {
        final name =
            profile['fullName']?.toString().trim() ??
            profile['name']?.toString().trim();

        if (name != null && name.isNotEmpty) {
          return name;
        }
      }

      final name = user['name']?.toString().trim();

      if (name != null && name.isNotEmpty) {
        return name;
      }
    }

    return 'Customer';
  }

  String _callSessionId(Map<String, dynamic> item) {
    /*
     * Prefer explicit session identifiers.
     *
     * We intentionally do not blindly treat every generic `id` as a
     * CallSession ID. The generic fallback is accepted only when this
     * history item has CallSession-shaped fields.
     */
    final explicitCallSessionId =
        item['callSessionId']?.toString().trim() ?? '';

    if (explicitCallSessionId.isNotEmpty) {
      return explicitCallSessionId;
    }

    final nestedCallSession = item['callSession'];

    if (nestedCallSession is Map) {
      final nestedId = nestedCallSession['id']?.toString().trim() ?? '';

      if (nestedId.isNotEmpty) {
        return nestedId;
      }
    }

    final looksLikeCallSession =
        item.containsKey('startedAt') ||
        item.containsKey('expiresAt') ||
        item.containsKey('channelName') ||
        item.containsKey('mode');

    if (looksLikeCallSession) {
      return item['id']?.toString().trim() ?? '';
    }

    return '';
  }

  Future<void> _openManualKundliReport(Map<String, dynamic> item) async {
    final callSessionId = _callSessionId(item);

    if (callSessionId.isEmpty) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'This history record does not expose a valid consultation session yet.',
          ),
        ),
      );

      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AstrologerManualKundliReportEditorScreen(
          callSessionId: callSessionId,
          customerName: _customerName(item),
        ),
      ),
    );
  }

  String _earning(Map<String, dynamic> item) {
    final earning = item['earning'];

    if (earning is Map) {
      final amount =
          double.tryParse(earning['netAmount']?.toString() ?? '') ?? 0;

      return '\u20B9${amount.toStringAsFixed(2)}';
    }

    return '\u20B90.00';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Customer History')),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty && _items.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.white),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => _load(reset: true),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                itemCount:
                    _items.length +
                    ((_page < _totalPages || _loadingMore) ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index >= _items.length) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: _loadingMore
                            ? const CircularProgressIndicator(
                                color: AppColors.gold,
                              )
                            : OutlinedButton(
                                onPressed: () => _load(reset: false),
                                child: const Text('Load More'),
                              ),
                      ),
                    );
                  }

                  final item = _items[index];
                  final status = item['status']?.toString().trim() ?? 'UNKNOWN';

                  final count = item['_count'];
                  final messageCount = count is Map
                      ? count['messages']?.toString() ?? '0'
                      : '0';

                  final statusUpper = status.toUpperCase();

                  final statusColor = switch (statusUpper) {
                    'ENDED' => Colors.greenAccent,
                    'COMPLETED' => Colors.greenAccent,
                    'ACTIVE' => AppColors.gold,
                    'PENDING' => Colors.orangeAccent,
                    'CANCELLED' => Colors.redAccent,
                    'EXPIRED' => Colors.redAccent,
                    _ => AppColors.muted,
                  };

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.12),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: AppColors.gold.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.person_outline_rounded,
                            color: AppColors.gold,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _customerName(item),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(
                                        alpha: 0.10,
                                      ),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      statusUpper,
                                      style: TextStyle(
                                        color: statusColor,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                    color: AppColors.muted,
                                    size: 14,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$messageCount messages',
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'Earned',
                              style: TextStyle(
                                color: AppColors.muted,
                                fontSize: 10,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _earning(item),
                              style: const TextStyle(
                                color: AppColors.gold,
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 34,
                              child: OutlinedButton.icon(
                                onPressed: () => _openManualKundliReport(item),
                                icon: const Icon(
                                  Icons.description_outlined,
                                  size: 14,
                                ),
                                label: const Text(
                                  'Report',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
