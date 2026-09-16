import 'dart:async';

import 'package:flutter/material.dart';

import '../../data/call_api.dart';
import '../../data/call_coordinator.dart';

class AudioCallScreen extends StatefulWidget {
  const AudioCallScreen({
    super.key,
    required this.callId,
    required this.astrologerName,
  });

  final String callId;
  final String astrologerName;

  @override
  State<AudioCallScreen> createState() => _AudioCallScreenState();
}

class _AudioCallScreenState extends State<AudioCallScreen>
    with WidgetsBindingObserver {
  late final CallCoordinator _coordinator;

  bool _starting = true;
  bool _ending = false;
  bool _disposed = false;
  bool _navigatedAway = false;
  bool _resumeSyncInFlight = false;
  bool _autoEnding = false;
  bool _extendPromptShown = false;
  bool _extensionRunning = false;

  Timer? _countdownTimer;
  Timer? _serverSyncTimer;

  DateTime? _expiresAt;
  int? _remainingSeconds;

  // RTC can connect slightly before the backend current-call endpoint
  // starts returning the accepted ACTIVE session.
  // Never auto-end until a real server timer has been received once.
  bool _timerInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _coordinator = CallCoordinator();
    _coordinator.onChanged = _handleCoordinatorChanged;

    _startCall();
  }

  Future<void> _startCall() async {
    _stopTimers();

    try {
      await _coordinator.connect(widget.callId);

      await _syncCallTimer();

      if (!_disposed && mounted) {
        _startTimers();
      }
    } catch (_) {
      // Error text is already stored by the coordinator.
    } finally {
      if (mounted && !_disposed) {
        setState(() {
          _starting = false;
        });
      }
    }
  }

  void _handleCoordinatorChanged() {
    if (!mounted || _disposed) {
      return;
    }

    setState(() {});
  }

  Future<void> _syncCallTimer() async {
    try {
      final session = await _coordinator.refreshCurrentCall();

      if (_disposed || !mounted) {
        return;
      }

      if (session == null) {
        if (_timerInitialized) {
          await _handleCallExpired();
        } else {
          debugPrint(
            'AUDIO_TIMER_WAITING reason=current_call_not_ready callId=${widget.callId}',
          );
        }
        return;
      }

      final currentCallId = _coordinator.callId?.trim() ?? '';

      if (currentCallId.isNotEmpty &&
          session.id.isNotEmpty &&
          session.id != currentCallId) {
        return;
      }

      if (session.status != 'ACTIVE' || session.remainingSeconds <= 0) {
        if (_timerInitialized) {
          await _handleCallExpired();
        } else {
          debugPrint(
            'AUDIO_TIMER_WAITING '
            'reason=session_not_active_yet '
            'status=${session.status} '
            'remaining=${session.remainingSeconds}',
          );
        }
        return;
      }

      final serverExpiresAt = session.expiresAt;
      final serverRemaining = session.remainingSeconds.clamp(0, 1 << 31);

      setState(() {
        _expiresAt = serverExpiresAt;
        _remainingSeconds = serverRemaining;
        _timerInitialized = serverRemaining > 0;
      });

      if (_timerInitialized) {
        debugPrint(
          'AUDIO_TIMER_INITIALIZED '
          'remaining=$_remainingSeconds '
          'expiresAt=$_expiresAt',
        );
      }

      if ((_remainingSeconds ?? 0) <= 0) {
        await _handleCallExpired();
      }
    } catch (error) {
      // Keep the local countdown running if a temporary sync fails.
      debugPrint('Call timer sync failed: $error');
    }
  }

  void _startTimers() {
    _countdownTimer?.cancel();
    _serverSyncTimer?.cancel();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _tickCountdown();
    });

    _serverSyncTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _syncCallTimer();
    });

    _tickCountdown();
  }

  void _tickCountdown() {
    if (_disposed || !mounted || _autoEnding) {
      return;
    }

    if (!_timerInitialized) {
      return;
    }

    final nextRemaining = ((_remainingSeconds ?? 0) - 1).clamp(0, 1 << 31);

    if (nextRemaining <= 0) {
      if (_remainingSeconds != 0) {
        setState(() {
          _remainingSeconds = 0;
        });
      }

      _handleCallExpired();
      return;
    }

    setState(() {
      _remainingSeconds = nextRemaining;
    });

    if (nextRemaining <= 60 &&
        nextRemaining > 0 &&
        !_extendPromptShown &&
        !_extensionRunning &&
        _coordinator.isConnected) {
      _extendPromptShown = true;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_disposed && mounted) {
          _showExtendCallDialog();
        }
      });
    }
  }

  Future<void> _showExtendCallDialog() async {
    if (_disposed || !mounted || _ending || _autoEnding) {
      return;
    }

    final minutes = await showDialog<int>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Consultation ending soon'),
          content: const Text(
            'Your audio consultation has less than one minute remaining. '
            'Would you like to extend the call?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Not now'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(5),
              child: const Text('Extend 5 min'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(10),
              child: const Text('Extend 10 min'),
            ),
          ],
        );
      },
    );

    if (_disposed || !mounted || minutes == null) {
      return;
    }

    await _extendCall(minutes);
  }

  Future<void> _extendCall(int minutes) async {
    if (_extensionRunning || _ending || _autoEnding) {
      return;
    }

    setState(() {
      _extensionRunning = true;
    });

    try {
      final session = await _coordinator.extend(minutes);

      if (_disposed || !mounted) {
        return;
      }

      if (session != null) {
        final serverExpiresAt = session.expiresAt;
        final serverRemaining = session.remainingSeconds.clamp(0, 1 << 31);

        setState(() {
          _expiresAt = serverExpiresAt;
          _remainingSeconds = serverRemaining;
          _timerInitialized = serverRemaining > 0;

          _extendPromptShown = false;
        });
      } else {
        await _syncCallTimer();

        if (!_disposed && mounted) {
          setState(() {
            _extendPromptShown = false;
          });
        }
      }

      if (_disposed || !mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text('Consultation extended by $minutes minutes.')),
        );
    } catch (error) {
      if (_disposed || !mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              error is CallApiException
                  ? error.message
                  : 'Unable to extend the consultation. Please try again.',
            ),
          ),
        );
    } finally {
      if (!_disposed && mounted) {
        setState(() {
          _extensionRunning = false;
        });
      }
    }
  }

  Future<void> _handleCallExpired() async {
    if (_autoEnding || _ending || _disposed) {
      return;
    }

    _autoEnding = true;
    _ending = true;
    _stopTimers();

    if (mounted) {
      setState(() {
        _remainingSeconds = 0;
      });
    }

    try {
      await _coordinator.end(reason: 'TIME_EXPIRED');
    } catch (error) {
      debugPrint('Automatic call end response: $error');
    }

    if (!mounted || _disposed) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Consultation time has ended.')),
    );

    _popCallScreenOnce();
  }

  void _stopTimers() {
    _countdownTimer?.cancel();
    _countdownTimer = null;

    _serverSyncTimer?.cancel();
    _serverSyncTimer = null;
  }

  Future<void> _toggleMute() async {
    try {
      await _coordinator.setMuted(!_coordinator.isMuted);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _toggleSpeaker() async {
    try {
      await _coordinator.setSpeakerEnabled(!_coordinator.isSpeakerEnabled);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _endCall() async {
    if (_ending) {
      return;
    }

    setState(() {
      _ending = true;
    });

    _stopTimers();

    try {
      await _coordinator.end(reason: 'USER_ENDED');

      if (mounted) {
        _popCallScreenOnce();
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _ending = false;
        });

        _startTimers();
      }

      _showError(error.toString());
    }
  }

  Future<void> _retry() async {
    if (_starting) {
      return;
    }

    setState(() {
      _starting = true;
      _ending = false;
      _autoEnding = false;
    });

    await _startCall();
  }

  void _showError(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String get _statusText {
    if (_starting) {
      return 'Preparing secure audio call...';
    }

    switch (_coordinator.state) {
      case CallCoordinatorState.idle:
        return 'Ready to call';

      case CallCoordinatorState.preparing:
        return 'Preparing call...';

      case CallCoordinatorState.joining:
        return 'Connecting...';

      case CallCoordinatorState.connected:
        if (_coordinator.remoteUid == null) {
          return 'Waiting for ${widget.astrologerName} to join...';
        }

        return 'Connected';

      case CallCoordinatorState.reconnecting:
        return 'Reconnecting...';

      case CallCoordinatorState.ending:
        return 'Ending call...';

      case CallCoordinatorState.ended:
        return 'Call ended';

      case CallCoordinatorState.failed:
        return 'Unable to connect';
    }
  }

  String get _timerText {
    final total = _remainingSeconds;

    if (total == null) {
      return '--:--';
    }

    final safeTotal = total < 0 ? 0 : total;
    final minutes = safeTotal ~/ 60;
    final seconds = safeTotal % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  bool get _isLowTime {
    final remaining = _remainingSeconds;
    return remaining != null && remaining > 0 && remaining <= 60;
  }

  bool get _showRetry =>
      _coordinator.state == CallCoordinatorState.failed &&
      !_starting &&
      !_ending;

  void _popCallScreenOnce([bool result = true]) {
    if (_disposed || !mounted || _navigatedAway) {
      return;
    }

    _navigatedAway = true;

    Navigator.of(context).pop(result);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_disposed) {
      return;
    }

    if (state == AppLifecycleState.resumed) {
      _handleAppResumed();
    }
  }

  Future<void> _handleAppResumed() async {
    if (_disposed ||
        !mounted ||
        _resumeSyncInFlight ||
        _ending ||
        _autoEnding) {
      return;
    }

    _resumeSyncInFlight = true;

    try {
      debugPrint('AUDIO_CALL_APP_RESUMED callId=${widget.callId}');

      _stopTimers();

      await _syncCallTimer();

      if (_disposed || !mounted) {
        return;
      }

      if ((_remainingSeconds ?? 0) > 0 && !_ending && !_autoEnding) {
        _startTimers();
      }

      debugPrint(
        'AUDIO_CALL_RESUME_SYNCED '
        'callId=${widget.callId} '
        'remaining=$_remainingSeconds '
        'expiresAt=$_expiresAt',
      );
    } catch (error) {
      debugPrint(
        'AUDIO_CALL_RESUME_SYNC_FAILED '
        'callId=${widget.callId} '
        'error=$error',
      );

      if (!_disposed &&
          mounted &&
          !_ending &&
          !_autoEnding &&
          (_remainingSeconds ?? 0) > 0) {
        _startTimers();
      }
    } finally {
      _resumeSyncInFlight = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _disposed = true;

    _stopTimers();

    _coordinator.onChanged = null;
    _coordinator.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connected = _coordinator.state == CallCoordinatorState.connected;

    final participantJoined = connected && _coordinator.remoteUid != null;

    final scheme = Theme.of(context).colorScheme;

    return PopScope(
      canPop: _coordinator.state == CallCoordinatorState.ended,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_ending) {
          _endCall();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Audio Consultation'),
          automaticallyImplyLeading: false,
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Spacer(),

                CircleAvatar(
                  radius: 54,
                  child: Text(
                    widget.astrologerName.trim().isEmpty
                        ? 'A'
                        : widget.astrologerName
                              .trim()
                              .substring(0, 1)
                              .toUpperCase(),
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                Text(
                  widget.astrologerName,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),

                const SizedBox(height: 8),

                Text(
                  _statusText,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),

                const SizedBox(height: 18),

                Text(
                  _timerText,
                  key: const ValueKey('audio-call-countdown'),
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: _isLowTime ? scheme.error : null,
                  ),
                ),

                const SizedBox(height: 4),

                Text(
                  _isLowTime ? 'Consultation ending soon' : 'Time remaining',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _isLowTime ? scheme.error : null,
                    fontWeight: _isLowTime ? FontWeight.w600 : null,
                  ),
                ),

                if (participantJoined) ...[
                  const SizedBox(height: 10),
                  const Text('Live audio consultation'),
                ],

                if (_coordinator.errorMessage != null &&
                    _coordinator.errorMessage!.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    _coordinator.errorMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: scheme.error),
                  ),
                ],

                if (_showRetry) ...[
                  const SizedBox(height: 16),
                  FilledButton.tonal(
                    onPressed: _retry,
                    child: const Text('Retry connection'),
                  ),
                ],

                const Spacer(),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _CallControlButton(
                      icon: _coordinator.isMuted ? Icons.mic_off : Icons.mic,
                      label: _coordinator.isMuted ? 'Unmute' : 'Mute',
                      onPressed: connected ? _toggleMute : null,
                    ),
                    _CallControlButton(
                      icon: _coordinator.isSpeakerEnabled
                          ? Icons.volume_up
                          : Icons.hearing,
                      label: _coordinator.isSpeakerEnabled
                          ? 'Speaker'
                          : 'Earpiece',
                      onPressed: connected ? _toggleSpeaker : null,
                    ),
                    _CallControlButton(
                      icon: Icons.call_end,
                      label: 'End',
                      destructive: true,
                      onPressed: _ending ? null : _endCall,
                    ),
                  ],
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CallControlButton extends StatelessWidget {
  const _CallControlButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 64,
          height: 64,
          child: FilledButton(
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              shape: const CircleBorder(),
              padding: EdgeInsets.zero,
              backgroundColor: destructive ? scheme.error : null,
              foregroundColor: destructive ? scheme.onError : null,
            ),
            child: Icon(icon),
          ),
        ),
        const SizedBox(height: 8),
        Text(label),
      ],
    );
  }
}
