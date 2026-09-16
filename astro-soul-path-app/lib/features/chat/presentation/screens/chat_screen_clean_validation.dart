import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:io';

import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/chat_api.dart';
import '../../data/chat_upload_api.dart';
import '../../data/chat_models.dart';
import '../../data/chat_socket_service.dart';
import '../../../consultations/data/consultation_api.dart';
import '../../../wallet/presentation/screens/customer_wallet_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.consultationId, super.key});

  final String consultationId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  final _chatApi = ChatApi();
  final _chatUploadApi = ChatUploadApi();
  final _consultationApi = ConsultationApi();
  final _sessionStore = AuthSessionStore();
  final _socketService = ChatSocketService();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  List<ConnectivityResult> _lastConnectivity = const [];

  ChatRoom? _room;
  List<ChatMessage> _messages = const [];
  ChatMessage? _replyingTo;

  Timer? _pollTimer;
  Timer? _clockTimer;
  Timer? _typingTimer;
  Timer? _remoteTypingTimer;

  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _isSending = false;
  bool _isUploading = false;
  bool _isEnding = false;
  bool _isExtending = false;
  bool _consultationEnded = false;
  bool _allowLeaveActiveChat = false;
  bool _leaveConfirmationOpen = false;
  bool _otherParticipantTyping = false;
  bool _socketConnected = false;
  bool _otherParticipantOnline = false;
  bool _isNearBottom = true;
  bool _showNewMessagesButton = false;
  int _newMessagesCount = 0;
  String _error = '';
  int _remainingSeconds = 0;

  bool get _chatIsActive {
    if (_consultationEnded) {
      return false;
    }

    final room = _room;

    if (room == null || room.status.toUpperCase() != 'ACTIVE') {
      return false;
    }

    final expiresAt = room.expiresAt;

    return expiresAt == null ||
        expiresAt.toUtc().isAfter(DateTime.now().toUtc());
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scrollController.addListener(_handleScrollPosition);

    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
      _handleConnectivityChanged,
    );

    _initializeChat();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySubscription?.cancel();
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    _typingTimer?.cancel();
    _remoteTypingTimer?.cancel();
    _messageController.dispose();
    _scrollController.removeListener(_handleScrollPosition);
    _scrollController.dispose();
    _socketService.dispose();
    _chatApi.close();
    super.dispose();
  }

  Future<void> _handleConnectivityChanged(
    List<ConnectivityResult> results,
  ) async {
    if (!mounted) {
      return;
    }

    final previous = _lastConnectivity;
    _lastConnectivity = List<ConnectivityResult>.unmodifiable(results);

    final hasConnection =
        results.isNotEmpty && !results.contains(ConnectivityResult.none);

    final previouslyOffline =
        previous.isEmpty || previous.contains(ConnectivityResult.none);

    final transportChanged =
        previous.isNotEmpty &&
            previous.toSet().difference(results.toSet()).isNotEmpty ||
        results.toSet().difference(previous.toSet()).isNotEmpty;

    if (!hasConnection) {
      if (_socketConnected) {
        setState(() {
          _socketConnected = false;
          _otherParticipantTyping = false;
        });
      }

      return;
    }

    // Recover on offline -> online and on transport switches such as
    // Wi-Fi -> mobile / mobile -> Wi-Fi.
    if (previouslyOffline || transportChanged || !_socketConnected) {
      try {
        final room = await _chatApi.joinChat(widget.consultationId);
        final history = await _chatApi.getChatHistory(widget.consultationId);

        if (!mounted) {
          return;
        }

        setState(() {
          _room = room;
          _messages = _mergeHistoryWithLocal(_messages, history.messages);
          _remainingSeconds = _calculateRemaining(room);
          _error = '';
        });

        if (history.unreadCount > 0) {
          try {
            await _chatApi.markAllMessagesRead(widget.consultationId);
          } catch (_) {
            // Read receipt failure must not block recovery.
          }
        }
      } on ChatApiException catch (error) {
        if (mounted) {
          setState(() {
            _error = error.message;
          });
        }
      }

      if (!mounted) {
        return;
      }

      await _connectRealtime();

      if (mounted) {
        _startTimers();
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    switch (state) {
      case AppLifecycleState.resumed:
        _handleAppResumed();
        break;

      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _handleAppBackgrounded();
        break;
    }
  }

  void _handleAppBackgrounded() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    _typingTimer?.cancel();
    _remoteTypingTimer?.cancel();
  }

  Future<void> _handleAppResumed() async {
    if (!mounted) {
      return;
    }

    try {
      // Foreground resync must use authoritative backend state.
      // Local _chatIsActive may be stale after backgrounding.
      final room = await _chatApi.joinChat(widget.consultationId);
      final history = await _chatApi.getChatHistory(widget.consultationId);

      if (!mounted) {
        return;
      }

      setState(() {
        _room = room;
        _messages = _mergeHistoryWithLocal(_messages, history.messages);
        _remainingSeconds = _calculateRemaining(room);
        _error = '';
      });

      if (history.unreadCount > 0) {
        try {
          await _chatApi.markAllMessagesRead(widget.consultationId);
        } catch (_) {
          // Read receipt failure must not block foreground recovery.
        }
      }

      if (!mounted) {
        return;
      }

      await _connectRealtime();

      if (!mounted) {
        return;
      }

      _startTimers();
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });

      await _connectRealtime();

      if (mounted) {
        _startTimers();
      }
    }
  }

  Future<void> _retryChatRecovery() async {
    if (!mounted) {
      return;
    }

    try {
      final room = await _chatApi.joinChat(widget.consultationId);
      final history = await _chatApi.getChatHistory(widget.consultationId);

      if (!mounted) {
        return;
      }

      setState(() {
        _room = room;
        _messages = _mergeHistoryWithLocal(_messages, history.messages);
        _remainingSeconds = _calculateRemaining(room);
        _error = '';
      });

      if (history.unreadCount > 0) {
        try {
          await _chatApi.markAllMessagesRead(widget.consultationId);
        } catch (_) {
          // Read receipt failure must not block recovery.
        }
      }

      if (!mounted) {
        return;
      }

      await _connectRealtime();

      if (!mounted) {
        return;
      }

      _startTimers();
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    }
  }

  Future<void> _initializeChat() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final room = await _chatApi.joinChat(widget.consultationId);
      final history = await _chatApi.getChatHistory(widget.consultationId);

      try {
        await _chatApi.markAllMessagesRead(widget.consultationId);
      } catch (_) {
        // A read-receipt failure must not block chat access.
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _room = room;
        _messages = _mergeHistoryWithLocal(_messages, history.messages);
        _remainingSeconds = _calculateRemaining(room);
      });

      await _connectRealtime();
      _startTimers();
      _scrollToBottom();
    } on ChatApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildChatParticipantHeader() {
    final room = _room;

    if (room == null) {
      return const Text('Chat', style: TextStyle(fontWeight: FontWeight.w700));
    }

    final participant = _currentUserIsAstrologer
        ? room.customer
        : room.astrologer;

    final displayName = participant.name.trim().isNotEmpty
        ? participant.name.trim()
        : (_currentUserIsAstrologer ? 'Customer' : 'Astrologer');

    final avatarUrl = participant.avatarUrl?.trim() ?? '';

    return Row(
      mainAxisSize: MainAxisSize.max,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.gold.withValues(alpha: 0.14),
          backgroundImage: avatarUrl.isNotEmpty
              ? NetworkImage(avatarUrl)
              : null,
          child: avatarUrl.isEmpty
              ? const Icon(Icons.person_rounded, color: AppColors.gold)
              : null,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (!_currentUserIsAstrologer &&
                  room.astrologer.expertise.isNotEmpty)
                Text(
                  room.astrologer.expertise.take(2).join(' \u2022 '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              Wrap(
                spacing: 6,
                runSpacing: 1,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (!_currentUserIsAstrologer &&
                      room.astrologer.rating != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: AppColors.gold,
                          size: 12,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          room.astrologer.rating!.toStringAsFixed(1),
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (room.astrologer.totalReviews > 0)
                          Text(
                            ' ()',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 9.5,
                            ),
                          ),
                      ],
                    ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _otherParticipantOnline
                              ? Colors.green
                              : AppColors.muted,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _otherParticipantOnline ? 'Online' : 'Offline',
                        style: TextStyle(
                          color: _otherParticipantOnline
                              ? Colors.green
                              : AppColors.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<bool> _confirmLeaveActiveChat() async {
    if (!_chatIsActive) {
      return true;
    }

    if (_leaveConfirmationOpen) {
      return false;
    }

    _leaveConfirmationOpen = true;

    try {
      final shouldLeave = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Leave active consultation?'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your consultation is still active and the timer will continue running.',
                ),
                const SizedBox(height: 10),
                Text(
                  'Remaining time: ${_formatRemainingTime(_remainingSeconds)}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Stay in Chat'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Leave Chat'),
              ),
            ],
          );
        },
      );

      return shouldLeave == true;
    } finally {
      _leaveConfirmationOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_chatIsActive || _allowLeaveActiveChat,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || _leaveConfirmationOpen) {
          return;
        }

        final shouldLeave = await _confirmLeaveActiveChat();

        if (!context.mounted || !shouldLeave) {
          return;
        }

        setState(() {
          _allowLeaveActiveChat = true;
        });

        Navigator.of(context).pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          toolbarHeight: 68,
          title: Row(
            mainAxisSize: MainAxisSize.max,
            children: [
              Expanded(child: _buildChatParticipantHeader()),
              const SizedBox(width: 8),
              if (_room != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _remainingSeconds <= 60
                          ? Colors.orange
                          : AppColors.gold,
                    ),
                  ),
                  child: Text(
                    _formatRemainingTime(_remainingSeconds),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: _remainingSeconds <= 60
                          ? Colors.orange
                          : AppColors.gold,
                    ),
                  ),
                ),
            ],
          ),
          actions: [
            if (_chatIsActive)
              TextButton.icon(
                onPressed: _isEnding ? null : _endConsultation,
                icon: _isEnding
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.call_end_rounded),
                label: const Text('End'),
              ),
          ],
        ),
        body: _isLoading
            ? const _ChatLoadingSkeleton()
            : (_room == null && _error.isNotEmpty)
            ? _ChatError(message: _error, onRetry: _initializeChat)
            : Column(
                children: [
                  Expanded(
                    child: _messages.isEmpty
                        ? _ChatEmptyState(
                            isActive: _chatIsActive,
                            isAstrologer: _currentUserIsAstrologer,
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            itemCount: _messages.length,
                            itemBuilder: (context, index) {
                              final message = _messages[index];

                              final currentUserId =
                                  _room?.currentUser.id.trim() ?? '';

                              final isMine =
                                  currentUserId.isNotEmpty &&
                                  message.senderId.trim() == currentUserId;

                              final currentDate = message.createdAt?.toLocal();

                              DateTime? previousDate;
                              if (index > 0) {
                                previousDate = _messages[index - 1].createdAt
                                    ?.toLocal();
                              }

                              final showDateSeparator =
                                  currentDate != null &&
                                  (previousDate == null ||
                                      !_isSameCalendarDay(
                                        currentDate,
                                        previousDate,
                                      ));

                              return Column(
                                children: [
                                  if (showDateSeparator)
                                    _ChatDateSeparator(
                                      label: _formatChatDate(currentDate),
                                    ),
                                  _MessageBubble(
                                    message: message,
                                    isMine: isMine,
                                    onReply: () => _startReply(message),
                                    onRetry: () => _retryFailedMessage(message),
                                  ),
                                ],
                              );
                            },
                          ),
                  ),

                  if (_showNewMessagesButton)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
                      child: Center(
                        child: FilledButton.icon(
                          onPressed: _jumpToLatestMessages,
                          icon: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 18,
                          ),
                          label: Text(
                            _newMessagesCount == 1
                                ? '1 New message'
                                : '$_newMessagesCount New messages',
                          ),
                        ),
                      ),
                    ),
                  if (_error.isNotEmpty)
                    _ChatInlineError(
                      message: _error,
                      onRetry: () {
                        _retryChatRecovery();
                      },
                    ),

                  if (!_socketConnected)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 5, 16, 7),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.gold,
                            ),
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Connection lost. Reconnecting...',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_otherParticipantTyping)
                    Padding(
                      padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          _currentUserIsAstrologer
                              ? 'Customer is typing...'
                              : 'Astrologer is typing...',
                          style: TextStyle(
                            color: AppColors.gold,
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ),
                  if (_chatIsActive &&
                      !_currentUserIsAstrologer &&
                      _remainingSeconds > 0 &&
                      _remainingSeconds <= 60)
                    Container(
                      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        color: AppColors.gold.withValues(alpha: 0.08),
                        border: Border.all(
                          color: AppColors.gold.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Extend consultation',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.gold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Only ${_formatRemainingTime(_remainingSeconds)} remaining',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: _isExtending
                                      ? null
                                      : () => _extendConsultation(5),
                                  child: const Text('+5 min'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: FilledButton(
                                  onPressed: _isExtending
                                      ? null
                                      : () => _extendConsultation(10),
                                  child: _isExtending
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Text('+10 min'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                  _MessageComposer(
                    controller: _messageController,
                    enabled: _chatIsActive,
                    isSending: _isSending || _isUploading,
                    onSend: _sendMessage,
                    onAttach: _showAttachmentPicker,
                    onTyping: _handleTyping,
                    replyingTo: _replyingTo,
                    onCancelReply: _cancelReply,
                  ),
                ],
              ),
      ),
    );
  }

  void _handleConsultationExtended(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);

    if (payload.isEmpty) {
      return;
    }

    final callSessionId = payload['callSessionId']?.toString().trim() ?? '';

    if (callSessionId.isNotEmpty &&
        callSessionId != widget.consultationId.trim()) {
      return;
    }

    final expiresAtRaw = payload['expiresAt']?.toString().trim() ?? '';
    final expiresAt = DateTime.tryParse(expiresAtRaw);

    if (expiresAt == null) {
      // REST polling remains the fallback if an invalid realtime
      // payload is ever received.
      _refreshMessages();
      return;
    }

    final room = _room;

    if (room == null) {
      _refreshMessages();
      return;
    }

    _clockTimer?.cancel();

    setState(() {
      _consultationEnded = false;
      _remainingSeconds = expiresAt
          .toUtc()
          .difference(DateTime.now().toUtc())
          .inSeconds;

      if (_remainingSeconds < 0) {
        _remainingSeconds = 0;
      }

      _error = '';
    });

    // Pull authoritative room state so expiresAt/status remain
    // identical on customer and astrologer devices.
    _refreshMessages();

    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) {
        return;
      }

      final currentRoom = _room;

      if (currentRoom == null) {
        return;
      }

      setState(() {
        _remainingSeconds = _calculateRemaining(currentRoom);
      });

      if (_remainingSeconds <= 0) {
        _clockTimer?.cancel();
      }
    });

    final additionalMinutes = int.tryParse(
      payload['additionalMinutes']?.toString() ?? '',
    );

    if (additionalMinutes != null && additionalMinutes > 0) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              'Consultation extended by $additionalMinutes minutes.',
            ),
          ),
        );
    }
  }

  void _handleConsultationEnded(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);
    final callSessionId = payload['callSessionId']?.toString().trim() ?? '';

    if (callSessionId.isNotEmpty &&
        callSessionId != widget.consultationId.trim()) {
      return;
    }

    _pollTimer?.cancel();
    _clockTimer?.cancel();
    _typingTimer?.cancel();
    _remoteTypingTimer?.cancel();

    setState(() {
      _consultationEnded = true;
      _remainingSeconds = 0;
      _otherParticipantTyping = false;
      _isEnding = false;
      _error = '';
    });

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(const SnackBar(content: Text('Consultation ended.')));
  }

  Future<void> _extendConsultation(int minutes) async {
    if (_isExtending || !_chatIsActive || _currentUserIsAstrologer) {
      return;
    }

    setState(() {
      _isExtending = true;
      _error = '';
    });

    try {
      await _consultationApi.extendConsultation(
        consultationId: widget.consultationId,
        additionalMinutes: minutes,
      );

      if (!mounted) {
        return;
      }

      await _refreshMessages();

      if (!mounted) {
        return;
      }

      _startTimers();

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text('Consultation extended by $minutes minutes.')),
        );
    } on ConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      if (error.code == 'INSUFFICIENT_BALANCE') {
        final openWallet = await showDialog<bool>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Insufficient balance'),
              content: const Text(
                'Your wallet balance is not enough to extend this consultation.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton.icon(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  icon: const Icon(Icons.account_balance_wallet_outlined),
                  label: const Text('Add Money'),
                ),
              ],
            );
          },
        );

        if (openWallet == true && mounted) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const CustomerWalletScreen(),
            ),
          );

          if (mounted) {
            await _refreshMessages();
          }
        }
      } else {
        setState(() {
          _error = error.message;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isExtending = false;
        });
      }
    }
  }

  Future<void> _autoEndConsultation() async {
    if (_isEnding || _consultationEnded) {
      return;
    }

    final room = _room;

    if (room == null || room.status.toUpperCase() != 'ACTIVE') {
      return;
    }

    setState(() {
      _isEnding = true;
      _error = '';
    });

    try {
      await _consultationApi.completeConsultation(widget.consultationId);

      if (!mounted) {
        return;
      }

      _pollTimer?.cancel();
      _clockTimer?.cancel();

      setState(() {
        _consultationEnded = true;
        _remainingSeconds = 0;
        _isEnding = false;
      });

      await _refreshMessages();
    } on ConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isEnding = false;
        _error = error.message;
      });
    }
  }

  Future<void> _endConsultation() async {
    if (_isEnding || !_chatIsActive) {
      return;
    }

    final shouldEnd = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange),
              SizedBox(width: 10),
              Expanded(child: Text('End consultation?')),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'This will immediately end the consultation for both participants.',
              ),
              const SizedBox(height: 12),
              Text(
                'Remaining time: ${_formatRemainingTime(_remainingSeconds)}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text(
                'You can still view the chat history after the consultation ends.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Continue Chat'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              icon: const Icon(Icons.call_end_rounded),
              label: const Text('End Consultation'),
            ),
          ],
        );
      },
    );
    if (shouldEnd != true || !mounted) {
      return;
    }

    setState(() {
      _isEnding = true;
      _error = '';
    });

    try {
      await _consultationApi.completeConsultation(widget.consultationId);

      if (!mounted) {
        return;
      }

      _pollTimer?.cancel();
      _clockTimer?.cancel();

      setState(() {
        _consultationEnded = true;
        _remainingSeconds = 0;
        _isEnding = false;
      });
    } on ConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isEnding = false;
        _error = error.message;
      });
    }
  }

  Future<void> _connectRealtime() async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty || !mounted) {
      return;
    }

    _socketService.dispose();

    _socketService.connect(
      token: token,
      chatSessionId: widget.consultationId,
      onMessage: _handleSocketMessage,
      onTyping: _handleRemoteTyping,
      onRead: _handleReadReceipt,
      onPresence: _handlePresence,
      onEnded: _handleConsultationEnded,
      onExtended: _handleConsultationExtended,
      onConnectionChanged: _handleConnectionChanged,
    );
  }

  void _handleSocketMessage(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);

    if (payload.isEmpty) {
      return;
    }

    final nestedMessage = payload['message'];

    final messageSource = nestedMessage is Map
        ? Map<String, dynamic>.from(nestedMessage)
        : payload;

    final incoming = ChatMessage.fromJson(messageSource);

    if (incoming.id.isEmpty) {
      return;
    }

    final incomingSessionId = incoming.callSessionId.trim();

    if (incomingSessionId.isNotEmpty &&
        incomingSessionId != widget.consultationId.trim()) {
      return;
    }

    final currentUserId = _room?.currentUser.id.trim() ?? '';

    setState(() {
      _messages = _mergeMessage(_messages, incoming);

      if (incoming.senderId != currentUserId) {
        _otherParticipantTyping = false;
      }
    });

    if (incoming.senderId != currentUserId) {
      _markIncomingMessagesRead();

      if (_isNearBottom) {
        _scrollToBottom();
      } else {
        setState(() {
          _showNewMessagesButton = true;
          _newMessagesCount += 1;
        });
      }
    } else {
      _scrollToBottom();
    }
  }

  void _handleConnectionChanged(bool connected) {
    if (!mounted) {
      return;
    }

    final wasConnected = _socketConnected;

    setState(() {
      _socketConnected = connected;

      if (!connected) {
        _otherParticipantTyping = false;
      }
    });

    if (connected && !wasConnected && _chatIsActive) {
      _refreshMessages();
    }
  }

  void _handlePresence(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);

    if (payload.isEmpty) {
      return;
    }

    final callSessionId = payload['callSessionId']?.toString().trim() ?? '';

    if (callSessionId.isNotEmpty &&
        callSessionId != widget.consultationId.trim()) {
      return;
    }

    final userId = payload['userId']?.toString().trim() ?? '';
    final currentUserId = _room?.currentUser.id.trim() ?? '';

    if (userId.isNotEmpty && userId == currentUserId) {
      return;
    }

    final online = payload['isOnline'] == true;

    setState(() {
      _otherParticipantOnline = online;

      if (!online) {
        _otherParticipantTyping = false;
      }
    });
  }

  void _handleRemoteTyping(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);

    if (payload.isEmpty) {
      return;
    }

    final callSessionId = payload['callSessionId']?.toString().trim() ?? '';

    if (callSessionId.isNotEmpty &&
        callSessionId != widget.consultationId.trim()) {
      return;
    }

    final senderId = payload['userId']?.toString().trim() ?? '';
    final currentUserId = _room?.currentUser.id.trim() ?? '';

    if (senderId.isNotEmpty && senderId == currentUserId) {
      return;
    }

    final typing = payload['isTyping'] == true;

    _remoteTypingTimer?.cancel();

    setState(() {
      _otherParticipantTyping = typing;
    });

    if (typing) {
      _remoteTypingTimer = Timer(const Duration(seconds: 3), () {
        if (!mounted) {
          return;
        }

        setState(() {
          _otherParticipantTyping = false;
        });
      });
    }
  }

  void _handleReadReceipt(dynamic data) {
    if (!mounted) {
      return;
    }

    final payload = _asMap(data);
    final callSessionId = payload['callSessionId']?.toString().trim() ?? '';

    if (callSessionId.isNotEmpty &&
        callSessionId != widget.consultationId.trim()) {
      return;
    }

    _refreshMessages();
  }

  Future<void> _markIncomingMessagesRead() async {
    try {
      await _chatApi.markAllMessagesRead(widget.consultationId);
    } catch (_) {
      // Read receipt failure must never block live chat.
    }
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return <String, dynamic>{};
  }

  void _handleTyping(String value) {
    _typingTimer?.cancel();
    _remoteTypingTimer?.cancel();

    if (!_chatIsActive) {
      return;
    }

    final isTyping = value.trim().isNotEmpty;

    _socketService.sendTyping(
      chatSessionId: widget.consultationId,
      typing: isTyping,
    );

    if (isTyping) {
      _typingTimer = Timer(const Duration(seconds: 2), () {
        _socketService.sendTyping(
          chatSessionId: widget.consultationId,
          typing: false,
        );
      });
    }
  }

  void _startTimers() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();

    _pollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _refreshMessages(),
    );

    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final room = _room;

      if (!mounted || room == null) {
        return;
      }

      setState(() {
        _remainingSeconds = _calculateRemaining(room);
      });

      if (_remainingSeconds == 0) {
        _pollTimer?.cancel();
        _clockTimer?.cancel();

        _autoEndConsultation();
      }
    });
  }

  int _calculateRemaining(ChatRoom room) {
    final expiresAt = room.expiresAt;

    if (expiresAt == null) {
      return 0;
    }

    final seconds = expiresAt
        .toUtc()
        .difference(DateTime.now().toUtc())
        .inSeconds;

    return seconds > 0 ? seconds : 0;
  }

  String _formatRemainingTime(int totalSeconds) {
    final safeSeconds = totalSeconds < 0 ? 0 : totalSeconds;
    final minutes = safeSeconds ~/ 60;
    final seconds = safeSeconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  bool get _currentUserIsAstrologer {
    final room = _room;

    if (room == null) {
      return false;
    }

    return room.currentUser.id.trim().isNotEmpty &&
        room.currentUser.id.trim() == room.astrologer.id.trim();
  }

  List<ChatMessage> _mergeHistoryWithLocal(
    List<ChatMessage> localMessages,
    List<ChatMessage> serverMessages,
  ) {
    final byKey = <String, ChatMessage>{};

    String messageKey(ChatMessage message) {
      final clientId = message.clientMessageId.trim();

      if (clientId.isNotEmpty) {
        return 'client:$clientId';
      }

      return 'id:${message.id}';
    }

    for (final message in serverMessages) {
      byKey[messageKey(message)] = message;
    }

    for (final message in localMessages) {
      final status = message.deliveryStatus.trim().toUpperCase();

      if (status != 'SENDING' && status != 'FAILED') {
        continue;
      }

      final key = messageKey(message);

      if (!byKey.containsKey(key)) {
        byKey[key] = message;
      }
    }

    final merged = byKey.values.toList()
      ..sort((first, second) {
        final firstDate =
            first.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final secondDate =
            second.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);

        return firstDate.compareTo(secondDate);
      });

    return List<ChatMessage>.unmodifiable(merged);
  }

  Future<void> _refreshMessages() async {
    if (_isRefreshing || !_chatIsActive) {
      return;
    }

    _isRefreshing = true;

    try {
      final history = await _chatApi.getChatHistory(widget.consultationId);

      if (!mounted) {
        return;
      }

      final shouldScroll = history.messages.length > _messages.length;

      setState(() {
        _messages = _mergeHistoryWithLocal(_messages, history.messages);
        _error = '';
      });

      if (history.unreadCount > 0) {
        try {
          await _chatApi.markAllMessagesRead(widget.consultationId);
        } catch (_) {
          // Messages remain visible if receipt update fails.
        }
      }

      if (shouldScroll) {
        _scrollToBottom();
      }
    } on ChatApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } finally {
      _isRefreshing = false;
    }
  }

  Future<bool> _confirmAttachmentSend({
    required String filePath,
    required bool isImage,
    required String fileName,
    required int fileSize,
  }) async {
    if (!mounted) {
      return false;
    }

    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(isImage ? 'Send photo?' : 'Send file?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isImage) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(
                    File(filePath),
                    height: 220,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return const SizedBox(
                        height: 120,
                        child: Center(child: Text('Preview unavailable')),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
              ] else ...[
                const Icon(
                  Icons.insert_drive_file_outlined,
                  size: 48,
                  color: AppColors.gold,
                ),
                const SizedBox(height: 12),
              ],
              Text(
                fileName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                _formatAttachmentSize(fileSize),
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Send'),
            ),
          ],
        );
      },
    );

    return result == true;
  }

  String _formatAttachmentSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    }

    final kb = bytes / 1024;

    if (kb < 1024) {
      return '${kb.toStringAsFixed(1)} KB';
    }

    return '${(kb / 1024).toStringAsFixed(1)} MB';
  }

  Future<void> _showAttachmentPicker() async {
    if (!_chatIsActive || _isSending || _isUploading) {
      return;
    }

    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(
                    Icons.image_outlined,
                    color: AppColors.gold,
                  ),
                  title: const Text(
                    'Photo',
                    style: TextStyle(color: AppColors.white),
                  ),
                  subtitle: const Text(
                    'JPG, PNG, WEBP or GIF \u2022 Max 10 MB',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  onTap: () => Navigator.of(sheetContext).pop('IMAGE'),
                ),
                ListTile(
                  leading: const Icon(
                    Icons.attach_file_rounded,
                    color: AppColors.gold,
                  ),
                  title: const Text(
                    'File',
                    style: TextStyle(color: AppColors.white),
                  ),
                  subtitle: const Text(
                    'PDF, ZIP, DOC, XLS, TXT or audio \u2022 Max 20 MB',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  onTap: () => Navigator.of(sheetContext).pop('FILE'),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (!mounted || choice == null) {
      return;
    }

    if (choice == 'IMAGE') {
      await _pickAndSendImage();
    } else if (choice == 'FILE') {
      await _pickAndSendFile();
    }
  }

  Future<void> _pickAndSendImage() async {
    try {
      final picker = ImagePicker();

      final image = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );

      if (image == null) {
        return;
      }

      final size = await image.length();

      if (size <= 0) {
        throw const ChatUploadException('Selected image is invalid.');
      }

      if (size > 10 * 1024 * 1024) {
        throw const ChatUploadException('Image must be 10 MB or smaller.');
      }

      final shouldSendImage = await _confirmAttachmentSend(
        filePath: image.path,
        isImage: true,
        fileName: image.name,
        fileSize: size,
      );

      if (!shouldSendImage) {
        return;
      }

      await _uploadAndSendAttachment(filePath: image.path, isImage: true);
    } on ChatUploadException catch (error) {
      _showAttachmentError(error.message);
    } catch (_) {
      _showAttachmentError('Unable to select image. Please try again.');
    }
  }

  Future<void> _pickAndSendFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: false,
        type: FileType.custom,
        allowedExtensions: const [
          'pdf',
          'zip',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'txt',
          'mp3',
          'wav',
          'ogg',
          'webm',
        ],
      );

      if (result == null || result.files.isEmpty) {
        return;
      }

      final picked = result.files.single;
      final path = picked.path?.trim() ?? '';

      if (path.isEmpty) {
        throw const ChatUploadException(
          'Selected file is unavailable on this device.',
        );
      }

      if (picked.size <= 0) {
        throw const ChatUploadException('Selected file is invalid.');
      }

      if (picked.size > 20 * 1024 * 1024) {
        throw const ChatUploadException('File must be 20 MB or smaller.');
      }

      final shouldSendFile = await _confirmAttachmentSend(
        filePath: path,
        isImage: false,
        fileName: picked.name,
        fileSize: picked.size,
      );

      if (!shouldSendFile) {
        return;
      }

      await _uploadAndSendAttachment(filePath: path, isImage: false);
    } on ChatUploadException catch (error) {
      _showAttachmentError(error.message);
    } catch (_) {
      _showAttachmentError('Unable to select file. Please try again.');
    }
  }

  Future<void> _uploadAndSendAttachment({
    required String filePath,
    required bool isImage,
  }) async {
    if (_isUploading || !_chatIsActive) {
      return;
    }

    final caption = _messageController.text.trim();

    setState(() {
      _isUploading = true;
      _error = '';
    });

    try {
      final upload = isImage
          ? await _chatUploadApi.uploadImage(
              callSessionId: widget.consultationId,
              filePath: filePath,
              caption: caption.isEmpty ? null : caption,
            )
          : await _chatUploadApi.uploadFile(
              callSessionId: widget.consultationId,
              filePath: filePath,
              caption: caption.isEmpty ? null : caption,
            );

      final message = await _chatApi.sendAttachmentMessage(
        callSessionId: widget.consultationId,
        messageType: upload.type,
        attachmentUrl: upload.url,
        attachmentName: upload.fileName,
        attachmentMimeType: upload.mimeType,
        attachmentSize: upload.size,
        content: caption.isEmpty ? null : caption,
        clientMessageId:
            'flutter-attachment-${DateTime.now().microsecondsSinceEpoch}',
      );

      if (!mounted) {
        return;
      }

      if (caption.isNotEmpty) {
        _messageController.clear();
      }

      setState(() {
        _messages = _mergeMessage(_messages, message);
      });

      _scrollToBottom();
    } on ChatUploadException catch (error) {
      _showAttachmentError(error.message);
    } on ChatApiException catch (error) {
      _showAttachmentError(error.message);
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  void _showAttachmentError(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _startReply(ChatMessage message) {
    if (!_chatIsActive) {
      return;
    }

    setState(() {
      _replyingTo = message;
    });
  }

  void _cancelReply() {
    if (_replyingTo == null) {
      return;
    }

    setState(() {
      _replyingTo = null;
    });
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    final replyingTo = _replyingTo;

    if (content.isEmpty || _isSending || !_chatIsActive) {
      return;
    }

    final room = _room;

    if (room == null) {
      setState(() {
        _error = 'Chat room is not ready yet.';
      });
      return;
    }

    final currentUser = room.currentUser;

    if (currentUser.id.trim().isEmpty) {
      setState(() {
        _error = 'Unable to identify the current chat user.';
      });
      return;
    }

    final clientMessageId = 'flutter-${DateTime.now().microsecondsSinceEpoch}';

    final optimisticMessage = ChatMessage(
      id: clientMessageId,
      callSessionId: widget.consultationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderIsAstrologer: currentUser.id.trim() == room.astrologer.id.trim(),
      clientMessageId: clientMessageId,
      replyToMessageId: replyingTo?.id,
      replyToMessage: replyingTo == null
          ? null
          : ChatReplyPreview(
              id: replyingTo.id,
              senderId: replyingTo.senderId,
              senderName: replyingTo.senderName,
              senderIsAstrologer: replyingTo.senderIsAstrologer,
              messageType: replyingTo.messageType,
              content: replyingTo.content,
              attachmentUrl: replyingTo.attachmentUrl,
              attachmentName: replyingTo.attachmentName,
            ),
      messageType: 'TEXT',
      content: content,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMimeType: null,
      attachmentSize: 0,
      isRead: false,
      readAt: null,
      createdAt: DateTime.now(),
      deliveryStatus: 'SENDING',
    );

    setState(() {
      _isSending = true;
      _error = '';
      _messages = _mergeMessage(_messages, optimisticMessage);
    });

    _messageController.clear();
    _replyingTo = null;
    _scrollToBottom();

    try {
      final message = await _chatApi.sendTextMessage(
        callSessionId: widget.consultationId,
        content: content,
        clientMessageId: clientMessageId,
        replyToMessageId: replyingTo?.id,
      );

      if (!mounted) {
        return;
      }

      final acknowledgedMessage = message.copyWith(deliveryStatus: 'SENT');

      setState(() {
        _messages = _replaceOptimisticMessage(
          _messages,
          clientMessageId,
          acknowledgedMessage,
        );
      });

      _scrollToBottom();
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _messages = _updateMessageDeliveryStatus(
          _messages,
          clientMessageId,
          'FAILED',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  Future<void> _retryFailedMessage(ChatMessage failedMessage) async {
    if (!_chatIsActive || _isSending) {
      return;
    }

    final clientMessageId = failedMessage.clientMessageId.trim();
    final content = failedMessage.content?.trim() ?? '';

    if (clientMessageId.isEmpty || content.isEmpty) {
      setState(() {
        _error = 'This message cannot be retried.';
      });
      return;
    }

    setState(() {
      _isSending = true;
      _error = '';
      _messages = _updateMessageDeliveryStatus(
        _messages,
        clientMessageId,
        'SENDING',
      );
    });

    try {
      final message = await _chatApi.sendTextMessage(
        callSessionId: widget.consultationId,
        content: content,
        clientMessageId: clientMessageId,
        replyToMessageId: failedMessage.replyToMessageId,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _messages = _replaceOptimisticMessage(
          _messages,
          clientMessageId,
          message.copyWith(deliveryStatus: 'SENT'),
        );
      });
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _messages = _updateMessageDeliveryStatus(
          _messages,
          clientMessageId,
          'FAILED',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  List<ChatMessage> _replaceOptimisticMessage(
    List<ChatMessage> current,
    String clientMessageId,
    ChatMessage serverMessage,
  ) {
    final updated = current
        .map(
          (message) => message.clientMessageId == clientMessageId
              ? serverMessage
              : message,
        )
        .toList();

    updated.sort((first, second) {
      final firstDate =
          first.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final secondDate =
          second.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);

      return firstDate.compareTo(secondDate);
    });

    return List<ChatMessage>.unmodifiable(updated);
  }

  List<ChatMessage> _updateMessageDeliveryStatus(
    List<ChatMessage> current,
    String clientMessageId,
    String status,
  ) {
    return List<ChatMessage>.unmodifiable(
      current.map(
        (message) => message.clientMessageId == clientMessageId
            ? message.copyWith(deliveryStatus: status)
            : message,
      ),
    );
  }

  List<ChatMessage> _mergeMessage(
    List<ChatMessage> current,
    ChatMessage incoming,
  ) {
    final byId = <String, ChatMessage>{
      for (final message in current) message.id: message,
      incoming.id: incoming,
    };

    final merged = byId.values.toList()
      ..sort((first, second) {
        final firstDate =
            first.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final secondDate =
            second.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);

        return firstDate.compareTo(secondDate);
      });

    return List.unmodifiable(merged);
  }

  bool _isSameCalendarDay(DateTime first, DateTime second) {
    return first.year == second.year &&
        first.month == second.month &&
        first.day == second.day;
  }

  String _formatChatDate(DateTime value) {
    final local = value.toLocal();
    final now = DateTime.now();

    if (_isSameCalendarDay(local, now)) {
      return 'Today';
    }

    final yesterday = now.subtract(const Duration(days: 1));

    if (_isSameCalendarDay(local, yesterday)) {
      return 'Yesterday';
    }

    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '${local.day} ${months[local.month - 1]} ${local.year}';
  }

  void _handleScrollPosition() {
    if (!_scrollController.hasClients) {
      return;
    }

    final position = _scrollController.position;
    final distanceFromBottom = position.maxScrollExtent - position.pixels;

    final nearBottom = distanceFromBottom <= 120;

    if (nearBottom == _isNearBottom) {
      return;
    }

    setState(() {
      _isNearBottom = nearBottom;

      if (nearBottom) {
        _showNewMessagesButton = false;
        _newMessagesCount = 0;
      }
    });
  }

  void _jumpToLatestMessages() {
    setState(() {
      _showNewMessagesButton = false;
      _newMessagesCount = 0;
      _isNearBottom = true;
    });

    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) {
        return;
      }

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }
}

class _ChatDateSeparator extends StatelessWidget {
  const _ChatDateSeparator({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Expanded(
            child: Divider(color: Color(0x22FFFFFF), thickness: 1),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0x22FFFFFF)),
              ),
              child: Text(
                label,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const Expanded(
            child: Divider(color: Color(0x22FFFFFF), thickness: 1),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.onReply,
    required this.onRetry,
  });

  final ChatMessage message;
  final bool isMine;
  final VoidCallback onReply;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final content = message.content?.trim() ?? '';
    final createdAt = message.createdAt?.toLocal();

    final messageType = message.messageType.trim().toUpperCase();
    final isSystem = messageType == 'SYSTEM';
    final isImage = messageType == 'IMAGE';
    final isFile = messageType == 'FILE';

    final attachmentUrl = message.attachmentUrl?.trim() ?? '';
    final attachmentName = message.attachmentName?.trim() ?? '';
    final attachmentMimeType = message.attachmentMimeType?.trim() ?? '';

    if (isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.28)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.auto_awesome_rounded,
                  size: 14,
                  color: AppColors.gold,
                ),
                const SizedBox(width: 7),
                Flexible(
                  child: Text(
                    content.isEmpty ? 'Consultation updated' : content,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 310),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0xFFF4C45E) : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(17),
            topRight: const Radius.circular(17),
            bottomLeft: Radius.circular(isMine ? 17 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 17),
          ),
        ),
        child: Column(
          crossAxisAlignment: isMine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          children: [
            if (!isMine && message.senderName.trim().isNotEmpty) ...[
              Text(
                message.senderName.trim(),
                style: const TextStyle(
                  color: AppColors.gold,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
            ],

            if (message.replyToMessage != null) ...[
              _ReplyPreviewCard(reply: message.replyToMessage!, isMine: isMine),
              const SizedBox(height: 8),
            ],
            if (isImage && attachmentUrl.isNotEmpty)
              _ChatImageAttachment(
                url: attachmentUrl,
                onOpen: () => _openAttachment(context, attachmentUrl),
              )
            else if (isFile && attachmentUrl.isNotEmpty)
              _ChatFileAttachment(
                name: attachmentName.isEmpty ? 'Attachment' : attachmentName,
                mimeType: attachmentMimeType,
                size: message.attachmentSize,
                isMine: isMine,
                onOpen: () => _openAttachment(context, attachmentUrl),
              )
            else if ((isImage || isFile) && attachmentUrl.isEmpty)
              Text(
                '[Attachment unavailable]',
                style: TextStyle(
                  color: isMine ? AppColors.background : AppColors.white,
                  fontSize: 14,
                  fontStyle: FontStyle.italic,
                ),
              ),

            if (content.isNotEmpty) ...[
              if (isImage || isFile) const SizedBox(height: 8),
              Text(
                content,
                style: TextStyle(
                  color: isMine ? AppColors.background : AppColors.white,
                  fontSize: 15,
                ),
              ),
            ] else if (!isImage && !isFile) ...[
              Text(
                '[Attachment]',
                style: TextStyle(
                  color: isMine ? AppColors.background : AppColors.white,
                  fontSize: 15,
                ),
              ),
            ],

            const SizedBox(height: 5),

            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: onReply,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: Icon(
                      Icons.reply_rounded,
                      size: 14,
                      color: isMine
                          ? AppColors.background.withValues(alpha: 0.65)
                          : AppColors.muted,
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                if (content.isNotEmpty) ...[
                  InkWell(
                    onTap: () => _copyMessage(context, content),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: Icon(
                        Icons.copy_rounded,
                        size: 13,
                        color: isMine
                            ? AppColors.background.withValues(alpha: 0.65)
                            : AppColors.muted,
                      ),
                    ),
                  ),
                  const SizedBox(width: 5),
                ],
                if (createdAt != null)
                  Text(
                    _formatMessageTime(createdAt),
                    style: TextStyle(
                      color: isMine
                          ? AppColors.background.withValues(alpha: 0.65)
                          : AppColors.muted,
                      fontSize: 10,
                    ),
                  ),
                if (isMine) ...[
                  const SizedBox(width: 5),
                  if (message.deliveryStatus.toUpperCase() == 'SENDING') ...[
                    SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.6,
                        color: AppColors.background.withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Sending...',
                      style: TextStyle(
                        color: AppColors.background.withValues(alpha: 0.7),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ] else if (message.deliveryStatus.toUpperCase() ==
                      'FAILED') ...[
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 14,
                      color: Colors.redAccent,
                    ),
                    const SizedBox(width: 3),
                    const Text(
                      'Failed',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 5),
                    InkWell(
                      onTap: onRetry,
                      borderRadius: BorderRadius.circular(10),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 2,
                        ),
                        child: Text(
                          'Retry',
                          style: TextStyle(
                            color: Colors.redAccent,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ] else ...[
                    Icon(
                      message.isRead
                          ? Icons.done_all_rounded
                          : Icons.done_rounded,
                      size: 14,
                      color: message.isRead
                          ? const Color(0xFF1479FF)
                          : AppColors.background.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 3),
                    Text(
                      message.isRead ? 'Seen' : 'Sent',
                      style: TextStyle(
                        color: message.isRead
                            ? const Color(0xFF1479FF)
                            : AppColors.background.withValues(alpha: 0.7),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Future<void> _copyMessage(BuildContext context, String content) async {
    final text = content.trim();

    if (text.isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: text));

    if (!context.mounted) {
      return;
    }

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        const SnackBar(
          content: Text('Message copied'),
          duration: Duration(seconds: 2),
        ),
      );
  }

  static Future<void> _openAttachment(
    BuildContext context,
    String source,
  ) async {
    final uri = Uri.tryParse(source);

    if (uri == null) {
      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Unable to open attachment.')),
        );
    }
  }

  static String _formatMessageTime(DateTime value) {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final period = value.hour >= 12 ? 'PM' : 'AM';

    return '$hour:$minute $period';
  }
}

class _ChatImageAttachment extends StatelessWidget {
  const _ChatImageAttachment({required this.url, required this.onOpen});

  final String url;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onOpen,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          url,
          width: 240,
          height: 190,
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progress) {
            if (progress == null) {
              return child;
            }

            return const SizedBox(
              width: 240,
              height: 190,
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          },
          errorBuilder: (context, error, stackTrace) {
            return const SizedBox(
              width: 240,
              height: 120,
              child: Center(child: Text('Image unavailable')),
            );
          },
        ),
      ),
    );
  }
}

class _ChatFileAttachment extends StatelessWidget {
  const _ChatFileAttachment({
    required this.name,
    required this.mimeType,
    required this.size,
    required this.isMine,
    required this.onOpen,
  });

  final String name;
  final String mimeType;
  final int size;
  final bool isMine;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: isMine
              ? AppColors.background.withValues(alpha: 0.08)
              : AppColors.background.withValues(alpha: 0.25),
        ),
        child: Row(
          children: [
            Icon(
              Icons.insert_drive_file_outlined,
              color: isMine ? AppColors.background : AppColors.gold,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isMine ? AppColors.background : AppColors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (mimeType.trim().isNotEmpty) mimeType.trim(),
                      if (size > 0) _formatBytes(size),
                    ].join(' \u2022 '),
                    style: TextStyle(
                      color: isMine
                          ? AppColors.background.withValues(alpha: 0.65)
                          : AppColors.muted,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.open_in_new_rounded,
              size: 17,
              color: isMine ? AppColors.background : AppColors.gold,
            ),
          ],
        ),
      ),
    );
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    }

    final kb = bytes / 1024;

    if (kb < 1024) {
      return '${kb.toStringAsFixed(1)} KB';
    }

    final mb = kb / 1024;
    return '${mb.toStringAsFixed(1)} MB';
  }
}

