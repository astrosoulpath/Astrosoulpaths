import 'dart:async';
import '../widgets/support_account_boundary.dart';
import '../widgets/support_failure.dart';
import 'package:flutter/material.dart';
import '../../../../core/widgets/golden_sparkle_loading.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/support_api.dart';
import '../../data/support_models.dart';
import 'assistant_support_chat_screen.dart';
import 'support_ticket_detail_screen.dart';

import 'package:file_picker/file_picker.dart';

class SupportHomeScreen extends StatefulWidget {
  const SupportHomeScreen({super.key, this.sessions, this.apiFactory});
  final AuthSessionStore? sessions;
  final SupportApi Function(String token)? apiFactory;

  @override
  State<SupportHomeScreen> createState() => _SupportHomeScreenState();
}

class _SupportHomeScreenState extends State<SupportHomeScreen> {
  late final AuthSessionStore _sessionStore =
      widget.sessions ?? AuthSessionStore();

  SupportApi? _api;
  int _requestVersion = 0, _page = 1;
  String _search = '', _status = '';
  bool _hasMore = true;
  Timer? _searchDebounce;

  List<SupportTicketSummary> _tickets = const [];

  bool _loading = true;
  bool _assistantAvailable = false;
  String _error = '';
  SupportFailure? _failure;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _requestVersion++;
    _searchDebounce?.cancel();
    _api?.close();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_requestVersion;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
        _failure = null;
      });
    }

    try {
      final session = await _sessionStore.read();
      if (!mounted || request != _requestVersion) return;

      if (session == null || session.accessToken.trim().isEmpty) {
        throw const SupportApiException(
          'Please log in again to access support.',
        );
      }

      final api =
          widget.apiFactory?.call(session.accessToken) ??
          SupportApi(accessToken: session.accessToken);

      _api?.close();
      _api = api;

      final results = await Future.wait<dynamic>([
        api.getMyTickets(page: _page, search: _search, status: _status),
        // Provider health must never block the independent human ticket flow.
        api.isAssistantAvailable().catchError((Object _) => false),
      ]);

      if (!mounted || request != _requestVersion) return;

      setState(() {
        final incoming = results[0] as List<SupportTicketSummary>;
        _hasMore = incoming.length == 25;
        _tickets = _page == 1
            ? incoming
            : {
                for (final item in [..._tickets, ...incoming]) item.id: item,
              }.values.toList();

        _assistantAvailable = results[1] as bool;

        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _requestVersion) return;

      setState(() {
        _failure = SupportFailure.from(error);
        _error = _failure!.message;
        _loading = false;
      });
    }
  }

  String _messageFor(Object error) {
    if (error is SupportApiException) {
      return error.message;
    }

    return 'Unable to load support right now.';
  }

  Future<void> _openAssistant() async {
    final api = _api;

    if (api == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AssistantSupportChatScreen(api: api),
      ),
    );

    if (mounted) {
      await _load();
    }
  }

  Future<void> _openTicket(String ticketId) async {
    final api = _api;

    if (api == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SupportTicketDetailScreen(api: api, ticketId: ticketId),
      ),
    );

    if (mounted) {
      await _load();
    }
  }

  Future<void> _createTicket() async {
    final api = _api;

    if (api == null) return;

    final subjectController = TextEditingController();

    final messageController = TextEditingController();
    final emailController = TextEditingController();

    String category = 'GENERAL';
    PlatformFile? selectedAttachment;

    final shouldCreate = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Create Support Ticket',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Your request goes directly to the support team.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: subjectController,
                      maxLength: 160,
                      decoration: const InputDecoration(
                        labelText: 'Subject',
                        hintText: 'How can we help?',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: category,
                      decoration: const InputDecoration(
                        labelText: 'Category',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'GENERAL',
                          child: Text('General'),
                        ),
                        DropdownMenuItem(
                          value: 'CONSULTATION',
                          child: Text('Consultation'),
                        ),
                        DropdownMenuItem(
                          value: 'PAYMENT',
                          child: Text('Payment'),
                        ),
                        DropdownMenuItem(
                          value: 'WALLET',
                          child: Text('Wallet'),
                        ),
                        DropdownMenuItem(
                          value: 'ACCOUNT',
                          child: Text('Account'),
                        ),
                        DropdownMenuItem(
                          value: 'ASTROLOGER',
                          child: Text('Astrologer'),
                        ),
                        DropdownMenuItem(
                          value: 'TECHNICAL',
                          child: Text('Technical'),
                        ),
                        DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                        DropdownMenuItem(value: 'CALL', child: Text('Calls')),
                        DropdownMenuItem(value: 'CHAT', child: Text('Chats')),
                        DropdownMenuItem(
                          value: 'KUNDLI',
                          child: Text('Kundli'),
                        ),
                        DropdownMenuItem(
                          value: 'HOROSCOPE',
                          child: Text('Horoscope'),
                        ),
                        DropdownMenuItem(
                          value: 'SUBSCRIPTION',
                          child: Text('Subscriptions'),
                        ),
                        DropdownMenuItem(
                          value: 'SOUL_BAZAAR',
                          child: Text('Soul Bazaar'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value == null) return;

                        setSheetState(() {
                          category = value;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email for support updates',
                        hintText: 'you@example.com',
                        prefixIcon: Icon(Icons.email_outlined),
                        helperText:
                            'Email delivery uses your verified account address when configured.',
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: messageController,
                      minLines: 4,
                      maxLines: 7,
                      maxLength: 4000,
                      decoration: const InputDecoration(
                        labelText: 'Describe your issue',
                        alignLabelWithHint: true,
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final result = await FilePicker.platform.pickFiles(
                          allowMultiple: false,
                          type: FileType.custom,
                          allowedExtensions: const [
                            'jpg',
                            'jpeg',
                            'png',
                            'webp',
                            'gif',
                            'pdf',
                            'doc',
                            'docx',
                            'txt',
                          ],
                        );

                        if (result == null || result.files.isEmpty) {
                          return;
                        }

                        final file = result.files.single;

                        if (file.path == null || file.path!.trim().isEmpty) {
                          if (sheetContext.mounted) {
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Unable to access the selected file.',
                                ),
                              ),
                            );
                          }
                          return;
                        }

                        const maxBytes = 10 * 1024 * 1024;

                        if (file.size > maxBytes) {
                          if (sheetContext.mounted) {
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Attachment must be 10 MB or smaller.',
                                ),
                              ),
                            );
                          }
                          return;
                        }

                        setSheetState(() {
                          selectedAttachment = file;
                        });
                      },
                      icon: const Icon(Icons.attach_file_rounded),
                      label: Text(
                        selectedAttachment == null
                            ? 'Attach file (optional)'
                            : 'Change attachment',
                      ),
                    ),
                    if (selectedAttachment != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.insert_drive_file_outlined),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    selectedAttachment!.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${(selectedAttachment!.size / 1024).toStringAsFixed(1)} KB',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Remove attachment',
                              onPressed: () {
                                setSheetState(() {
                                  selectedAttachment = null;
                                });
                              },
                              icon: const Icon(Icons.close_rounded),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        onPressed: () {
                          if (subjectController.text.trim().length < 3) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Please enter a valid subject.'),
                              ),
                            );
                            return;
                          }

                          Navigator.of(sheetContext).pop(true);
                        },
                        child: const Text('Create Ticket'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (shouldCreate != true) {
      subjectController.dispose();
      messageController.dispose();
      emailController.dispose();
      return;
    }

    final subject = subjectController.text.trim();

    final description = messageController.text.trim();
    final contactEmail = emailController.text.trim();
    final attachmentPath = selectedAttachment?.path?.trim();
    final attachmentName = selectedAttachment?.name;

    subjectController.dispose();
    messageController.dispose();
    emailController.dispose();

    try {
      final ticket = await api.createTicket(
        subject: subject,
        description: description.isEmpty ? null : description,
        contactEmail: contactEmail.isEmpty ? null : contactEmail,
        category: category,
      );

      String? attachmentUploadError;

      if (attachmentPath != null && attachmentPath.isNotEmpty) {
        try {
          await api.uploadTicketAttachment(
            ticketId: ticket.id,
            filePath: attachmentPath,
          );
        } catch (error) {
          attachmentUploadError = _messageFor(error);
        }
      }

      if (!mounted) return;

      if (attachmentUploadError != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 8),
            content: Text(
              'Ticket ${ticket.ticketNumber} was created, but '
              '${attachmentName ?? 'the attachment'} could not be uploaded. '
              '$attachmentUploadError',
            ),
          ),
        );
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              SupportTicketDetailScreen(api: api, ticketId: ticket.id),
        ),
      );

      if (mounted) {
        await _load();
      }
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageFor(error))));
    }
  }

  @override
  Widget build(BuildContext context) =>
      SupportAccountBoundary(child: _buildContent(context));

  Widget _buildContent(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    final pageBackground = dark
        ? Theme.of(context).scaffoldBackgroundColor
        : const Color(0xFFF6F7FB);

    return Scaffold(
      backgroundColor: pageBackground,
      appBar: AppBar(
        title: const Text('Help & Support'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(112),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Search my tickets',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    _searchDebounce?.cancel();
                    _searchDebounce = Timer(
                      const Duration(milliseconds: 350),
                      () {
                        if (mounted) {
                          _search = value;
                          _page = 1;
                          _load();
                        }
                      },
                    );
                  },
                ),
                DropdownButton<String>(
                  value: _status,
                  isExpanded: true,
                  items:
                      const [
                            '',
                            'OPEN',
                            'IN_PROGRESS',
                            'WAITING_FOR_CUSTOMER',
                            'RESOLVED',
                            'CLOSED',
                          ]
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(
                                value.isEmpty
                                    ? 'All statuses'
                                    : value.replaceAll('_', ' '),
                              ),
                            ),
                          )
                          .toList(),
                  onChanged: (value) {
                    _status = value ?? '';
                    _page = 1;
                    _load();
                  },
                ),
              ],
            ),
          ),
        ),
        centerTitle: false,
        actions: [
          if (_hasMore && _tickets.isNotEmpty)
            IconButton(
              tooltip: 'Load more tickets',
              onPressed: _loading || _error.isNotEmpty
                  ? null
                  : () {
                      _page++;
                      _load();
                    },
              icon: const Icon(Icons.expand_more),
            ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading
                ? null
                : () {
                    _page = 1;
                    _load();
                  },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: GoldenSparkleLoading(
        loading: _loading,
        child: RefreshIndicator(
          onRefresh: () {
            _page = 1;
            return _load();
          },
          child: _error.isNotEmpty
              ? _ErrorView(message: _error, failure: _failure, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
                  children: [
                    _SupportHero(dark: dark),
                    const SizedBox(height: 18),

                    _SupportActionCard(
                      dark: dark,
                      icon: Icons.auto_awesome,
                      title: 'AI Support Assistant',
                      subtitle: _assistantAvailable
                          ? 'Get instant help from our 24\u00D77 assistant.'
                          : 'Assistant is temporarily unavailable. Human support is still available.',
                      badge: _assistantAvailable ? 'ONLINE' : 'OFFLINE',
                      enabled: _assistantAvailable,
                      onTap: _openAssistant,
                    ),

                    const SizedBox(height: 12),

                    _SupportActionCard(
                      dark: dark,
                      icon: Icons.support_agent_rounded,
                      title: 'Chat with Human Support',
                      subtitle:
                          'Create a support ticket and continue the conversation securely inside the app.',
                      badge: '24\u00D77',
                      onTap: _createTicket,
                    ),

                    const SizedBox(height: 26),

                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'My Support Tickets',
                            style: Theme.of(
                              context,
                            ).textTheme.titleMedium?.copyWith(fontSize: 20),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _createTicket,
                          icon: const Icon(Icons.add_rounded, size: 18),
                          label: const Text('New'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    if (_tickets.isEmpty)
                      _EmptyTicketsCard(dark: dark, onCreate: _createTicket)
                    else
                      ..._tickets.map(
                        (ticket) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _TicketCard(
                            ticket: ticket,
                            dark: dark,
                            onTap: () => _openTicket(ticket.id),
                          ),
                        ),
                      ),

                    const SizedBox(height: 14),

                    _PrivacyNotice(dark: dark),
                  ],
                ),
        ),
      ),
    );
  }
}

