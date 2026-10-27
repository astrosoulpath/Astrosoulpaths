import 'package:flutter/material.dart';
import '../../../kundli/data/consultation_kundli_api.dart';
import '../../../kundli/presentation/screens/consultation_kundli_consent_screen.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_portal_api.dart';
import '../../../kundli/presentation/screens/astrologer_manual_kundli_report_editor_screen.dart';

class AstrologerCustomerHistoryScreen extends StatefulWidget {
  const AstrologerCustomerHistoryScreen({
    super.key,
    this.api,
    this.sessionStore,
  });

  final AstrologerPortalApi? api;
  final AuthSessionStore? sessionStore;

  @override
  State<AstrologerCustomerHistoryScreen> createState() =>
      _AstrologerCustomerHistoryScreenState();
}

class _AstrologerCustomerHistoryScreenState
    extends State<AstrologerCustomerHistoryScreen> {
  late final _api = widget.api ?? AstrologerPortalApi();
  late final _sessionStore = widget.sessionStore ?? AuthSessionStore();

  bool _loading = true;
  bool _loadingMore = false;
  String _error = '';

  int _page = 1;
  int _totalPages = 1;
  int _revision = 0;
  String? _owner;
  String _search = '', _mode = '', _status = '';

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

  Future<void> _load({required bool reset}) async {
    if (!reset && (_loading || _loadingMore)) return;
    final revision = ++_revision;
    if (reset) {
      setState(() {
        _loading = true;
        _error = '';
        _page = 1;
        _items.clear();
        _loadingMore = false;
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
      final session = await _sessionStore.read();
      final token = session?.accessToken.trim() ?? '';
      final owner = session?.user['id'];
      if (owner is! String ||
          owner.isEmpty ||
          (_owner != null && _owner != owner)) {
        throw const AstrologerPortalApiException(
          'Account changed. Open Customer History again.',
          statusCode: 401,
        );
      }
      _owner = owner;

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
          statusCode: 401,
        );
      }

      final targetPage = reset ? 1 : _page + 1;

      final response = await _api.getCustomerHistory(
        accessToken: token,
        page: targetPage,
        limit: 20,
        search: _search,
        mode: _mode,
        status: _status,
      );
      if (!mounted || revision != _revision) return;
      if ((await _sessionStore.read())?.user['id'] != owner) {
        throw const AstrologerPortalApiException(
          'Account changed. Open Customer History again.',
          statusCode: 401,
        );
      }

      final rawData = response['data'];
      if (rawData is! List || response['pagination'] is! Map) {
        throw const AstrologerPortalApiException(
          'Invalid history response. Please retry.',
        );
      }
      final newItems = <Map<String, dynamic>>[];

      for (final item in rawData) {
        if (item is Map) {
          newItems.add(Map<String, dynamic>.from(item));
        }
      }

      final pagination = response['pagination'];

      if (!mounted || revision != _revision) {
        return;
      }

      setState(() {
        if (reset) {
          _items
            ..clear()
            ..addAll(newItems);
        } else {
          final ids = _items.map((item) => item['id']).toSet();
          _items.addAll(newItems.where((item) => ids.add(item['id'])));
        }

        _page = targetPage;

        if (pagination is Map) {
          _totalPages =
              int.tryParse(pagination['totalPages']?.toString() ?? '') ?? 1;
        }

        _error = '';
      });
    } on AstrologerPortalApiException catch (error) {
      if (mounted && revision == _revision) {
        setState(() {
          _error = error.message;
          if (error.accessDenied) {
            _items.clear();
            _totalPages = 1;
          }
        });
      }
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(() {
          _error = 'Unable to load customer history.';
        });
      }
    } finally {
      if (mounted && revision == _revision) {
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
    if (earning is! Map) return 'Earnings not recorded';
    final amount = num.tryParse(earning['netAmount']?.toString() ?? '');
    final currency = earning['currency']?.toString().trim() ?? '';
    if (amount == null || currency.isEmpty) return 'Earnings not recorded';
    return '$currency ${amount.toStringAsFixed(2)} · ${earning['status'] ?? 'Recorded'}';
  }

  Widget _consultation(Map<String, dynamic> item) {
    final start = DateTime.tryParse(item['startedAt']?.toString() ?? '');
    final end = DateTime.tryParse(item['endedAt']?.toString() ?? '');
    final seconds = start != null && end != null
        ? end.difference(start).inSeconds
        : null;
    final date = DateTime.tryParse(
      item['createdAt']?.toString() ?? '',
    )?.toLocal();
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${item['mode'] ?? 'Unknown type'} · ${item['status'] ?? 'UNKNOWN'}',
          ),
          Text(date?.toString().split('.').first ?? 'Date not recorded'),
          if (seconds != null && seconds >= 0)
            Text('Recorded interval: ${seconds ~/ 60}m ${seconds % 60}s'),
          Text(_earning(item)),
          Wrap(
            spacing: 8,
            children: [
              if (consultationKundliV1Enabled &&
                  _callSessionId(item).isNotEmpty)
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ConsultationKundliConsentScreen(
                        consultationId: _callSessionId(item),
                      ),
                    ),
                  ),
                  child: const Text('Kundli permission'),
                ),
              OutlinedButton.icon(
                onPressed: _callSessionId(item).isEmpty
                    ? null
                    : () => _openManualKundliReport(item),
                icon: const Icon(Icons.description_outlined),
                label: const Text('Report'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final item in _items) {
      final user = item['user'];
      final key =
          item['userId']?.toString() ??
          (user is Map ? user['id']?.toString() : null) ??
          item['id']?.toString() ??
          '';
      (groups[key] ??= []).add(item);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Customer History')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search customers',
                suffixIcon: Icon(Icons.search),
              ),
              onSubmitted: (value) {
                _search = value;
                _load(reset: true);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButton<String>(
                    value: _mode,
                    isExpanded: true,
                    items: ['', 'chat', 'audio', 'video']
                        .map(
                          (v) => DropdownMenuItem(
                            value: v,
                            child: Text(v.isEmpty ? 'All types' : v),
                          ),
                        )
                        .toList(),
                    onChanged: (v) {
                      _mode = v ?? '';
                      _load(reset: true);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButton<String>(
                    value: _status,
                    isExpanded: true,
                    items:
                        [
                              '',
                              'PENDING',
                              'ACTIVE',
                              'COMPLETED',
                              'ENDED',
                              'CANCELLED',
                              'REJECTED',
                              'EXPIRED',
                            ]
                            .map(
                              (v) => DropdownMenuItem(
                                value: v,
                                child: Text(v.isEmpty ? 'All statuses' : v),
                              ),
                            )
                            .toList(),
                    onChanged: (v) {
                      _status = v ?? '';
                      _load(reset: true);
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.gold),
                  )
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_error.isNotEmpty) ...[
                          Text(_error),
                          TextButton(
                            onPressed: () => _load(reset: true),
                            child: const Text('Retry'),
                          ),
                        ],
                        if (_items.isEmpty && _error.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('No customers found.'),
                          ),
                        for (final entries in groups.values)
                          Card(
                            child: ExpansionTile(
                              key: PageStorageKey(
                                entries.first['userId'] ?? entries.first['id'],
                              ),
                              title: Text(_customerName(entries.first)),
                              subtitle: Text(
                                '${entries.length} loaded consultations',
                              ),
                              children: entries.map(_consultation).toList(),
                            ),
                          ),
                        if (_loadingMore)
                          const Center(child: CircularProgressIndicator()),
                        if (!_loadingMore && _page < _totalPages)
                          OutlinedButton(
                            onPressed: () => _load(reset: false),
                            child: const Text('Load More'),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