class _ReplyPreviewCard extends StatelessWidget {
  const _ReplyPreviewCard({required this.reply, required this.isMine});

  final ChatReplyPreview reply;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final content = reply.content?.trim() ?? '';
    final type = reply.messageType.trim().toUpperCase();

    final preview = content.isNotEmpty
        ? content
        : type == 'IMAGE'
        ? 'Photo'
        : type == 'FILE'
        ? (reply.attachmentName?.trim().isNotEmpty == true
              ? reply.attachmentName!.trim()
              : 'File')
        : 'Message';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: isMine
            ? AppColors.background.withValues(alpha: 0.12)
            : AppColors.white.withValues(alpha: 0.06),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            reply.senderName.isEmpty ? 'User' : reply.senderName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: isMine ? AppColors.background : AppColors.gold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            preview,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              color: isMine
                  ? AppColors.background.withValues(alpha: 0.75)
                  : AppColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReplyComposerPreview extends StatelessWidget {
  const _ReplyComposerPreview({required this.message, required this.onCancel});

  final ChatMessage message;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final content = message.content?.trim() ?? '';
    final type = message.messageType.trim().toUpperCase();

    final preview = content.isNotEmpty
        ? content
        : type == 'IMAGE'
        ? 'Photo'
        : type == 'FILE'
        ? (message.attachmentName?.trim().isNotEmpty == true
              ? message.attachmentName!.trim()
              : 'File')
        : 'Message';

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.gold.withValues(alpha: 0.08),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.reply_rounded, size: 18, color: AppColors.gold),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Replying to ${message.senderName.isEmpty ? 'User' : message.senderName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Cancel reply',
            onPressed: onCancel,
            icon: const Icon(Icons.close_rounded, size: 18),
          ),
        ],
      ),
    );
  }
}

