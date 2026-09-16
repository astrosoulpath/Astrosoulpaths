import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../calling/presentation/screens/audio_call_screen.dart';
import '../../../calling/presentation/screens/video_call_screen.dart';
import '../../../calling/data/video_call_socket_service.dart';
import '../../../calling/data/audio_call_socket_service.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../customer/data/customer_consultation_api.dart';

class CustomerConsultationWaitingScreen extends StatefulWidget {
  const CustomerConsultationWaitingScreen({
    required this.consultationId,
    required this.astrologerUserId,
    required this.astrologerName,
    required this.modeLabel,
    required this.requestExpiresAt,
    super.key,
  });

  final String consultationId;
  final String astrologerUserId;
  final String astrologerName;
  final String modeLabel;
  final DateTime? requestExpiresAt;

  @override
  State<CustomerConsultationWaitingScreen> createState() =>
      _CustomerConsultationWaitingScreenState();
}

class _CustomerConsultationWaitingScreenState
    extends State<CustomerConsultationWaitingScreen> {
  final _api = CustomerConsultationApi();
  final VideoCallSocketService _videoCallSocket = VideoCallSocketService();
  final AudioCallSocketService _audioCallSocket = AudioCallSocketService();
  final AuthSessionStore _sessionStore = AuthSessionStore();

  bool _videoSocketStarted = false;
  bool _audioSocketStarted = false;
  String _callerUserId = '';

  Timer? _pollTimer;
  Timer? _clockTimer;

  String _status = 'PENDING';
  String _error = '';
  bool _checking = false;
  bool _cancelling = false;
  bool _chatOpened = false;

  String _resolvedVideoCallSessionId = '';
  int _secondsLeft = 120;

  @override
  void initState() {
    super.initState();

    _updateCountdown();
    _checkStatus();

    final normalizedMode = widget.modeLabel.toLowerCase();

    if (normalizedMode.contains('video')) {
      unawaited(_startVideoCallSocket());
    } else if (normalizedMode.contains('audio')) {
      unawaited(_startAudioCallSocket());
    }

    _pollTimer = Timer.periodic(
      const Duration(seconds: 2),
      (_) => _checkStatus(),
    );

    _clockTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _updateCountdown(),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    _videoCallSocket.dispose();
    _audioCallSocket.dispose();
    _api.close();
    super.dispose();
  }

  Future<void> _startAudioCallSocket() async {
    if (_audioSocketStarted) {
      return;
    }

    final session = await _sessionStore.read();

    if (!mounted || session == null) {
      return;
    }

    final user = session.user;

    final callerUserId = user['id']?.toString().trim().isNotEmpty == true
        ? user['id'].toString().trim()
        : user['userId']?.toString().trim() ?? '';

    if (callerUserId.isEmpty || widget.astrologerUserId.trim().isEmpty) {
      return;
    }

    _callerUserId = callerUserId;
    _audioSocketStarted = true;

    final callerName = user['name']?.toString().trim().isNotEmpty == true
        ? user['name'].toString().trim()
        : 'Customer';

    _audioCallSocket.connect(
      userId: callerUserId,
      accessToken: session.accessToken,
      onRegistered: () {
        _audioCallSocket.initiate(
          callId: widget.consultationId,
          callerUserId: callerUserId,
          recipientUserId: widget.astrologerUserId,
          callerName: callerName,
        );
      },
      onAccepted: (_) {
        if (mounted) {
          unawaited(_checkStatus());
        }
      },
      onRejected: (payload) {
        if (!mounted) return;

        setState(() {
          _status = 'REJECTED';
          _error =
              payload['reason']?.toString().trim() ??
              'The astrologer declined the audio call.';
        });

        _stopPolling();
      },
      onMissed: (_) {
        if (!mounted) return;

        setState(() {
          _status = 'EXPIRED';
          _error = 'The astrologer did not answer the audio call.';
        });

        _stopPolling();
      },
      onUnavailable: (payload) {
        if (!mounted) return;

        setState(() {
          _error =
              payload['reason']?.toString().trim() ??
              'The astrologer is currently unavailable.';
        });
      },
      onCallError: (payload) {
        if (!mounted) return;

        setState(() {
          _error =
              payload['message']?.toString().trim() ??
              'Unable to connect the audio call.';
        });
      },
    );
  }

  Future<void> _startVideoCallSocket() async {
    if (_videoSocketStarted) {
      return;
    }

    final session = await _sessionStore.read();

    if (!mounted || session == null) {
      return;
    }

    final user = session.user;

    final callerUserId = user['id']?.toString().trim().isNotEmpty == true
        ? user['id'].toString().trim()
        : user['userId']?.toString().trim() ?? '';

    if (callerUserId.isEmpty || widget.astrologerUserId.trim().isEmpty) {
      return;
    }

    _callerUserId = callerUserId;
    _videoSocketStarted = true;

    final callerName = user['name']?.toString().trim().isNotEmpty == true
        ? user['name'].toString().trim()
        : 'Customer';

    _videoCallSocket.connect(
      userId: callerUserId,
      accessToken: session.accessToken,
      onRegistered: () {
        _videoCallSocket.initiate(
          callId: widget.consultationId,
          callerUserId: callerUserId,
          recipientUserId: widget.astrologerUserId,
          callerName: callerName,
        );
      },
      onAccepted: (_) {
        if (mounted) {
          unawaited(_checkStatus());
        }
      },
      onRejected: (payload) {
        if (!mounted) return;

        setState(() {
          _status = 'REJECTED';
          _error =
              payload['reason']?.toString().trim() ??
              'The astrologer declined the video call.';
        });

        _stopPolling();
      },
      onMissed: (_) {
        if (!mounted) return;

        setState(() {
          _status = 'EXPIRED';
          _error = 'The astrologer did not answer the video call.';
        });

        _stopPolling();
      },
      onUnavailable: (payload) {
        if (!mounted) return;

        setState(() {
          _error =
              payload['reason']?.toString().trim() ??
              'The astrologer is currently unavailable.';
        });
      },
      onCallError: (payload) {
        if (!mounted) return;

        setState(() {
          _error =
              payload['message']?.toString().trim() ??
              'Unable to connect the video call.';
        });
      },
    );
  }

  void _updateCountdown() {
    final expiresAt = widget.requestExpiresAt;

    if (expiresAt == null) {
      return;
    }

    final remaining = expiresAt
        .toUtc()
        .difference(DateTime.now().toUtc())
        .inSeconds;

    if (!mounted) {
      return;
    }

    setState(() {
      _secondsLeft = remaining.clamp(0, 7200);
    });
  }

  Future<void> _checkStatus() async {
    if (_checking || _chatOpened) {
      return;
    }

    _checking = true;

    try {
      final response = await _api.getCurrent();

      final data = response['data'];

      if (!mounted) {
        return;
      }

      if (data is! Map) {
        setState(() {
          if (_status == 'PENDING') {
            _status = 'EXPIRED';
          }
        });

        _stopPolling();
        return;
      }

      final call = Map<String, dynamic>.from(data);

      final backendCallSessionId =
          call['callSessionId']?.toString().trim().isNotEmpty == true
          ? call['callSessionId'].toString().trim()
          : call['id']?.toString().trim() ?? '';

      if (backendCallSessionId.isNotEmpty) {
        _resolvedVideoCallSessionId = backendCallSessionId;
      }

      final id =
          call['id']?.toString().trim() ??
          call['callSessionId']?.toString().trim() ??
          '';

      if (id.isNotEmpty && id != widget.consultationId) {
        return;
      }

      final status =
          call['status']?.toString().trim().toUpperCase() ?? 'PENDING';

      setState(() {
        _status = status;
        _error = '';
      });

      if (status == 'ACTIVE') {
        await _openConsultation();
        return;
      }

      if (status == 'CANCELLED' ||
          status == 'REJECTED' ||
          status == 'EXPIRED' ||
          status == 'COMPLETED') {
        _stopPolling();
      }
    } on CustomerConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } finally {
      _checking = false;
    }
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _openConsultation() async {
    if (_chatOpened || !mounted) {
      return;
    }

    _chatOpened = true;
    _stopPolling();

    final normalizedMode = widget.modeLabel.trim().toLowerCase();
    final isAudio = normalizedMode.contains('audio');
    final isVideo = normalizedMode.contains('video');

    final videoCallSessionId = _resolvedVideoCallSessionId.trim();

    // AUDIO must use the canonical backend CallSession.id too.
    final audioCallSessionId = _resolvedVideoCallSessionId.trim();

    if (isAudio && audioCallSessionId.isEmpty) {
      _chatOpened = false;

      setState(() {
        _error = 'Audio call session is not ready yet. Please try again.';
      });

      return;
    }

    if (isVideo && videoCallSessionId.isEmpty) {
      _chatOpened = false;

      if (mounted) {
        setState(() {
          _error = 'Video call session is not ready yet. Please try again.';
        });
      }

      return;
    }

    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) {
          if (isVideo) {
            return VideoCallScreen(
              callId: videoCallSessionId,
              participantName: widget.astrologerName,
            );
          }

          if (isAudio) {
            return AudioCallScreen(
              callId: audioCallSessionId,
              astrologerName: widget.astrologerName,
            );
          }

          return ChatScreen(
            consultationId: videoCallSessionId.isNotEmpty
                ? videoCallSessionId
                : widget.consultationId,
          );
        },
      ),
    );
  }

  Future<void> _cancelRequest() async {
    if (_cancelling || _status != 'PENDING') {
      return;
    }

    setState(() {
      _cancelling = true;
    });

    try {
      if (_callerUserId.isNotEmpty &&
          widget.modeLabel.toLowerCase().contains('video')) {
        _videoCallSocket.cancel(
          callId: widget.consultationId,
          callerUserId: _callerUserId,
          recipientUserId: widget.astrologerUserId,
        );
      }

      await _api.cancel(widget.consultationId);

      if (!mounted) {
        return;
      }

      _stopPolling();

      setState(() {
        _status = 'CANCELLED';
      });

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Consultation request cancelled.')),
        );
    } on CustomerConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            backgroundColor: Colors.red.shade700,
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _cancelling = false;
        });
      }
    }
  }

  String get _countdown {
    final minutes = _secondsLeft ~/ 60;
    final seconds = _secondsLeft % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  String get _headline {
    switch (_status) {
      case 'ACTIVE':
        return 'Astrologer accepted';
      case 'REJECTED':
        return 'Request declined';
      case 'CANCELLED':
        return 'Request cancelled';
      case 'EXPIRED':
        return 'Request expired';
      default:
        return 'Waiting for astrologer';
    }
  }

  String get _description {
    switch (_status) {
      case 'REJECTED':
        return '${widget.astrologerName} could not accept this request. '
            'You can choose another astrologer.';
      case 'CANCELLED':
        return 'You cancelled this consultation request.';
      case 'EXPIRED':
        return 'The astrologer did not accept the request in time. '
            'No consultation charge was completed.';
      default:
        return 'Your ${widget.modeLabel.toLowerCase()} request has been sent '
            'to ${widget.astrologerName}.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _status == 'PENDING';

    return PopScope(
      canPop: !pending,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && pending) {
          ScaffoldMessenger.of(context)
            ..clearSnackBars()
            ..showSnackBar(
              const SnackBar(
                content: Text('Cancel the pending request before leaving.'),
              ),
            );
        }
      },
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          automaticallyImplyLeading: !pending,
          backgroundColor: AppColors.background,
          foregroundColor: AppColors.white,
          title: const Text(
            'Consultation Request',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0x44F4C45E)),
                ),
                child: Column(
                  children: [
                    if (pending)
                      const SizedBox(
                        width: 60,
                        height: 60,
                        child: CircularProgressIndicator(
                          strokeWidth: 4,
                          color: AppColors.gold,
                        ),
                      )
                    else
                      Icon(
                        _status == 'REJECTED' ||
                                _status == 'EXPIRED' ||
                                _status == 'CANCELLED'
                            ? Icons.info_outline_rounded
                            : Icons.check_circle_outline_rounded,
                        size: 62,
                        color: AppColors.gold,
                      ),

                    const SizedBox(height: 22),

                    Text(
                      _headline,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 23,
                        fontWeight: FontWeight.w900,
                      ),
                    ),

                    const SizedBox(height: 10),

                    Text(
                      _description,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.muted,
                        height: 1.45,
                      ),
                    ),

                    if (pending) ...[
                      const SizedBox(height: 24),

                      const Text(
                        'Request expires in',
                        style: TextStyle(color: AppColors.muted),
                      ),

                      const SizedBox(height: 5),

                      Text(
                        _countdown,
                        style: const TextStyle(
                          color: AppColors.gold,
                          fontSize: 30,
                          fontWeight: FontWeight.w900,
                        ),
                      ),

                      const SizedBox(height: 8),

                      const Text(
                        'The paid consultation timer starts only after acceptance.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],

                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(
                        _error,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ],

                    const SizedBox(height: 26),

                    if (pending)
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: OutlinedButton(
                          onPressed: _cancelling ? null : _cancelRequest,
                          child: _cancelling
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Cancel Request'),
                        ),
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Back to Astrologers'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
