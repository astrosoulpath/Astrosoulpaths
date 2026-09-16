import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';
import '../../data/support_models.dart';
import 'support_ticket_detail_screen.dart';

class AssistantSupportChatScreen extends StatefulWidget {
  const AssistantSupportChatScreen({required this.api, super.key});

  final SupportApi api;

  @override
  State<AssistantSupportChatScreen> createState() =>
      _AssistantSupportChatScreenState();
}

class _AssistantSupportChatScreenState
    extends State<AssistantSupportChatScreen> {
  final TextEditingController _messageController = TextEditingController();

  final ScrollController _scrollController = ScrollController();

  AssistantConversationModel? _conversation;

  bool _loading = true;
  bool _sending = false;
  bool _escalating = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _start();
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

    return 'Support assistant is unavailable right now.';
  }

  Future<void> _start() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final conversation = await widget.api.startOrGetAssistantConversation();

      if (!mounted) return;

      setState(() {
        _conversation = conversation;
        _loading = false;
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

  Future<void> _refresh() async {
    final conversation = _conversation;

    if (conversation == null) {
      await _start();
      return;
    }

    try {
      final refreshed = await widget.api.getAssistantConversation(
        conversation.id,
      );

      if (!mounted) return;

      setState(() {
        _conversation = refreshed;
      });

      _scrollToBottom();
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageFor(error))));
    }
  }

  Future<void> _send() async {
    final text = _messageController.text.trim();

    final conversation = _conversation;

    if (text.isEmpty || conversation == null || _sending) {
      return;
    }

    _messageController.clear();

    setState(() {
      _sending = true;
    });

    try {
      await widget.api.sendAssistantMessage(
        conversationId: conversation.id,
        content: text,
        clientMessageId: 'mobile-${DateTime.now().microsecondsSinceEpoch}',
      );

      await _refresh();
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

  Future<void> _escalate() async {
    final conversation = _conversation;

    if (conversation == null || _escalating) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Talk to Human Support?'),
        content: const Text(
          'Your assistant conversation will be escalated into a real support ticket for the support team.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _escalating = true;
    });

    try {
      final ticket = await widget.api.escalateAssistantToHuman(
        conversationId: conversation.id,
        subject: 'Support Assistant Escalation',
      );

      if (!mounted) return;

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              SupportTicketDetailScreen(api: widget.api, ticketId: ticket.id),
        ),
      );

      if (mounted) {
        await _refresh();
      }
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageFor(error))));
    } finally {
      if (mounted) {
        setState(() {
          _escalating = false;
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
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final conversation = _conversation;

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Support Assistant',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            Text(
              '24×7 AI assistance',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Talk to Human Support',
            onPressed: conversation == null || _escalating ? null : _escalate,
            icon: _escalating
                ? const SizedBox(
                    width: 19,
                    height: 19,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.support_agent_rounded),
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
                    FilledButton(onPressed: _start, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  color: AppColors.gold.withValues(alpha: 0.08),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.verified_user_outlined,
                        size: 17,
                        color: AppColors.gold,
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'For account actions, payments or refunds, the assistant may ask you to escalate to human support.',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: _MessageList(
                    controller: _scrollController,
                    messages: conversation?.messages ?? const [],
                  ),
                ),

                if (_sending)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(18, 6, 18, 0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Assistant is thinking…',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ),
                  ),

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
                            textInputAction: TextInputAction.newline,
                            decoration: InputDecoration(
                              hintText: 'Ask for help…',
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
                          icon: const Icon(Icons.send_rounded),
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

class _MessageList extends StatelessWidget {
  const _MessageList({required this.controller, required this.messages});

  final ScrollController controller;
  final List<SupportMessageModel> messages;

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 34,
                backgroundColor: Color(0x221FA2FF),
                child: Icon(
                  Icons.auto_awesome,
                  size: 30,
                  color: AppColors.gold,
                ),
              ),
              SizedBox(height: 16),
              Text(
                'Hi! How can we help?',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
              ),
              SizedBox(height: 7),
              Text(
                'Ask a question about using Astro Soul Path or your support options.',
                textAlign: TextAlign.center,
              ),
            ],
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
          child: Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.78,
            ),
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: customer
                  ? AppColors.gold
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(17),
                topRight: const Radius.circular(17),
                bottomLeft: Radius.circular(customer ? 17 : 4),
                bottomRight: Radius.circular(customer ? 4 : 17),
              ),
            ),
            child: Text(
              message.content,
              style: TextStyle(
                color: customer ? const Color(0xFF1A1407) : null,
                height: 1.4,
              ),
            ),
          ),
        );
      },
    );
  }
}