class _MessageComposer extends StatefulWidget {
  const _MessageComposer({
    required this.controller,
    required this.enabled,
    required this.isSending,
    required this.onSend,
    required this.onAttach,
    required this.onTyping,
    required this.replyingTo,
    required this.onCancelReply,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool isSending;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final ValueChanged<String> onTyping;
  final ChatMessage? replyingTo;
  final VoidCallback onCancelReply;

  @override
  State<_MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<_MessageComposer> {
  final FocusNode _focusNode = FocusNode();

  bool showEmoji = false;

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  void _toggleEmojiPicker() {
    if (!widget.enabled) {
      return;
    }

    if (showEmoji) {
      setState(() {
        showEmoji = false;
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _focusNode.requestFocus();
        }
      });

      return;
    }

    _focusNode.unfocus();
    FocusScope.of(context).unfocus();

    setState(() {
      showEmoji = true;
    });
  }

  void _handleTextFieldTap() {
    if (showEmoji) {
      setState(() {
        showEmoji = false;
      });
    }
  }

  void _insertEmoji(String emoji) {
    if (!widget.enabled || emoji.isEmpty) {
      return;
    }

    final controller = widget.controller;
    final value = controller.value;
    final text = value.text;
    final selection = value.selection;

    final hasValidSelection =
        selection.isValid &&
        selection.start >= 0 &&
        selection.end >= 0 &&
        selection.start <= text.length &&
        selection.end <= text.length;

    final start = hasValidSelection ? selection.start : text.length;
    final end = hasValidSelection ? selection.end : text.length;

    final updatedText = text.replaceRange(start, end, emoji);

    final caretOffset = start + emoji.length;

    controller.value = value.copyWith(
      text: updatedText,
      selection: TextSelection.collapsed(offset: caretOffset),
      composing: TextRange.empty,
    );

    widget.onTyping(updatedText);
  }

  void _handleSend() {
    if (!widget.enabled || widget.isSending) {
      return;
    }

    widget.onSend();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.replyingTo != null)
          _ReplyComposerPreview(
            message: widget.replyingTo!,
            onCancel: widget.onCancelReply,
          ),
        SafeArea(
          top: false,
          child: Row(
            children: [
              IconButton(
                tooltip: showEmoji ? 'Show keyboard' : 'Emoji',
                onPressed: widget.enabled ? _toggleEmojiPicker : null,
                icon: Icon(
                  showEmoji
                      ? Icons.keyboard_alt_outlined
                      : Icons.emoji_emotions_outlined,
                  color: widget.enabled ? AppColors.gold : AppColors.muted,
                ),
              ),
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focusNode,
                  onTap: _handleTextFieldTap,
                  onChanged: widget.onTyping,
                  enabled: widget.enabled,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _handleSend(),
                  minLines: 1,
                  maxLines: 5,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(
                    hintText: 'Type message...',
                  ),
                ),
              ),
              IconButton(
                onPressed: widget.enabled && !widget.isSending
                    ? _handleSend
                    : null,
                icon: widget.isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
        if (showEmoji && widget.enabled)
          SizedBox(
            height: 250,
            child: EmojiPicker(
              textEditingController: widget.controller,
              onEmojiSelected: (_, emoji) {
                _insertEmoji(emoji.emoji);
              },
            ),
          ),
      ],
    );
  }
}

class _ChatLoadingSkeleton extends StatelessWidget {
  const _ChatLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
              children: const [
                _ChatSkeletonDate(),
                SizedBox(height: 18),
                _ChatSkeletonBubble(
                  alignment: Alignment.centerLeft,
                  widthFactor: 0.68,
                  height: 54,
                ),
                SizedBox(height: 14),
                _ChatSkeletonBubble(
                  alignment: Alignment.centerRight,
                  widthFactor: 0.54,
                  height: 48,
                ),
                SizedBox(height: 14),
                _ChatSkeletonBubble(
                  alignment: Alignment.centerLeft,
                  widthFactor: 0.76,
                  height: 68,
                ),
                SizedBox(height: 14),
                _ChatSkeletonBubble(
                  alignment: Alignment.centerRight,
                  widthFactor: 0.63,
                  height: 56,
                ),
                SizedBox(height: 14),
                _ChatSkeletonBubble(
                  alignment: Alignment.centerLeft,
                  widthFactor: 0.48,
                  height: 44,
                ),
              ],
            ),
          ),
          const _ChatSkeletonComposer(),
        ],
      ),
    );
  }
}

