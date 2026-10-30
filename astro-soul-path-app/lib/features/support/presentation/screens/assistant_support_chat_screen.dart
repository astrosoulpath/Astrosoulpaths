import 'dart:async';
import '../../data/support_catalogue.dart';
import '../widgets/support_topics.dart';
import '../widgets/support_account_boundary.dart';
import '../widgets/support_failure.dart';
import 'package:flutter/material.dart';
import '../../../../core/widgets/golden_sparkle_loading.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';
import '../../data/support_models.dart';
import 'support_ticket_detail_screen.dart';
import 'support_home_screen.dart';

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
  bool _aiConsent = false;
  bool _askingConsent = false;
  bool _escalating = false;
  bool _confirming = false;
  String _error = '';
  SupportFailure? _failure;
  String? _pendingText;
  String? _pendingKey;
  SupportCatalogue? _catalogue;
  String? _catalogueError;
  bool _catalogueLoading = true;
  SupportQuestion? _selectedQuestion;
  String? _selectedCategory;
  String _paymentReference = '', _consultationReference = '';

  Future<void> _references() async {
    final value = await showDialog<({String payment, String consultation})>(
      context: context,
      builder: (_) => SupportAccountBoundary(
        child: _SupportReferenceDialog(
          payment: _paymentReference,
          consultation: _consultationReference,
        ),
      ),
    );
    if (mounted && value != null) {
      setState(() {
        _paymentReference = value.payment;
        _consultationReference = value.consultation;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _start();
    unawaited(_loadCatalogue());
  }

  Future<void> _loadCatalogue() async {
    setState(() {
      _catalogueLoading = true;
      _catalogueError = null;
    });
    try {
      final value = await widget.api.getAssistantConfig(refresh: true);
      if (mounted) {
        setState(() {
          _catalogue = value;
          _catalogueLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _catalogue = null;
          _catalogueLoading = false;
          _catalogueError =
              'Support topics could not load. You can still type your question.';
        });
      }
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String _messageFor(Object error) {
    return SupportFailure.from(error).message;
  }

  void _showFailure(Object error) {
    if (!mounted) return;
    final failure = SupportFailure.from(error);
    if (failure.requiresCustomerLogin) {
      setState(() {
        _failure = failure;
        _error = failure.message;
      });
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(failure.message)));
    }
  }

  Future<void> _start() async {
    setState(() {
      _loading = true;
      _error = '';
      _failure = null;
    });

    try {
      if (!await widget.api.isAssistantAvailable()) {
        throw const SupportApiException(
          'AI support is temporarily unavailable. Retry or open Help & Support.',
        );
      }
      if (!mounted) return;
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
        _failure = SupportFailure.from(error);
        _error = _failure!.message;
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

      _showFailure(error);
    }
  }

  Future<void> _send() async {
    final text = _messageController.text.trim();

    final conversation = _conversation;

    if (text.isEmpty || conversation == null || _sending || _askingConsent) {
      return;
    }

    if (!_aiConsent) {
      _askingConsent = true;
      final accepted = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Send to AI Support?'),
          content: const Text(
            'Your question will be sent to the configured AI provider. Do not include passwords, OTPs or unnecessary private information.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('I agree'),
            ),
          ],
        ),
      );
      _askingConsent = false;
      if (!mounted || accepted != true) return;
      _aiConsent = true;
    }

    if (_pendingText != text) {
      _pendingText = text;
      _pendingKey = 'mobile-${DateTime.now().microsecondsSinceEpoch}';
    }

    setState(() {
      _sending = true;
    });

    try {
      await widget.api.sendAssistantMessage(
        aiConsent: _aiConsent,
        conversationId: conversation.id,
        content: text,
        clientMessageId: _pendingKey!,
        paymentOrderId: _paymentReference,
        consultationId: _consultationReference,
        categoryId: _selectedQuestion?.text.trim() == text
            ? _selectedCategory
            : null,
        questionId: _selectedQuestion?.text.trim() == text
            ? _selectedQuestion?.id
            : null,
      );

      if (!mounted) return;
      // A response must not erase a different draft typed while it was pending.
      if (_messageController.text.trim() == text) {
        _messageController.clear();
      }
      _pendingText = null;
      _pendingKey = null;
      await _refresh();
    } catch (error) {
      if (!mounted) return;

      _showFailure(error);
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

    if (conversation == null || _escalating || _confirming) {
      return;
    }

    setState(() => _confirming = true);
    var includeConversation = false;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Talk to Human Support?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Create a real ticket for the support team. No refund or response time is guaranteed.',
              ),
              CheckboxListTile(
                value: includeConversation,
                onChanged: (value) =>
                    setDialogState(() => includeConversation = value == true),
                title: const Text('Include a limited conversation excerpt'),
              ),
            ],
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
      ),
    );
    if (mounted) setState(() => _confirming = false);

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
        includeConversation: includeConversation,
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
  Widget build(BuildContext context) =>
      SupportAccountBoundary(child: _buildContent(context));

  Widget _buildContent(BuildContext context) {
    final conversation = _conversation;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF7EF),
      appBar: AppBar(
        backgroundColor: const Color(0xFF35204F),
        foregroundColor: const Color(0xFFF4D58D),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Astro Soul Path AI Support',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            Text(
              'Your AI Support Assistant',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Talk to Human Support',
            onPressed: conversation == null || _escalating || _confirming
                ? null
                : _escalate,
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
      body: GoldenSparkleLoading(
        loading: _loading,
        child: _error.isNotEmpty
            ? Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_failure != null) ...[
                        Text(
                          _failure!.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                      ],
                      Text(_error, textAlign: TextAlign.center),
                      const SizedBox(height: 14),
                      FilledButton(
                        onPressed: _start,
                        child: const Text('Retry'),
                      ),
                      if (_failure?.requiresCustomerLogin == true)
                        const CustomerSupportRecoveryButton(),
                      TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const SupportHomeScreen(),
                          ),
                        ),
                        child: const Text('Help & Support'),
                      ),
                    ],
                  ),
                ),
              )
            : Column(
                children: [
                  if (MediaQuery.viewInsetsOf(context).bottom == 0)
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

                  if (MediaQuery.viewInsetsOf(context).bottom == 0)
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.sizeOf(context).height * .32,
                      ),
                      child: SingleChildScrollView(
                        child: Column(
                          children: [
                            if (_catalogueLoading)
                              const LinearProgressIndicator(),
                            if (_catalogueError != null)
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  children: [
                                    Text(_catalogueError!),
                                    TextButton(
                                      onPressed: _catalogueLoading
                                          ? null
                                          : _loadCatalogue,
                                      child: const Text(
                                        'Reload support topics',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            if (_catalogue != null)
                              SupportTopics(
                                catalogue: _catalogue!,
                                busy: _sending,
                                onQuestion: (category, question) {
                                  setState(() {
                                    _selectedCategory = category;
                                    _selectedQuestion = question;
                                  });
                                  _messageController.value = TextEditingValue(
                                    text: question.text,
                                    selection: TextSelection.collapsed(
                                      offset: question.text.length,
                                    ),
                                  );
                                },
                              ),
                            Wrap(
                              alignment: WrapAlignment.center,
                              children: [
                                TextButton.icon(
                                  onPressed: _sending ? null : _references,
                                  icon: const Icon(Icons.receipt_long_outlined),
                                  label: Text(
                                    _paymentReference.isNotEmpty ||
                                            _consultationReference.isNotEmpty
                                        ? 'References attached'
                                        : 'Record references',
                                  ),
                                ),
                                TextButton.icon(
                                  onPressed:
                                      _sending || _escalating || _confirming
                                      ? null
                                      : _escalate,
                                  icon: const Icon(Icons.support_agent),
                                  label: const Text('Talk to Human Support'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  Expanded(
                    child: _MessageList(
                      controller: _scrollController,
                      messages: conversation?.messages ?? const [],
                    ),
                  ),

                  if (_sending)
                    Padding(
                      padding: EdgeInsets.fromLTRB(18, 6, 18, 0),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Assistant is thinking…',
                          style: TextStyle(
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurfaceVariant,
                            fontSize: 12,
                          ),
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
                                hintText: 'Type your question here...',
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
                            tooltip: 'Send question',
                            onPressed: _sending ? null : _send,
                            icon: const Icon(Icons.send_rounded),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
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
      return const SingleChildScrollView(
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
                'Hey! 👋 Welcome to Astro Soul Path Support!',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
              ),
              SizedBox(height: 7),
              Text(
                "I'm your AI Support Assistant, here to help you with Kundli, Horoscope, Astrologer consultations, Wallet, Payments and more.\n\nHow can I help you today?",
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

class _SupportReferenceDialog extends StatefulWidget {
  const _SupportReferenceDialog({
    required this.payment,
    required this.consultation,
  });
  final String payment, consultation;
  @override
  State<_SupportReferenceDialog> createState() =>
      _SupportReferenceDialogState();
}

class _SupportReferenceDialogState extends State<_SupportReferenceDialog> {
  late final payment = TextEditingController(text: widget.payment);
  late final consultation = TextEditingController(text: widget.consultation);
  @override
  void dispose() {
    payment.dispose();
    consultation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Optional record references'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Use IDs from your own receipt or history. Never enter card details or passwords. Records are checked only when you send a question.',
          ),
          TextField(
            controller: payment,
            maxLength: 80,
            decoration: const InputDecoration(
              labelText: 'Payment record ID (optional)',
            ),
          ),
          TextField(
            controller: consultation,
            maxLength: 80,
            decoration: const InputDecoration(
              labelText: 'Consultation ID (optional)',
            ),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      TextButton(
        onPressed: () =>
            Navigator.pop(context, (payment: '', consultation: '')),
        child: const Text('Clear references'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, (
          payment: payment.text.trim(),
          consultation: consultation.text.trim(),
        )),
        child: const Text('Attach references'),
      ),
    ],
  );
}
