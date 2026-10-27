import 'dart:async';
import 'package:flutter/material.dart';
import '../../../feedback/presentation/screens/feedback_screen.dart';
import '../../../support/data/support_operations_config.dart';
import '../../../kundli/data/consultation_kundli_api.dart';
import '../../../kundli/presentation/screens/consultation_kundli_consent_screen.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/consultation_api.dart';
import '../../data/consultation_models.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../astrologers/presentation/screens/astrologer_detail_screen.dart';
import '../../../reviews/presentation/widgets/rate_review_button.dart';
// CUSTOMER_FINAL_PREMIUM_PHASE4

class ConsultationHistoryScreen extends StatefulWidget {
  const ConsultationHistoryScreen({super.key, this.api});
  final ConsultationApi? api;

  @override
  State<ConsultationHistoryScreen> createState() =>
      _ConsultationHistoryScreenState();
}

class _ConsultationHistoryScreenState extends State<ConsultationHistoryScreen> {
  late final ConsultationApi _consultationApi = widget.api ?? ConsultationApi();

  List<ConsultationHistoryItem> _items = <ConsultationHistoryItem>[];

  bool _loading = true;
  String? _error;
  String _selectedFilter = 'ALL';
  String _search = '';
  Timer? _searchDebounce;
  int _page = 0;
  int _requestVersion = 0;
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _requestVersion++;
    _searchDebounce?.cancel();
    _consultationApi.close();
    super.dispose();
  }

  Future<void> _loadHistory({bool append = false}) async {
    if (append && _loading) return;
    final version = ++_requestVersion;
    final page = append ? _page + 1 : 1;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final items = await _consultationApi.getConsultationHistory(
        page: page,
        limit: 50,
        search: _search,
        status: _selectedFilter,
      );

      if (!mounted || version != _requestVersion) {
        return;
      }

      setState(() {
        final byId = {
          if (append)
            for (final item in _items) item.session.id: item,
          for (final item in items) item.session.id: item,
        };
        _items = byId.values.toList(growable: false);
        _page = page;
        _hasMore = items.length == 50;
        _loading = false;
      });
    } on ConsultationApiException catch (error) {
      if (!mounted || version != _requestVersion) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted || version != _requestVersion) {
        return;
      }

      setState(() {
        _loading = false;
        _error = 'Consultation history could not be loaded.';
      });
    }
  }

  List<ConsultationHistoryItem> get _visibleItems {
    if (_selectedFilter == 'ALL') {
      return _items;
    }

    if (_selectedFilter == 'CANCELLED') {
      return _items
          .where((item) {
            final status = item.session.status.toUpperCase();

            return status == 'CANCELLED' ||
                status == 'REJECTED' ||
                status == 'EXPIRED';
          })
          .toList(growable: false);
    }

    return _items
        .where((item) {
          return item.session.status.toUpperCase() == _selectedFilter;
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    return
    // CUSTOMER_SHARED_PREMIUM_BACKGROUND
    Scaffold(
      backgroundColor: const Color(0xFFFFF9F1),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFF9F1),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        toolbarHeight: 82,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'My Consultations',
              style: TextStyle(
                color: Color(0xFF14213D),
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
            SizedBox(height: 3),
            Text(
              'Your cosmic journey, always with you',
              style: TextStyle(
                color: Color(0xFF6F7280),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh history',
            onPressed: _loading ? null : _loadHistory,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.65, -0.55),
            radius: 1.25,
            colors: [Color(0xFFF5EEFF), Color(0xFFFFF9F1), Color(0xFFFFF9F1)],
            stops: [0.0, 0.45, 1.0],
          ),
        ),
        child: Column(
          children: [
            _buildSummary(),
            _buildFilters(),
            Expanded(child: _buildContent()),
          ],
        ),
      ),
    );
  }

  Widget _buildSummary() {
    final completed = _items.where((item) {
      return item.session.status.toUpperCase() == 'COMPLETED';
    }).length;

    final amounts = <String, double>{};
    var unknownCurrency = false;
    for (final item in _items.where(
      (item) => item.session.status.toUpperCase() == 'COMPLETED',
    )) {
      if (item.currency.isEmpty) {
        unknownCurrency = true;
        continue;
      }
      final currency = item.currency;
      amounts[currency] = (amounts[currency] ?? 0) + item.session.amountCharged;
    }
    final amountLabels = [
      ...amounts.entries.map((entry) => '${entry.key} ${_money(entry.value)}'),
      if (unknownCurrency) 'Some currencies unrecorded',
    ].join(' / ');

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0xFFF8F3FF)],
        ),
        border: Border.all(color: const Color(0xFFE8BD43), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF4C542).withValues(alpha: 0.18),
            blurRadius: 25,
            spreadRadius: 1,
          ),
          BoxShadow(
            color: const Color(0xFF9139D0).withValues(alpha: 0.16),
            blurRadius: 32,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: _SummaryItem(
              icon: Icons.auto_awesome_rounded,
              label: 'Loaded completed',
              value: completed.toString(),
            ),
          ),
          Container(width: 1, height: 52, color: Colors.white12),
          Expanded(
            child: _SummaryItem(
              icon: Icons.account_balance_wallet_rounded,
              label: 'Loaded completed amount',
              value: amountLabels.isEmpty ? 'No recorded amount' : amountLabels,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    const filters = <MapEntry<String, String>>[
      MapEntry('ALL', 'All'),
      MapEntry('COMPLETED', 'Completed'),
      MapEntry('CANCELLED', 'Cancelled'),
    ];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: TextField(
            decoration: const InputDecoration(
              labelText: 'Search consultations',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              _searchDebounce?.cancel();
              _requestVersion++;
              _search = value;
              _searchDebounce = Timer(const Duration(milliseconds: 350), () {
                if (!mounted) return;
                setState(() => _items = []);
                _loadHistory();
              });
            },
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
          child: Row(
            children: filters
                .map((filter) {
                  final selected = filter.key == _selectedFilter;

                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: ChoiceChip(
                      selected: selected,
                      label: Text(filter.value),
                      onSelected: (_) {
                        setState(() {
                          _selectedFilter = filter.key;
                          _items = [];
                        });
                        _loadHistory();
                      },
                      selectedColor: AppColors.gold,
                      backgroundColor: AppColors.surfaceLight,
                      side: BorderSide(
                        color: selected ? AppColors.gold : AppColors.border,
                      ),
                      labelStyle: TextStyle(
                        color: selected
                            ? AppColors.background
                            : AppColors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  );
                })
                .toList(growable: false),
          ),
        ),
      ],
    );
  }

  Widget _buildContent() {
    if (_loading && _items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null && _items.isEmpty) {
      return _MessageState(
        icon: Icons.cloud_off_rounded,
        title: 'Could not load history',
        message: _error!,
        buttonLabel: 'Try Again',
        onPressed: _loadHistory,
      );
    }

    final visibleItems = _visibleItems;

    if (visibleItems.isEmpty && !_hasMore) {
      return const _MessageState(
        icon: Icons.history_rounded,
        title: 'No consultations found',
        message: 'Your consultations will appear here.',
      );
    }

    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: _loadHistory,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
        itemCount: visibleItems.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          if (index == visibleItems.length) {
            return Column(
              children: [
                if (_error != null) Text(_error!),
                if (_hasMore)
                  TextButton(
                    onPressed: _loading
                        ? null
                        : () => _loadHistory(append: true),
                    child: Text(_loading ? 'Loading…' : 'Load more'),
                  ),
              ],
            );
          }
          return _HistoryCard(item: visibleItems[index]);
        },
      ),
    );
  }

  String _money(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toStringAsFixed(2);
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.item});

  final ConsultationHistoryItem item;

  @override
  Widget build(BuildContext context) {
    final session = item.session;
    final status = session.status.toUpperCase();
    final statusColor = _statusColor(status);
    final isCompleted = status == 'COMPLETED';
    final canViewChat =
        session.mode.toLowerCase() == 'chat' &&
        (status == 'COMPLETED' || status == 'ACTIVE');
    final initial = item.astrologerName.isEmpty
        ? 'A'
        : item.astrologerName[0].toUpperCase();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3D394B), Color(0xFF171022), Color(0xFF210721)],
        ),
        border: Border.all(color: const Color(0xFFE8BD43), width: 1.25),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3E214E).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: const Color(0xFFF4C542).withValues(alpha: 0.14),
            blurRadius: 22,
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 62,
                height: 62,
                padding: const EdgeInsets.all(2.2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFFFFF1A2),
                      Color(0xFFF4C542),
                      Color(0xFF9B4AD2),
                    ],
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: CircleAvatar(
                    radius: 27,
                    backgroundColor: const Color(0xFFF8F3FF),
                    backgroundImage: item.astrologerAvatarUrl.isNotEmpty
                        ? NetworkImage(item.astrologerAvatarUrl)
                        : null,
                    child: item.astrologerAvatarUrl.isEmpty
                        ? Text(
                            initial,
                            style: const TextStyle(
                              color: Color(0xFFF4C542),
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          )
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.astrologerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      _date(
                        session.startedAt,
                      ).replaceAll(RegExp(r'[^\x20-\x7E]'), ''),
                      style: const TextStyle(
                        color: Color(0xFFC9C4D2),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.78),
                  ),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          Divider(color: Colors.white.withValues(alpha: 0.16), height: 1),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _Detail(
                  icon: session.mode.toLowerCase() == 'audio'
                      ? Icons.call_rounded
                      : Icons.chat_bubble_rounded,
                  text: session.mode.toLowerCase() == 'audio'
                      ? 'Audio Call'
                      : 'Chat',
                ),
              ),
              Container(
                width: 1,
                height: 22,
                color: Colors.white.withValues(alpha: 0.16),
              ),
              Expanded(
                child: _Detail(
                  icon: Icons.timer_outlined,
                  text:
                      '${session.purchasedMinutes + session.extendedMinutes} min',
                ),
              ),
              Container(
                width: 1,
                height: 22,
                color: Colors.white.withValues(alpha: 0.16),
              ),
              Expanded(
                child: _Detail(
                  icon: Icons.payments_outlined,
                  text:
                      '${item.currency.isEmpty ? 'Currency unrecorded' : item.currency} ${_money(session.amountCharged)}',
                  alignEnd: true,
                ),
              ),
            ],
          ),
          ExpansionTile(
            key: ValueKey('details-${session.id}'),
            title: const Text('View details'),
            textColor: const Color(0xFFF4C542),
            collapsedTextColor: const Color(0xFFF4C542),
            iconColor: const Color(0xFFF4C542),
            collapsedIconColor: const Color(0xFFF4C542),
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Reference: ${session.id}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      'Type: ${session.mode}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      'Status: ${session.status}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      'Started: ${session.startedAt?.toLocal() ?? 'Not recorded'}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      'Ended: ${session.endedAt?.toLocal() ?? 'Not recorded'}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      'Purchased minutes: ${session.purchasedMinutes}',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (consultationKundliV1Enabled)
            TextButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ConsultationKundliConsentScreen(
                    consultationId: session.callSessionId.isNotEmpty
                        ? session.callSessionId
                        : session.id,
                  ),
                ),
              ),
              icon: const Icon(Icons.privacy_tip_outlined),
              label: const Text('Kundli permission'),
            ),
          if (supportOperationsUiEnabled && isCompleted)
            TextButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => FeedbackScreen(
                    consultationId: session.callSessionId.isNotEmpty
                        ? session.callSessionId
                        : session.id,
                  ),
                ),
              ),
              icon: const Icon(Icons.feedback_outlined),
              label: const Text('Private platform feedback'),
            ),
          if (isCompleted) ...[
            const SizedBox(height: 16),
            RateReviewButton(
              callSessionId: session.callSessionId.isNotEmpty
                  ? session.callSessionId
                  : session.id,
              astrologerName: item.astrologerName,
            ),
          ],
          if (canViewChat) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFE6A90D),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFFF4C542), width: 1.25),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ChatScreen(
                        consultationId: session.callSessionId.isNotEmpty
                            ? session.callSessionId
                            : session.id,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.forum_outlined),
                label: Text(status == 'ACTIVE' ? 'Open Chat' : 'View Chat'),
              ),
            ),
          ],
          if (isCompleted && session.astrologerId.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD12F),
                  foregroundColor: const Color(0xFF14213D),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => AstrologerDetailScreen(
                        astrologerId: session.astrologerId,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.replay_rounded),
                label: const Text('Consult Again'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static Color _statusColor(String status) {
    return switch (status) {
      'COMPLETED' => const Color(0xFF77E39B),
      'ACTIVE' => const Color(0xFF63B3FF),
      'PENDING' => AppColors.gold,
      'CANCELLED' || 'REJECTED' || 'EXPIRED' => const Color(0xFFFF8A84),
      _ => AppColors.muted,
    };
  }

  static String _date(DateTime? value) {
    if (value == null) return 'Date unavailable';
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final period = value.hour >= 12 ? 'PM' : 'AM';
    return '${value.day}/${value.month}/${value.year} | $hour:$minute $period';
  }

  static String _money(double value) {
    return value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(2);
  }
}

class _Detail extends StatelessWidget {
  const _Detail({
    required this.icon,
    required this.text,
    this.alignEnd = false,
  });

  final IconData icon;
  final String text;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: alignEnd
          ? MainAxisAlignment.end
          : MainAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFFF4C542)),
        const SizedBox(width: 7),
        Flexible(
          child: Text(
            text,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFF8F5FF),
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.message,
    this.buttonLabel,
    this.onPressed,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? buttonLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 56, color: AppColors.gold),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
              if (buttonLabel != null && onPressed != null) ...[
                const SizedBox(height: 20),
                FilledButton(onPressed: onPressed, child: Text(buttonLabel!)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  const _SummaryItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: const Color(0xFFF4C542), size: 25),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFF14213D),
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF777887),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