class _ChatSkeletonDate extends StatelessWidget {
  const _ChatSkeletonDate();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 82,
        height: 24,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: AppColors.surface,
          border: Border.all(color: AppColors.white.withValues(alpha: 0.05)),
        ),
      ),
    );
  }
}

class _ChatSkeletonBubble extends StatelessWidget {
  const _ChatSkeletonBubble({
    required this.alignment,
    required this.widthFactor,
    required this.height,
  });

  final Alignment alignment;
  final double widthFactor;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: FractionallySizedBox(
        widthFactor: widthFactor,
        child: Container(
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: AppColors.surface,
            border: Border.all(color: AppColors.white.withValues(alpha: 0.04)),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: AppColors.white.withValues(alpha: 0.05),
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  width: 38,
                  height: 6,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: AppColors.white.withValues(alpha: 0.035),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatSkeletonComposer extends StatelessWidget {
  const _ChatSkeletonComposer();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(color: AppColors.white.withValues(alpha: 0.05)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.white.withValues(alpha: 0.045),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  color: AppColors.white.withValues(alpha: 0.045),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.10),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatEmptyState extends StatelessWidget {
  const _ChatEmptyState({required this.isActive, required this.isAstrologer});

  final bool isActive;
  final bool isAstrologer;

  @override
  Widget build(BuildContext context) {
    final title = isActive
        ? 'Start the conversation'
        : 'No messages in this consultation';

    final subtitle = isActive
        ? (isAstrologer
              ? 'The customer is connected. Send a message when you are ready.'
              : 'Your consultation is active. Send your first message to begin.')
        : 'This consultation has no chat messages to show.';

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.gold.withValues(alpha: 0.10),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.28),
                  ),
                ),
                child: const Icon(
                  Icons.forum_outlined,
                  color: AppColors.gold,
                  size: 32,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              if (isActive) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: AppColors.gold.withValues(alpha: 0.07),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.lock_outline_rounded,
                        size: 14,
                        color: AppColors.gold,
                      ),
                      SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Messages are visible only to consultation participants.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatInlineError extends StatelessWidget {
  const _ChatInlineError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 5, 14, 7),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(12, 9, 8, 9),
        decoration: BoxDecoration(
          color: Colors.redAccent.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.redAccent.withValues(alpha: 0.22)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.error_outline_rounded,
              size: 18,
              color: Colors.redAccent,
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  height: 1.3,
                ),
              ),
            ),
            const SizedBox(width: 6),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _ChatError extends StatelessWidget {
  const _ChatError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.redAccent.withValues(alpha: 0.10),
                  border: Border.all(
                    color: Colors.redAccent.withValues(alpha: 0.25),
                  ),
                ),
                child: const Icon(
                  Icons.cloud_off_rounded,
                  color: Colors.redAccent,
                  size: 32,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Unable to load chat',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
