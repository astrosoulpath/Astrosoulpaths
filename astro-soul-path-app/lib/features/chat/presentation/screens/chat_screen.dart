import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:io';

import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/chat_api.dart';
import '../../data/chat_e2ee_crypto_service.dart';
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
  final _e2eeCrypto = ChatE2eeCryptoService();
  final _chatUploadApi = ChatUploadApi();
  final _consultationApi = ConsultationApi();
  final _sessionStore = AuthSessionStore();
  final _socketService = ChatSocketService();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  final AudioRecorder _voiceRecorder = AudioRecorder();
  final _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  List<ConnectivityResult> _lastConnectivity = const [];

  ChatRoom? _room;
  ChatSafetyStatus? _safetyStatus;
  List<ChatMessage> _messages = const [];
  ChatMessage? _replyingTo;

  Timer? _pollTimer;
  Timer? _clockTimer;
  Timer? _typingTimer;
  Timer? _remoteTypingTimer;
  Timer? _voiceRecordingTimer;
  DateTime? _voiceRecordingStartedAt;

  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _isSending = false;
  bool _isSafetyActionRunning = false;
  bool _isUploading = false;
  bool _isRecordingVoice = false;
  bool _isSendingVoice = false;
  int _voiceRecordingMs = 0;
  String? _voiceRecordingPath;
  double _uploadProgress = 0;
  bool _isEnding = false;
  bool _isExtending = false;
  bool _consultationEnded = false;
  bool _ratingPromptShown = false;
  bool _isSubmittingRating = false;
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
  DateTime? _effectiveExpiresAt;

  bool get _chatIsActive {
    if (_consultationEnded) {
      return false;
    }

    final room = _room;

    if (room == null || room.status.toUpperCase() != 'ACTIVE') {
      return false;
    }

    final expiresAt = _effectiveExpiresAt ?? room.expiresAt;

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
    _voiceRecordingTimer?.cancel();
    unawaited(_voiceRecorder.dispose());
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
        final rawHistory = await _chatApi.getChatHistory(widget.consultationId);

        final decryptedMessages = await _decryptSecureMessages(
          rawHistory.messages,
        );

        final history = ChatHistory(
          messages: decryptedMessages,
          total: rawHistory.total,
          unreadCount: rawHistory.unreadCount,
        );
        if (!mounted) {
          return;
        }

        setState(() {
          _room = room;
          _effectiveExpiresAt = room.expiresAt;
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

      await _refreshSafetyStatus();
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
    _voiceRecordingTimer?.cancel();
    unawaited(_voiceRecorder.dispose());
  }

  Future<void> _handleAppResumed() async {
    if (!mounted) {
      return;
    }

    try {
      // Foreground resync must use authoritative backend state.
      // Local _chatIsActive may be stale after backgrounding.
      final room = await _chatApi.joinChat(widget.consultationId);
      final rawHistory = await _chatApi.getChatHistory(widget.consultationId);

      final decryptedMessages = await _decryptSecureMessages(
        rawHistory.messages,
      );

      final history = ChatHistory(
        messages: decryptedMessages,
        total: rawHistory.total,
        unreadCount: rawHistory.unreadCount,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _room = room;
        _effectiveExpiresAt = room.expiresAt;
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

      await _refreshSafetyStatus();
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

      await _refreshSafetyStatus();
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
      final rawHistory = await _chatApi.getChatHistory(widget.consultationId);

      final decryptedMessages = await _decryptSecureMessages(
        rawHistory.messages,
      );

      final history = ChatHistory(
        messages: decryptedMessages,
        total: rawHistory.total,
        unreadCount: rawHistory.unreadCount,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _room = room;
        _effectiveExpiresAt = room.expiresAt;
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

      await _refreshSafetyStatus();
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
    try {
      await _e2eeCrypto.ensureIdentityRegistered();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('[CHAT] secure setup failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _isLoading = false;
        _error = 'Secure chat setup failed. Please try again.';
      });

      return;
    }

    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final room = await _chatApi.joinChat(widget.consultationId);
      final rawHistory = await _chatApi.getChatHistory(widget.consultationId);

      final decryptedMessages = await _decryptSecureMessages(
        rawHistory.messages,
      );

      final history = ChatHistory(
        messages: decryptedMessages,
        total: rawHistory.total,
        unreadCount: rawHistory.unreadCount,
      );
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
        _effectiveExpiresAt = room.expiresAt;
        _messages = _mergeHistoryWithLocal(_messages, history.messages);
        _remainingSeconds = _calculateRemaining(room);
      });

      await _connectRealtime();

      await _refreshSafetyStatus();
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

  ChatParticipant? get _otherParticipant {
    final room = _room;

    if (room == null) {
      return null;
    }

    final currentUserId = room.currentUser.id.trim();

    if (currentUserId.isEmpty) {
      return null;
    }

    if (currentUserId == room.astrologer.id.trim()) {
      return room.customer;
    }

    return room.astrologer;
  }

  bool get _safetyAllowsMessaging {
    final status = _safetyStatus;

    if (status == null) {
      return true;
    }

    return status.canMessage;
  }

  Future<void> _refreshSafetyStatus() async {
    final participant = _otherParticipant;

    if (participant == null || participant.id.trim().isEmpty) {
      return;
    }

    try {
      final status = await _chatApi.getSafetyStatus(participant.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _safetyStatus = status;
      });
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    }
  }

  String get _otherParticipantDisplayName {
    final participant = _otherParticipant;

    if (participant == null) {
      return _currentUserIsAstrologer ? 'customer' : 'astrologer';
    }

    final name = participant.name.trim();

    if (name.isNotEmpty) {
      return name;
    }

    return _currentUserIsAstrologer ? 'customer' : 'astrologer';
  }

  Future<void> _handleSafetyMenuAction(String action) async {
    if (_isSafetyActionRunning) {
      return;
    }

    switch (action) {
      case 'REPORT':
        await _reportOtherParticipant();
        break;

      case 'BLOCK':
        await _blockOtherParticipant();
        break;

      case 'UNBLOCK':
        await _unblockOtherParticipant();
        break;
    }
  }

  Future<void> _blockOtherParticipant() async {
    final participant = _otherParticipant;

    if (participant == null || participant.id.trim().isEmpty) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Block user?'),
          content: Text(
            'You will no longer be able to exchange messages with '
            '$_otherParticipantDisplayName until you unblock them.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Block'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _isSafetyActionRunning = true;
    });

    try {
      await _chatApi.blockUser(participant.id);

      await _refreshSafetyStatus();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$_otherParticipantDisplayName has been blocked.'),
        ),
      );
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isSafetyActionRunning = false;
        });
      }
    }
  }

  Future<void> _unblockOtherParticipant() async {
    final participant = _otherParticipant;

    if (participant == null || participant.id.trim().isEmpty) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Unblock user?'),
          content: Text(
            'You will be able to exchange messages with '
            '$_otherParticipantDisplayName again.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Unblock'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _isSafetyActionRunning = true;
    });

    try {
      await _chatApi.unblockUser(participant.id);

      await _refreshSafetyStatus();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$_otherParticipantDisplayName has been unblocked.'),
        ),
      );
    } on ChatApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isSafetyActionRunning = false;
        });
      }
    }
  }

  Future<void> _reportOtherParticipant() async {
    final participant = _otherParticipant;

    if (participant == null || participant.id.trim().isEmpty) {
      return;
    }

    final reason = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        const reasons = <(String, String)>[
          ('ABUSIVE_LANGUAGE', 'Abusive language'),
          ('HARASSMENT', 'Harassment'),
          ('SPAM', 'Spam'),
          ('FRAUD_OR_SCAM', 'Fraud or scam'),
          (
            'SEXUAL_OR_INAPPROPRIATE_CONTENT',
            'Sexual or inappropriate content',
          ),
          ('HATE_OR_THREATS', 'Hate or threats'),
          ('OFF_PLATFORM_PAYMENT', 'Off-platform payment request'),
          ('IMPERSONATION', 'Impersonation'),
          ('OTHER', 'Other'),
        ];

        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Text(
                  'Why are you reporting this user?',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              for (final item in reasons)
                ListTile(
                  title: Text(item.$2),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.of(sheetContext).pop(item.$1),
                ),
            ],
          ),
        );
      },
    );

    if (reason == null || !mounted) {
      return;
    }

    final detailsController = TextEditingController();

    try {
      final details = await showDialog<String?>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Report details'),
            content: TextField(
              controller: detailsController,
              minLines: 3,
              maxLines: 5,
              maxLength: 1000,
              decoration: const InputDecoration(
                hintText: 'Add any additional details (optional)',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(
                  dialogContext,
                ).pop(detailsController.text.trim()),
                child: const Text('Submit report'),
              ),
            ],
          );
        },
      );

      if (details == null || !mounted) {
        return;
      }

      setState(() {
        _isSafetyActionRunning = true;
      });

      try {
        await _chatApi.reportUser(
          reportedUserId: participant.id,
          reason: reason,
          details: details,
          callSessionId: widget.consultationId,
        );

        if (!mounted) {
          return;
        }

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Report submitted. Our moderation team will review it.',
            ),
          ),
        );
      } on ChatApiException catch (error) {
        if (!mounted) {
          return;
        }

        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      } finally {
        if (mounted) {
          setState(() {
            _isSafetyActionRunning = false;
          });
        }
      }
    } finally {
      detailsController.dispose();
    }
  }

  Future<void> _showCustomerConsultationContext() async {
    if (!mounted || !_currentUserIsAstrologer) {
      return;
    }

    final room = _room;

    if (room == null) {
      return;
    }

    final customer = room.customer;
    final contextData = customer.context;

    String value(String key) {
      final raw = contextData[key];

      if (raw == null) {
        return 'Not provided';
      }

      final text = raw.toString().trim();

      if (text.isEmpty || text.toLowerCase() == 'null') {
        return 'Not provided';
      }

      return text;
    }

    String formattedDate() {
      final raw = contextData['dateOfBirth'];

      if (raw == null) {
        return 'Not provided';
      }

      final date = DateTime.tryParse(raw.toString());

      if (date == null) {
        return raw.toString();
      }

      return '${date.day.toString().padLeft(2, '0')}/'
          '${date.month.toString().padLeft(2, '0')}/'
          '${date.year}';
    }

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        Widget row(String label, String content) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 105,
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Expanded(child: Text(content)),
              ],
            ),
          );
        }

        return AlertDialog(
          title: Text(
            customer.name.trim().isNotEmpty
                ? '${customer.name.trim()} - Birth details'
                : 'Customer birth details',
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                row('Date of Birth', formattedDate()),
                row('Time of Birth', value('timeOfBirth')),
                row('Birth Place', value('birthPlace')),
                row('Gender', value('gender')),
                row('Marital Status', value('maritalStatus')),
                row('Occupation', value('occupation')),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
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

    final header = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 19,
          backgroundColor: AppColors.gold.withValues(alpha: 0.14),
          backgroundImage: avatarUrl.isNotEmpty
              ? NetworkImage(avatarUrl)
              : null,
          child: avatarUrl.isEmpty
              ? const Icon(Icons.person_rounded, color: AppColors.gold)
              : null,
        ),
        const SizedBox(width: 9),
        Flexible(
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
                  room.astrologer.expertise.take(2).join(' | '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              Wrap(
                spacing: 4,
                runSpacing: 1,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (!_currentUserIsAstrologer &&
                      room.astrologer.rating != null) ...[
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
                        ' (${room.astrologer.totalReviews})',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 9.5,
                        ),
                      ),
                    const SizedBox(width: 6),
                  ],
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
        ),
      ],
    );

    if (!_currentUserIsAstrologer) {
      return header;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: _showCustomerConsultationContext,
      child: header,
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
        backgroundColor: const Color(0xFF0B141A),
        appBar: AppBar(
          backgroundColor: const Color(0xFF202C33),
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          titleSpacing: 0,
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(child: _buildChatParticipantHeader()),
              const SizedBox(width: 12),
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
            PopupMenuButton<String>(
              tooltip: 'Safety options',
              enabled: !_isSafetyActionRunning && _otherParticipant != null,
              icon: _isSafetyActionRunning
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.more_vert_rounded),
              onSelected: _handleSafetyMenuAction,
              itemBuilder: (context) {
                final blockedByMe = _safetyStatus?.blockedByMe == true;

                return [
                  const PopupMenuItem<String>(
                    value: 'REPORT',
                    child: ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.flag_outlined),
                      title: Text('Report'),
                    ),
                  ),
                  PopupMenuItem<String>(
                    value: blockedByMe ? 'UNBLOCK' : 'BLOCK',
                    child: ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        blockedByMe
                            ? Icons.lock_open_rounded
                            : Icons.block_rounded,
                      ),
                      title: Text(blockedByMe ? 'Unblock' : 'Block'),
                    ),
                  ),
                ];
              },
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
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 10,
                            ),
                            keyboardDismissBehavior:
                                ScrollViewKeyboardDismissBehavior.onDrag,
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
                    enabled: _chatIsActive && _safetyAllowsMessaging,
                    isSending:
                        _isSending ||
                        _isUploading ||
                        _isRecordingVoice ||
                        _isSendingVoice,
                    onSend: _sendMessage,
                    onAttach: _showAttachmentPicker,
                    onCamera: () =>
                        _pickAndSendImage(source: ImageSource.camera),
                    onSticker: _sendStickerAsset,
                    isRecordingVoice: _isRecordingVoice,
                    isSendingVoice: _isSendingVoice,
                    voiceRecordingLabel: _formatVoiceDuration(
                      _voiceRecordingMs,
                    ),
                    onVoiceStart: _startVoiceRecording,
                    onVoiceCancel: _cancelVoiceRecording,
                    onVoiceSend: _sendVoiceRecording,
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
      _effectiveExpiresAt = expiresAt;
      _remainingSeconds = expiresAt
          .toUtc()
          .difference(DateTime.now().toUtc())
          .inSeconds;

      if (_remainingSeconds < 0) {
        _remainingSeconds = 0;
      }

      _error = '';
    });

    // Keep the realtime expiresAt visible immediately.
    //
    // Wait for authoritative room refresh before restarting
    // room-based timers. This prevents the previous expiresAt
    // from overwriting the newly extended +5/+10 timer.
    unawaited(
      _refreshMessages().whenComplete(() {
        if (!mounted) {
          return;
        }

        _startTimers();
      }),
    );

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
    _voiceRecordingTimer?.cancel();
    unawaited(_voiceRecorder.dispose());

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

    unawaited(_maybeShowRatingPrompt());
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
      final updatedConsultation = await _consultationApi.extendConsultation(
        consultationId: widget.consultationId,
        additionalMinutes: minutes,
      );

      final authoritativeExpiresAt = updatedConsultation.expiresAt;

      if (authoritativeExpiresAt != null && mounted) {
        _clockTimer?.cancel();

        setState(() {
          _consultationEnded = false;
          _effectiveExpiresAt = authoritativeExpiresAt;
          _remainingSeconds = authoritativeExpiresAt
              .toUtc()
              .difference(DateTime.now().toUtc())
              .inSeconds;

          if (_remainingSeconds < 0) {
            _remainingSeconds = 0;
          }

          _error = '';
        });

        debugPrint(
          '[EXTEND_TIMER] backend expiresAt=$authoritativeExpiresAt remaining=$_remainingSeconds',
        );
      }

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

      await _maybeShowRatingPrompt();
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

      await _maybeShowRatingPrompt();
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

  Future<void> _maybeShowRatingPrompt() async {
    if (!mounted ||
        _ratingPromptShown ||
        _isSubmittingRating ||
        _currentUserIsAstrologer) {
      return;
    }

    _ratingPromptShown = true;

    final room = _room;
    final astrologerName = room?.astrologer.name.trim().isNotEmpty == true
        ? room!.astrologer.name.trim()
        : 'your astrologer';

    final commentController = TextEditingController();
    var selectedRating = 0;

    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: const Text('Rate your consultation'),
                content: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('How was your consultation with $astrologerName?'),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          final value = index + 1;
                          final selected = value <= selectedRating;

                          return IconButton(
                            tooltip: '$value star${value == 1 ? '' : 's'}',
                            onPressed: _isSubmittingRating
                                ? null
                                : () {
                                    setDialogState(() {
                                      selectedRating = value;
                                    });
                                  },
                            icon: Icon(
                              selected
                                  ? Icons.star_rounded
                                  : Icons.star_border_rounded,
                              color: AppColors.gold,
                              size: 34,
                            ),
                          );
                        }),
                      ),
                      if (selectedRating == 0)
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: Text(
                            'Select a star rating to submit.',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: commentController,
                        enabled: !_isSubmittingRating,
                        minLines: 3,
                        maxLines: 5,
                        maxLength: 1000,
                        decoration: const InputDecoration(
                          labelText: 'Review (optional)',
                          hintText: 'Share your experience',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ],
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: _isSubmittingRating
                        ? null
                        : () {
                            Navigator.of(dialogContext).pop();
                          },
                    child: const Text('Skip for now'),
                  ),
                  FilledButton(
                    onPressed: _isSubmittingRating || selectedRating == 0
                        ? null
                        : () async {
                            setDialogState(() {
                              _isSubmittingRating = true;
                            });

                            try {
                              await _consultationApi.rateConsultation(
                                consultationId: widget.consultationId,
                                rating: selectedRating,
                                comment: commentController.text.trim(),
                              );

                              if (!mounted || !dialogContext.mounted) {
                                return;
                              }

                              Navigator.of(dialogContext).pop();

                              ScaffoldMessenger.of(context)
                                ..clearSnackBars()
                                ..showSnackBar(
                                  const SnackBar(
                                    content: Text('Thank you for your rating.'),
                                  ),
                                );
                            } on ConsultationApiException catch (error) {
                              if (!mounted || !dialogContext.mounted) {
                                return;
                              }

                              setDialogState(() {
                                _isSubmittingRating = false;
                              });

                              ScaffoldMessenger.of(context)
                                ..clearSnackBars()
                                ..showSnackBar(
                                  SnackBar(content: Text(error.message)),
                                );
                            }
                          },
                    child: _isSubmittingRating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Submit'),
                  ),
                ],
              );
            },
          );
        },
      );
    } finally {
      commentController.dispose();

      if (mounted && _isSubmittingRating) {
        setState(() {
          _isSubmittingRating = false;
        });
      }
    }
  }

  Future<void> _connectRealtime() async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    debugPrint(
      '[REALTIME_AUTH] sessionPresent=${session != null} '
      'tokenPresent=${token.isNotEmpty} '
      'mounted=$mounted '
      'consultation=${widget.consultationId}',
    );

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

  Future<void> _handleSocketMessage(dynamic data) async {
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

    var incoming = ChatMessage.fromJson(messageSource);

    incoming = await _decryptSecureMessage(incoming);

    if (!mounted) {
      return;
    }
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
        _otherParticipantOnline = true;
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

    debugPrint(
      '[PRESENCE_RAW] '
      'consultation=${widget.consultationId} '
      'room=${_room?.roomId} '
      'current=${_room?.currentUser.id} '
      'data=$data',
    );

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

    final room = _room;

    if (room == null || currentUserId.isEmpty) {
      return;
    }

    final expectedParticipantId = currentUserId == room.astrologer.id.trim()
        ? room.customer.id.trim()
        : room.astrologer.id.trim();

    // Presence must belong only to the actual opposite participant.
    // Ignore stale/system/unrelated room socket events.
    if (userId.isEmpty ||
        expectedParticipantId.isEmpty ||
        userId != expectedParticipantId) {
      debugPrint(
        '[PRESENCE_TRACE] IGNORED '
        'payloadUser=$userId '
        'expected=$expectedParticipantId '
        'current=$currentUserId',
      );
      return;
    }

    debugPrint(
      '[PRESENCE_TRACE] ACCEPTED '
      'payloadUser=$userId '
      'expected=$expectedParticipantId '
      'current=$currentUserId '
      'payload=$payload',
    );

    final onlineValue =
        payload['isOnline'] ?? payload['online'] ?? payload['connected'];

    final online =
        onlineValue == true ||
        onlineValue?.toString().trim().toLowerCase() == 'true' ||
        onlineValue?.toString().trim().toLowerCase() == 'online' ||
        onlineValue?.toString().trim() == '1';
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
    _voiceRecordingTimer?.cancel();
    unawaited(_voiceRecorder.dispose());

    setState(() {
      _otherParticipantOnline = true;
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
    _voiceRecordingTimer?.cancel();
    unawaited(_voiceRecorder.dispose());

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

        // Customer requests completion when local timer reaches zero.
        // Astrologer follows the authoritative backend/socket end event.
        if (!_currentUserIsAstrologer) {
          unawaited(_autoEndConsultation());
        } else {
          unawaited(_refreshMessages());
        }
      }
    });
  }

  int _calculateRemaining(ChatRoom room) {
    final expiresAt = _effectiveExpiresAt ?? room.expiresAt;

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

  Future<ChatMessage> _decryptSecureMessage(ChatMessage message) async {
    final type = message.messageType.trim().toUpperCase();

    if (type == 'SYSTEM') {
      return message;
    }

    final encryptedContent = message.encryptedContent?.trim() ?? '';
    final nonce = message.encryptionNonce?.trim() ?? '';
    final mac = message.encryptionMac?.trim() ?? '';
    final version = message.encryptionVersion;

    if (encryptedContent.isEmpty ||
        nonce.isEmpty ||
        mac.isEmpty ||
        version == null) {
      return message;
    }

    try {
      final clearText = await _e2eeCrypto.decryptText(
        callSessionId: widget.consultationId,
        encryptedContent: encryptedContent,
        nonce: nonce,
        mac: mac,
        version: version,
      );

      return message.copyWith(content: clearText);
    } catch (_) {
      return message.copyWith(content: 'Unable to decrypt this secure message');
    }
  }

  Future<List<ChatMessage>> _decryptSecureMessages(
    List<ChatMessage> messages,
  ) async {
    final decrypted = <ChatMessage>[];

    for (final message in messages) {
      decrypted.add(await _decryptSecureMessage(message));
    }

    return List<ChatMessage>.unmodifiable(decrypted);
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
      final rawHistory = await _chatApi.getChatHistory(widget.consultationId);

      final decryptedMessages = await _decryptSecureMessages(
        rawHistory.messages,
      );

      final history = ChatHistory(
        messages: decryptedMessages,
        total: rawHistory.total,
        unreadCount: rawHistory.unreadCount,
      );
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

  String _formatVoiceDuration(int milliseconds) {
    final totalSeconds = (milliseconds / 1000).floor();
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _startVoiceRecording() async {
    if (!_chatIsActive ||
        !_safetyAllowsMessaging ||
        _isSending ||
        _isUploading ||
        _isRecordingVoice) {
      return;
    }

    try {
      final permission = await Permission.microphone.request();

      if (!permission.isGranted) {
        if (mounted) {
          _showAttachmentError(
            'Microphone permission is required to send a voice note.',
          );
        }
        return;
      }

      final recorderPermission = await _voiceRecorder.hasPermission();

      if (!recorderPermission) {
        if (mounted) {
          _showAttachmentError(
            'Microphone access is not available. Please allow microphone permission and try again.',
          );
        }
        return;
      }

      final directory = await getTemporaryDirectory();

      if (!await directory.exists()) {
        await directory.create(recursive: true);
      }

      final path =
          '${directory.path}${Platform.pathSeparator}'
          'asp_voice_${DateTime.now().microsecondsSinceEpoch}.m4a';

      final supportsAac = await _voiceRecorder.isEncoderSupported(
        AudioEncoder.aacLc,
      );

      if (!supportsAac) {
        if (mounted) {
          _showAttachmentError(
            'Voice recording is not supported on this device.',
          );
        }
        return;
      }

      await _voiceRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 128000),
        path: path,
      );

      if (!mounted) {
        await _voiceRecorder.cancel();
        return;
      }

      final startedAt = DateTime.now();

      setState(() {
        _isRecordingVoice = true;
        _isSendingVoice = false;
        _voiceRecordingPath = path;
        _voiceRecordingStartedAt = startedAt;
        _voiceRecordingMs = 0;
        _error = '';
      });

      _voiceRecordingTimer?.cancel();

      _voiceRecordingTimer = Timer.periodic(const Duration(milliseconds: 250), (
        _,
      ) {
        if (!mounted || !_isRecordingVoice) {
          return;
        }

        final started = _voiceRecordingStartedAt;

        if (started == null) {
          return;
        }

        final elapsed = DateTime.now().difference(started).inMilliseconds;

        final safeElapsed = elapsed.clamp(0, 10 * 60 * 1000);

        setState(() {
          _voiceRecordingMs = safeElapsed;
        });

        if (elapsed >= 10 * 60 * 1000) {
          _voiceRecordingTimer?.cancel();
          unawaited(_sendVoiceRecording());
        }
      });
    } catch (error, stackTrace) {
      debugPrint('[VOICE_RECORD_START_ERROR] ${error.runtimeType}: $error');
      debugPrintStack(
        label: '[VOICE_RECORD_START_STACK]',
        stackTrace: stackTrace,
      );

      if (mounted) {
        _showAttachmentError(
          'Unable to start voice recording. Please check microphone access and try again.',
        );
      }
    }
  }

  Future<void> _cancelVoiceRecording() async {
    if (!_isRecordingVoice) {
      return;
    }

    _voiceRecordingTimer?.cancel();
    _voiceRecordingTimer = null;

    final localPath = _voiceRecordingPath;

    try {
      await _voiceRecorder.cancel();
    } catch (_) {
      // Best-effort recorder cleanup.
    }

    if (localPath != null && localPath.trim().isNotEmpty) {
      try {
        final file = File(localPath);

        if (await file.exists()) {
          await file.delete();
        }
      } catch (_) {
        // Temporary-file cleanup must not block the UI.
      }
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _isRecordingVoice = false;
      _isSendingVoice = false;
      _voiceRecordingMs = 0;
      _voiceRecordingPath = null;
      _voiceRecordingStartedAt = null;
    });
  }

  Future<String> _requireMediaCallSessionId() async {
    var room = _room;
    var callSessionId = room?.roomId.trim() ?? '';

    if (callSessionId.isEmpty) {
      room = await _chatApi.joinChat(widget.consultationId);
      callSessionId = room.roomId.trim();

      if (mounted) {
        setState(() {
          _room = room;
        });
      }
    }

    if (callSessionId.isEmpty) {
      throw const ChatApiException(
        'The backend returned an invalid chat session.',
      );
    }

    return callSessionId;
  }

  Future<void> _sendVoiceRecording() async {
    if (!_isRecordingVoice ||
        _isSendingVoice ||
        !_chatIsActive ||
        !_safetyAllowsMessaging) {
      return;
    }

    _voiceRecordingTimer?.cancel();
    _voiceRecordingTimer = null;

    final startedAt = _voiceRecordingStartedAt;

    final measuredDuration = startedAt == null
        ? _voiceRecordingMs
        : DateTime.now().difference(startedAt).inMilliseconds;

    final audioDurationMs = measuredDuration.clamp(1, 10 * 60 * 1000);

    String? recordedPath;

    try {
      setState(() {
        _isSendingVoice = true;
      });

      recordedPath = await _voiceRecorder.stop();

      final normalizedPath = recordedPath?.trim().isNotEmpty == true
          ? recordedPath!.trim()
          : _voiceRecordingPath?.trim() ?? '';

      if (normalizedPath.isEmpty) {
        throw const ChatUploadException(
          'Voice recording file was not created.',
        );
      }

      if (audioDurationMs < 300) {
        throw const ChatUploadException('Voice note is too short.');
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _isRecordingVoice = false;
        _isUploading = true;
        _uploadProgress = 0;
        _error = '';
      });

      final mediaCallSessionId = await _requireMediaCallSessionId();
      final upload = await _chatUploadApi.uploadAudio(
        callSessionId: mediaCallSessionId,
        filePath: normalizedPath,
        audioDurationMs: audioDurationMs,
        onProgress: (progress) {
          if (!mounted) {
            return;
          }

          setState(() {
            _uploadProgress = progress.clamp(0.0, 1.0);
          });
        },
      );

      final message = await _chatApi.sendAttachmentMessage(
        callSessionId: mediaCallSessionId,
        messageType: 'AUDIO',
        attachmentUrl: upload.url,
        attachmentPath: upload.path,
        attachmentName: upload.fileName,
        attachmentMimeType: upload.mimeType,
        attachmentSize: upload.size,
        audioDurationMs: audioDurationMs,
        clientMessageId:
            'flutter-voice-${DateTime.now().microsecondsSinceEpoch}',
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _messages = _mergeMessage(_messages, message);
      });

      _scrollToBottom();
    } on ChatUploadException catch (error) {
      if (mounted) {
        _showAttachmentError(error.message);
      }
    } on ChatApiException catch (error) {
      if (mounted) {
        _showAttachmentError(error.message);
      }
    } catch (_) {
      if (mounted) {
        _showAttachmentError('Unable to send voice note. Please try again.');
      }
    } finally {
      final cleanupPath = recordedPath?.trim().isNotEmpty == true
          ? recordedPath!.trim()
          : _voiceRecordingPath?.trim() ?? '';

      if (cleanupPath.isNotEmpty) {
        try {
          final file = File(cleanupPath);

          if (await file.exists()) {
            await file.delete();
          }
        } catch (_) {
          // Ignore temporary-file cleanup errors.
        }
      }

      if (mounted) {
        setState(() {
          _isRecordingVoice = false;
          _isSendingVoice = false;
          _isUploading = false;
          _uploadProgress = 0;
          _voiceRecordingMs = 0;
          _voiceRecordingPath = null;
          _voiceRecordingStartedAt = null;
        });
      }
    }
  }

  Future<void> _sendStickerAsset(String assetPath, String stickerName) async {
    if (_isUploading || !_chatIsActive) {
      return;
    }

    setState(() {
      _isUploading = true;
      _uploadProgress = 0;
      _error = '';
    });

    File? tempFile;

    try {
      final mediaCallSessionId = await _requireMediaCallSessionId();

      final byteData = await rootBundle.load(assetPath);
      final bytes = byteData.buffer.asUint8List();

      final tempDirectory = await getTemporaryDirectory();

      final safeName = stickerName
          .toLowerCase()
          .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
          .replaceAll(RegExp(r'^_+|_+$'), '');

      tempFile = File(
        '${tempDirectory.path}/asp_sticker_${safeName}_${DateTime.now().microsecondsSinceEpoch}.png',
      );

      await tempFile.writeAsBytes(bytes, flush: true);

      final upload = await _chatUploadApi.uploadImage(
        callSessionId: mediaCallSessionId,
        filePath: tempFile.path,
      );

      final message = await _chatApi.sendAttachmentMessage(
        callSessionId: mediaCallSessionId,
        messageType: 'STICKER',
        attachmentUrl: upload.url,
        attachmentPath: upload.path,
        attachmentName: upload.fileName,
        attachmentMimeType: upload.mimeType,
        attachmentSize: upload.size,
        clientMessageId:
            'flutter-sticker-${DateTime.now().microsecondsSinceEpoch}',
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _messages = _mergeMessage(_messages, message);
      });

      _scrollToBottom();
    } on ChatUploadException catch (error) {
      _showAttachmentError(error.message);
    } on ChatApiException catch (error) {
      _showAttachmentError(error.message);
    } catch (_) {
      _showAttachmentError('Unable to send sticker. Please try again.');
    } finally {
      if (tempFile != null) {
        try {
          if (await tempFile.exists()) {
            await tempFile.delete();
          }
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 0;
        });
      }
    }
  }

  Future<void> _showAttachmentPicker() async {
    if (!_chatIsActive || _isSending || _isUploading) {
      return;
    }

    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Send attachment',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),

                ListTile(
                  leading: const Icon(
                    Icons.photo_library_outlined,
                    color: AppColors.gold,
                  ),
                  title: const Text(
                    'Photo',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: const Text(
                    'Choose from gallery - Max 10 MB',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  onTap: () {
                    Navigator.of(sheetContext).pop('GALLERY');
                  },
                ),

                ListTile(
                  leading: const Icon(
                    Icons.camera_alt_outlined,
                    color: AppColors.gold,
                  ),
                  title: const Text(
                    'Camera',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: const Text(
                    'Take a new photo - Max 10 MB',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  onTap: () {
                    Navigator.of(sheetContext).pop('CAMERA');
                  },
                ),

                ListTile(
                  leading: const Icon(
                    Icons.attach_file_rounded,
                    color: AppColors.gold,
                  ),
                  title: const Text(
                    'File',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: const Text(
                    'PDF, ZIP, DOC, XLS, TXT or audio - Max 20 MB',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  onTap: () {
                    Navigator.of(sheetContext).pop('FILE');
                  },
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

    switch (choice) {
      case 'GALLERY':
        await _pickAndSendImage(source: ImageSource.gallery);
        break;

      case 'CAMERA':
        await _pickAndSendImage(source: ImageSource.camera);
        break;

      case 'FILE':
        await _pickAndSendFile();
        break;
    }
  }

  Future<void> _pickAndSendImage({required ImageSource source}) async {
    try {
      final picker = ImagePicker();

      final image = await picker.pickImage(source: source, imageQuality: 90);

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
      final action = source == ImageSource.camera
          ? 'capture photo'
          : 'select image';

      _showAttachmentError(
        'Unable to $action. Please check permission and try again.',
      );
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
      _uploadProgress = 0;
      _error = '';
    });

    try {
      final mediaCallSessionId = await _requireMediaCallSessionId();
      final upload = isImage
          ? await _chatUploadApi.uploadImage(
              callSessionId: mediaCallSessionId,
              filePath: filePath,
              caption: caption.isEmpty ? null : caption,
            )
          : await _chatUploadApi.uploadFile(
              callSessionId: mediaCallSessionId,
              filePath: filePath,
              caption: caption.isEmpty ? null : caption,
              onProgress: (progress) {
                if (!mounted) {
                  return;
                }

                final safeProgress = progress.clamp(0.0, 1.0);

                setState(() {
                  _uploadProgress = safeProgress;
                });

                final messenger = ScaffoldMessenger.maybeOf(context);

                messenger
                  ?..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      duration: const Duration(hours: 1),
                      content: Row(
                        children: [
                          Expanded(
                            child: LinearProgressIndicator(
                              value: _uploadProgress,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text('${(safeProgress * 100).round()}%'),
                        ],
                      ),
                    ),
                  );
              },
            );

      final message = await _chatApi.sendAttachmentMessage(
        callSessionId: mediaCallSessionId,
        messageType: upload.type,
        attachmentUrl: upload.url,
        attachmentPath: upload.path,
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
        ScaffoldMessenger.maybeOf(context)?.hideCurrentSnackBar();

        setState(() {
          _isUploading = false;
          _uploadProgress = 0;
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
      final encrypted = await _e2eeCrypto.encryptText(
        callSessionId: widget.consultationId,
        plaintext: content,
      );

      final encryptedMessage = await _chatApi.sendEncryptedTextMessage(
        callSessionId: widget.consultationId,
        encryptedContent: encrypted.encryptedContent,
        encryptionNonce: encrypted.nonce,
        encryptionMac: encrypted.mac,
        encryptionVersion: encrypted.version,
        clientMessageId: clientMessageId,
        replyToMessageId: replyingTo?.id,
      );

      final message = await _decryptSecureMessage(encryptedMessage);

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
      // Retry uses a fresh AES-GCM nonce.
      final encrypted = await _e2eeCrypto.encryptText(
        callSessionId: widget.consultationId,
        plaintext: content,
      );

      final encryptedMessage = await _chatApi.sendEncryptedTextMessage(
        callSessionId: widget.consultationId,
        encryptedContent: encrypted.encryptedContent,
        encryptionNonce: encrypted.nonce,
        encryptionMac: encrypted.mac,
        encryptionVersion: encrypted.version,
        clientMessageId: clientMessageId,
        replyToMessageId: failedMessage.replyToMessageId,
      );

      final message = await _decryptSecureMessage(encryptedMessage);

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
    final incomingId = incoming.id.trim();
    final incomingClientMessageId = incoming.clientMessageId.trim();

    final merged = <ChatMessage>[];
    var incomingMerged = false;

    for (final existing in current) {
      final existingId = existing.id.trim();
      final existingClientMessageId = existing.clientMessageId.trim();

      final sameServerMessage =
          incomingId.isNotEmpty &&
          existingId.isNotEmpty &&
          incomingId == existingId;

      final sameClientMessage =
          incomingClientMessageId.isNotEmpty &&
          existingClientMessageId.isNotEmpty &&
          incomingClientMessageId == existingClientMessageId;

      if (sameServerMessage || sameClientMessage) {
        if (!incomingMerged) {
          merged.add(incoming);
          incomingMerged = true;
        }
        continue;
      }

      merged.add(existing);
    }

    if (!incomingMerged) {
      merged.add(incoming);
    }

    merged.sort((first, second) {
      final firstDate =
          first.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final secondDate =
          second.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);

      return firstDate.compareTo(secondDate);
    });

    return List<ChatMessage>.unmodifiable(merged);
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
    final isSticker = messageType == 'STICKER';
    final isFile = messageType == 'FILE';
    final isAudio = messageType == 'AUDIO';

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
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width < 420
              ? MediaQuery.sizeOf(context).width * 0.78
              : 340,
        ),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0xFF005C4B) : const Color(0xFF202C33),
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
            if ((isImage || isSticker) && attachmentUrl.isNotEmpty)
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
            else if ((isImage || isSticker || isFile || isAudio) &&
                attachmentUrl.isEmpty)
              Text(
                '',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontStyle: FontStyle.italic,
                ),
              ),

            if (content.isNotEmpty) ...[
              if (isImage || isFile || isAudio) const SizedBox(height: 8),
              Text(
                content,
                style: TextStyle(color: AppColors.white, fontSize: 15),
              ),
            ] else if (!isImage && !isFile) ...[
              Text('', style: TextStyle(color: AppColors.white, fontSize: 15)),
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
                      color: isMine ? const Color(0xFF8696A0) : AppColors.muted,
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
                            ? const Color(0xFF8696A0)
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
                      color: isMine ? const Color(0xFF8696A0) : AppColors.muted,
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
                        color: const Color(0xFF8696A0),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Sending...',
                      style: TextStyle(
                        color: const Color(0xFF8696A0),
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
                          ? const Color(0xFF53BDEB)
                          : const Color(0xFF8696A0),
                    ),
                    const SizedBox(width: 3),
                    Text(
                      message.isRead ? 'Seen' : 'Sent',
                      style: TextStyle(
                        color: message.isRead
                            ? const Color(0xFF53BDEB)
                            : const Color(0xFF8696A0),
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
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = MediaQuery.sizeOf(context).width;

        final availableWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : screenWidth * 0.72;

        final imageWidth = availableWidth.clamp(140.0, 280.0).toDouble();

        final imageHeight = imageWidth * 0.78;

        return GestureDetector(
          onTap: onOpen,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              url,
              width: imageWidth,
              height: imageHeight,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, progress) {
                if (progress == null) {
                  return child;
                }

                return SizedBox(
                  width: imageWidth,
                  height: imageHeight,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              },
              errorBuilder: (context, error, stackTrace) {
                return SizedBox(
                  width: imageWidth,
                  height: imageHeight * 0.65,
                  child: const Center(child: Text('Image unavailable')),
                );
              },
            ),
          ),
        );
      },
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
                    ].join(' | '),
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
        : type == 'AUDIO'
        ? 'Voice note'
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
        : type == 'AUDIO'
        ? 'Voice note'
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

class _StickerChoice {
  const _StickerChoice(this.name, this.assetPath);

  final String name;
  final String assetPath;
}

class _StickerGrid extends StatelessWidget {
  const _StickerGrid({required this.stickers, required this.onSelected});

  final List<_StickerChoice> stickers;
  final Future<void> Function(String assetPath, String stickerName) onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
      ),
      itemCount: stickers.length,
      itemBuilder: (context, index) {
        final sticker = stickers[index];

        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () async {
            await onSelected(sticker.assetPath, sticker.name);
          },
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFF202C33),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Image.asset(sticker.assetPath, fit: BoxFit.contain),
          ),
        );
      },
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
    required this.onCamera,
    required this.onSticker,
    required this.isRecordingVoice,
    required this.isSendingVoice,
    required this.voiceRecordingLabel,
    required this.onVoiceStart,
    required this.onVoiceCancel,
    required this.onVoiceSend,
    required this.onTyping,
    required this.replyingTo,
    required this.onCancelReply,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool isSending;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final VoidCallback onCamera;
  final Future<void> Function(String assetPath, String stickerName) onSticker;
  final bool isRecordingVoice;
  final bool isSendingVoice;
  final String voiceRecordingLabel;
  final Future<void> Function() onVoiceStart;
  final Future<void> Function() onVoiceCancel;
  final Future<void> Function() onVoiceSend;
  final ValueChanged<String> onTyping;
  final ChatMessage? replyingTo;
  final VoidCallback onCancelReply;

  @override
  State<_MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<_MessageComposer> {
  final FocusNode _focusNode = FocusNode();

  bool showEmoji = false;
  bool showSticker = false;

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  void _toggleStickerPicker() {
    if (!widget.enabled) {
      return;
    }

    _focusNode.unfocus();

    setState(() {
      showSticker = !showSticker;
      showEmoji = false;
    });
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
    if (showSticker) {
      setState(() {
        showSticker = false;
      });
    }
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

  Widget _buildVoiceRecordingBar() {
    final actionsEnabled = widget.enabled && !widget.isSendingVoice;

    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Cancel voice note',
            visualDensity: VisualDensity.compact,
            onPressed: actionsEnabled
                ? () {
                    widget.onVoiceCancel();
                  }
                : null,
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: Colors.redAccent,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Icons.fiber_manual_record_rounded,
            size: 14,
            color: Colors.redAccent,
          ),
          const SizedBox(width: 8),
          Text(
            widget.voiceRecordingLabel,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w600,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                minHeight: 3,
                value: null,
                backgroundColor: AppColors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          const SizedBox(width: 6),
          IconButton(
            tooltip: 'Send voice note',
            visualDensity: VisualDensity.compact,
            onPressed: actionsEnabled
                ? () {
                    widget.onVoiceSend();
                  }
                : null,
            icon: widget.isSendingVoice
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded, color: AppColors.gold),
          ),
        ],
      ),
    );
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
          child: widget.isRecordingVoice
              ? _buildVoiceRecordingBar()
              : Row(
                  children: [
                    IconButton(
                      tooltip: showEmoji ? 'Show keyboard' : 'Emoji',
                      onPressed: widget.enabled ? _toggleEmojiPicker : null,
                      icon: Icon(
                        showEmoji
                            ? Icons.keyboard_alt_outlined
                            : Icons.emoji_emotions_outlined,
                        color: widget.enabled
                            ? const Color(0xFF8696A0)
                            : AppColors.muted,
                      ),
                    ),
                    IconButton(
                      tooltip: showSticker ? 'Close stickers' : 'Stickers',
                      visualDensity: VisualDensity.compact,
                      onPressed: widget.enabled && !widget.isSending
                          ? _toggleStickerPicker
                          : null,
                      icon: Icon(
                        showSticker
                            ? Icons.keyboard_alt_outlined
                            : Icons.sticky_note_2_outlined,
                        color: widget.enabled
                            ? const Color(0xFF8696A0)
                            : AppColors.muted,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Camera',
                      visualDensity: VisualDensity.compact,
                      onPressed: widget.enabled && !widget.isSending
                          ? widget.onCamera
                          : null,
                      icon: Icon(
                        Icons.camera_alt_outlined,
                        color: widget.enabled
                            ? const Color(0xFF8696A0)
                            : AppColors.muted,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Attach',
                      visualDensity: VisualDensity.compact,
                      onPressed: widget.enabled && !widget.isSending
                          ? widget.onAttach
                          : null,
                      icon: Icon(
                        Icons.attach_file_rounded,
                        color: widget.enabled
                            ? const Color(0xFF8696A0)
                            : AppColors.muted,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Voice note',
                      visualDensity: VisualDensity.compact,
                      onPressed: widget.enabled && !widget.isSending
                          ? () async {
                              _focusNode.unfocus();

                              if (showSticker) {
                                setState(() {
                                  showSticker = false;
                                });
                              }

                              if (showEmoji) {
                                setState(() {
                                  showEmoji = false;
                                });
                              }

                              await widget.onVoiceStart();
                            }
                          : null,
                      icon: Icon(
                        Icons.mic_none_rounded,
                        color: widget.enabled
                            ? const Color(0xFF8696A0)
                            : AppColors.muted,
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
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Message',
                          hintStyle: const TextStyle(
                            color: Color(0xFF8696A0),
                            fontSize: 15,
                          ),
                          filled: true,
                          fillColor: const Color(0xFF202C33),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    Container(
                      margin: const EdgeInsets.only(left: 6, right: 4),
                      decoration: const BoxDecoration(
                        color: Color(0xFF00A884),
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        onPressed: widget.enabled && !widget.isSending
                            ? _handleSend
                            : null,
                        icon: widget.isSending
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(
                                Icons.send_rounded,
                                color: Colors.white,
                              ),
                      ),
                    ),
                  ],
                ),
        ),

        // ASP_STICKER_PANEL
        if (showSticker && widget.enabled)
          Container(
            height: (MediaQuery.sizeOf(context).height * 0.36)
                .clamp(250.0, 360.0)
                .toDouble(),
            color: const Color(0xFF111B21),
            child: DefaultTabController(
              length: 2,
              child: Column(
                children: [
                  const TabBar(
                    indicatorColor: Color(0xFF00A884),
                    labelColor: Color(0xFF00A884),
                    unselectedLabelColor: Color(0xFF8696A0),
                    tabs: [
                      Tab(text: 'International'),
                      Tab(text: 'Astro Soul Path'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      children: [
                        _StickerGrid(
                          stickers: const [
                            _StickerChoice(
                              'Hello',
                              'assets/stickers/hello.png',
                            ),
                            _StickerChoice(
                              'Thank You',
                              'assets/stickers/thank_you.png',
                            ),
                            _StickerChoice('Love', 'assets/stickers/love.png'),
                            _StickerChoice(
                              'Congrats',
                              'assets/stickers/congrats.png',
                            ),
                            _StickerChoice(
                              'Good Morning',
                              'assets/stickers/good_morning.png',
                            ),
                            _StickerChoice(
                              'Good Night',
                              'assets/stickers/good_night.png',
                            ),
                            _StickerChoice('LOL', 'assets/stickers/lol.png'),
                            _StickerChoice('Wow', 'assets/stickers/wow.png'),
                          ],
                          onSelected: widget.onSticker,
                        ),
                        _StickerGrid(
                          stickers: const [
                            _StickerChoice(
                              'Namaste',
                              'assets/stickers/namaste.png',
                            ),
                            _StickerChoice(
                              'Blessings',
                              'assets/stickers/blessings.png',
                            ),
                            _StickerChoice('Om', 'assets/stickers/om.png'),
                            _StickerChoice(
                              'Trust the Universe',
                              'assets/stickers/universe.png',
                            ),
                            _StickerChoice(
                              'Stay Positive',
                              'assets/stickers/positive.png',
                            ),
                            _StickerChoice(
                              'Jai Shree Ram',
                              'assets/stickers/jai_shree_ram.png',
                            ),
                            _StickerChoice(
                              'Zodiac Energy',
                              'assets/stickers/zodiac.png',
                            ),
                            _StickerChoice(
                              'Astro Soul Path',
                              'assets/stickers/astro_soul.png',
                            ),
                          ],
                          onSelected: widget.onSticker,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (showEmoji && widget.enabled)
          SizedBox(
            height: (MediaQuery.sizeOf(context).height * 0.32)
                .clamp(220.0, 320.0)
                .toDouble(),
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

class _VoiceNoteBubble extends StatefulWidget {
  const _VoiceNoteBubble({
    required this.url,
    required this.durationMs,
    required this.isMine,
  });

  final String url;
  final int? durationMs;
  final bool isMine;

  @override
  State<_VoiceNoteBubble> createState() => _VoiceNoteBubbleState();
}

class _VoiceNoteBubbleState extends State<_VoiceNoteBubble> {
  final AudioPlayer _player = AudioPlayer();

  StreamSubscription<PlayerState>? _stateSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  bool _loading = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();

    final providedMs = widget.durationMs ?? 0;

    if (providedMs > 0) {
      _duration = Duration(milliseconds: providedMs);
    }

    _stateSubscription = _player.playerStateStream.listen((state) {
      if (!mounted) {
        return;
      }

      if (state.processingState == ProcessingState.completed) {
        unawaited(_player.seek(Duration.zero));
        unawaited(_player.pause());

        setState(() {
          _position = Duration.zero;
          _loading = false;
        });

        return;
      }

      setState(() {
        _loading =
            state.processingState == ProcessingState.loading ||
            state.processingState == ProcessingState.buffering;
      });
    });

    _positionSubscription = _player.positionStream.listen((position) {
      if (!mounted) {
        return;
      }

      setState(() {
        _position = position;
      });
    });

    _durationSubscription = _player.durationStream.listen((duration) {
      if (!mounted || duration == null) {
        return;
      }

      setState(() {
        _duration = duration;
      });
    });
  }

  @override
  void dispose() {
    _stateSubscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();

    unawaited(_player.dispose());

    super.dispose();
  }

  String _formatDuration(Duration value) {
    final totalSeconds = value.inSeconds.clamp(0, 10 * 60);

    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _togglePlayback() async {
    if (_loading) {
      return;
    }

    final url = widget.url.trim();

    if (url.isEmpty) {
      return;
    }

    try {
      setState(() {
        _failed = false;
      });

      if (_player.playing) {
        await _player.pause();
        return;
      }

      if (_player.audioSource == null) {
        setState(() {
          _loading = true;
        });

        await _player.setUrl(url);
      }

      await _player.play();
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  Future<void> _seek(double value) async {
    final durationMs = _duration.inMilliseconds;

    if (durationMs <= 0) {
      return;
    }

    final safeValue = value.clamp(0.0, 1.0);

    await _player.seek(
      Duration(milliseconds: (durationMs * safeValue).round()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final durationMs = _duration.inMilliseconds;

    final progress = durationMs <= 0
        ? 0.0
        : (_position.inMilliseconds / durationMs).clamp(0.0, 1.0);

    final remaining = _duration > _position
        ? _duration - _position
        : Duration.zero;

    final iconColor = widget.isMine ? AppColors.background : AppColors.gold;

    final secondaryColor = widget.isMine
        ? AppColors.background.withValues(alpha: 0.70)
        : AppColors.muted;

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 220, maxWidth: 285),
      child: Row(
        children: [
          InkWell(
            onTap: _togglePlayback,
            borderRadius: BorderRadius.circular(99),
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.isMine
                    ? AppColors.background.withValues(alpha: 0.12)
                    : AppColors.gold.withValues(alpha: 0.12),
              ),
              alignment: Alignment.center,
              child: _loading
                  ? SizedBox(
                      width: 19,
                      height: 19,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: iconColor,
                      ),
                    )
                  : StreamBuilder<bool>(
                      stream: _player.playingStream,
                      initialData: _player.playing,
                      builder: (context, snapshot) {
                        final playing = snapshot.data ?? false;

                        return Icon(
                          playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: iconColor,
                          size: 28,
                        );
                      },
                    ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapDown: (details) {
                    final box = context.findRenderObject() as RenderBox?;

                    if (box == null || box.size.width <= 0) {
                      return;
                    }

                    final value = details.localPosition.dx / box.size.width;

                    unawaited(_seek(value));
                  },
                  child: SizedBox(
                    height: 24,
                    child: Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        Container(
                          height: 3,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(99),
                            color: secondaryColor.withValues(alpha: 0.28),
                          ),
                        ),
                        FractionallySizedBox(
                          widthFactor: progress,
                          child: Container(
                            height: 3,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(99),
                              color: iconColor,
                            ),
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: List.generate(15, (index) {
                            final played = index / 14 <= progress;

                            return Container(
                              width: 2,
                              height: index.isEven ? 11 : 7,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(99),
                                color: played
                                    ? iconColor
                                    : secondaryColor.withValues(alpha: 0.42),
                              ),
                            );
                          }),
                        ),
                      ],
                    ),
                  ),
                ),
                Row(
                  children: [
                    Icon(Icons.mic_rounded, size: 14, color: secondaryColor),
                    const SizedBox(width: 4),
                    Text(
                      _failed
                          ? 'Tap to retry'
                          : _position > Duration.zero
                          ? _formatDuration(remaining)
                          : _formatDuration(_duration),
                      style: TextStyle(
                        color: _failed ? Colors.redAccent : secondaryColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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
