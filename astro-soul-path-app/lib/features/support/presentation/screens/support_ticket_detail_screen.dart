import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';
import '../../data/support_models.dart';

class SupportTicketDetailScreen extends StatefulWidget {
  const SupportTicketDetailScreen({
    required this.api,
    required this.ticketId,
    super.key,
  });

  final SupportApi api;
  final String ticketId;

  @override
  State<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState extends State<SupportTicketDetailScreen> {
  final TextEditingController _messageController = TextEditingController();

  final ScrollController _scrollController = ScrollController();

  SupportTicketDetail? _ticket;

  bool _loading = true;
  bool _sending = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String _messageFor(Object error) {
    if (error is SupportApiException) {
      return error.message;
    }

    return 'Unable to load this support ticket.';
  }

  Future<void> _openAttachment(SupportAttachmentModel attachment) async {
    final uri = Uri.tryParse(attachment.url);

    if (uri == null ||
        !uri.hasScheme ||
        (uri.scheme != 'https' && uri.scheme != 'http')) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This attachment link is invalid. Please refresh.'),
        ),
      );
      return;
    }

    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open this attachment.')),
        );
      }
    } catch (_) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Unable to open this attachment. Refresh the ticket and try again.',
          ),
        ),
      );
    }
  }

  Future<void> _load() async {
    try {
      final ticket = await widget.api.getTicket(widget.ticketId);

      try {
        await widget.api.markTicketRead(widget.ticketId);
      } catch (_) {
        // Read receipt failure should not block ticket UI.
      }

      if (!mounted) return;

      setState(() {
        _ticket = ticket;
        _loading = false;
        _error = '';
      });

      _scrollToBottom();
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = _messageFor(error);
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final ticket = _ticket;

    final text = _messageController.text.trim();

    if (ticket == null ||
        text.isEmpty ||
        _sending ||
        ticket.status == 'CLOSED') {
      return;
    }

    _messageController.clear();

    setState(() {
      _sending = true;
    });

    try {
      await widget.api.sendTicketMessage(
        ticketId: ticket.id,
        content: text,
        clientMessageId: 'mobile-${DateTime.now().microsecondsSinceEpoch}',
      );

      await _load();
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageFor(error))));
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final ticket = _ticket;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Support Chat',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            if (ticket != null)
              Text(
                ticket.ticketNumber,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w400,
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error, textAlign: TextAlign.center),
                    const SizedBox(height: 14),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : ticket == null
          ? const SizedBox.shrink()
          : Column(
              children: [
                _TicketHeader(ticket: ticket),
                if (ticket.attachments.isNotEmpty)
                  _TicketAttachments(
                    attachments: ticket.attachments,
                    onOpen: _openAttachment,
                  ),
                Expanded(
                  child: _TicketMessages(
                    controller: _scrollController,
                    messages: ticket.messages,
                  ),
                ),
                if (ticket.status == 'CLOSED')
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    color: Colors.grey.withValues(alpha: 0.12),
                    child: const Text(
                      'This ticket is closed. Create a new ticket if you need more help.',
                      textAlign: TextAlign.center,
                    ),
                  )
                else
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _messageController,
                              minLines: 1,
                              maxLines: 5,
                              decoration: InputDecoration(
                                hintText: 'Message supportâ€¦',
                                filled: true,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(22),
                                  borderSide: BorderSide.none,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            onPressed: _sending ? null : _send,
                            icon: _sending
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.send_rounded),
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

class _TicketHeader extends StatelessWidget {
  const _TicketHeader({required this.ticket});

  final SupportTicketDetail ticket;

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

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ticket.subject,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (ticket.description?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    ticket.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(
              ticket.status.replaceAll('_', ' '),
              style: TextStyle(
                color: _statusColor,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketAttachments extends StatelessWidget {
  const _TicketAttachments({required this.attachments, required this.onOpen});

  final List<SupportAttachmentModel> attachments;
  final Future<void> Function(SupportAttachmentModel attachment) onOpen;

  String _sizeLabel(int bytes) {
    if (bytes <= 0) return 'Attachment';

    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }

    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }

  IconData _iconFor(String contentType) {
    final type = contentType.toLowerCase();

    if (type.startsWith('image/')) {
      return Icons.image_outlined;
    }

    if (type == 'application/pdf') {
      return Icons.picture_as_pdf_outlined;
    }

    return Icons.insert_drive_file_outlined;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            attachments.length == 1
                ? 'Attachment'
                : 'Attachments (${attachments.length})',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          ...attachments.map(
            (attachment) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Material(
                color: Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => onOpen(attachment),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        Icon(_iconFor(attachment.contentType), size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                attachment.originalFileName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _sizeLabel(attachment.sizeBytes),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.open_in_new_rounded, size: 18),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketMessages extends StatelessWidget {
  const _TicketMessages({required this.controller, required this.messages});

  final ScrollController controller;
  final List<SupportMessageModel> messages;

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Your ticket is open. Send a message to the support team below.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];

        final customer = message.isCustomer;

        return Align(
          alignment: customer ? Alignment.centerRight : Alignment.centerLeft,
          child: Column(
            crossAxisAlignment: customer
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              Container(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                ),
                margin: const EdgeInsets.only(bottom: 4),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 11,
                ),
                decoration: BoxDecoration(
                  color: customer
                      ? AppColors.gold
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Text(
                  message.content,
                  style: TextStyle(
                    color: customer ? const Color(0xFF1A1407) : null,
                    height: 1.4,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 10, left: 4, right: 4),
                child: Text(
                  customer ? 'You' : 'Support',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontSize: 10),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