class _SupportHero extends StatelessWidget {
  const _SupportHero({required this.dark});

  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.surfaceLight, AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            blurRadius: 24,
            offset: const Offset(0, 10),
            color: Colors.black.withValues(alpha: dark ? 0.28 : 0.12),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.14),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.gold, width: 1.5),
            ),
            child: const Icon(
              Icons.headset_mic_rounded,
              color: AppColors.gold,
              size: 32,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "We're here 24\u00D77",
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 7),
                Text(
                  'Ask our assistant or connect with the support team without leaving the app.',
                  style: TextStyle(
                    color: Color(0xFFD3D8E7),
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportActionCard extends StatelessWidget {
  const _SupportActionCard({
    required this.dark,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.onTap,
    this.enabled = true,
  });

  final bool dark;
  final IconData icon;
  final String title;
  final String subtitle;
  final String badge;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final surface = dark ? Theme.of(context).colorScheme.surface : Colors.white;

    return Opacity(
      opacity: enabled ? 1 : 0.72,
      child: Material(
        color: surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: enabled ? onTap : null,
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.22)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(icon, color: AppColors.gold),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.gold.withValues(alpha: 0.13),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              badge,
                              style: const TextStyle(
                                color: AppColors.gold,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        subtitle,
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_ios_rounded, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({
    required this.ticket,
    required this.dark,
    required this.onTap,
  });

  final SupportTicketSummary ticket;
  final bool dark;
  final VoidCallback onTap;

  Color get _statusColor {
    switch (ticket.status) {
      case 'RESOLVED':
        return Colors.green;
      case 'CLOSED':
        return Colors.grey;
      case 'IN_PROGRESS':
        return Colors.blue;
      case 'WAITING_FOR_CUSTOMER':
        return Colors.orange;
      default:
        return AppColors.gold;
    }
  }

  String get _statusLabel => ticket.status.replaceAll('_', ' ');

  @override
  Widget build(BuildContext context) {
    return Material(
      color: dark
          ? Theme.of(context).colorScheme.surface
          : Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: dark
                  ? Colors.white.withValues(alpha: 0.07)
                  : Colors.black.withValues(alpha: 0.06),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      ticket.subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      _statusLabel,
                      style: TextStyle(
                        color: _statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                ticket.ticketNumber,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontSize: 12),
              ),
              const SizedBox(height: 6),
              Text(
                '${ticket.priority.replaceAll('_', ' ')} priority · Updated ${(ticket.updatedAt ?? ticket.createdAt).toLocal().toString().substring(0, 16)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.chat_bubble_outline_rounded, size: 15),
                  const SizedBox(width: 5),
                  Text(
                    '${ticket.messageCount} messages',
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(fontSize: 12),
                  ),
                  const Spacer(),
                  const Icon(Icons.arrow_forward_rounded, size: 19),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyTicketsCard extends StatelessWidget {
  const _EmptyTicketsCard({required this.dark, required this.onCreate});

  final bool dark;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: dark
            ? Theme.of(context).colorScheme.surface
            : Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Icon(
            Icons.confirmation_number_outlined,
            size: 42,
            color: AppColors.gold.withValues(alpha: 0.9),
          ),
          const SizedBox(height: 12),
          const Text(
            'No support tickets yet',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 7),
          Text(
            'Create a ticket whenever you need help from our support team.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 15),
          OutlinedButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Create Ticket'),
          ),
        ],
      ),
    );
  }
}

class _PrivacyNotice extends StatelessWidget {
  const _PrivacyNotice({required this.dark});

  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.lock_outline_rounded, size: 16, color: AppColors.gold),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Support conversations stay inside Astro Soul Path. We do not show personal support phone numbers.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.message,
    this.failure,
    required this.onRetry,
  });

  final String message;
  final SupportFailure? failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 120),
        const Icon(
          Icons.support_agent_outlined,
          size: 52,
          color: AppColors.gold,
        ),
        const SizedBox(height: 16),
        if (failure != null) ...[
          Text(failure!.title, textAlign: TextAlign.center),
          const SizedBox(height: 12),
        ],
        Text(message, textAlign: TextAlign.center),
        if (failure?.requiresCustomerLogin == true) ...[
          const SizedBox(height: 16),
          const Center(child: CustomerSupportRecoveryButton()),
        ],
        const SizedBox(height: 16),
        Center(
          child: FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ),
      ],
    );
  }
}
