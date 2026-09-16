import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../data/video_call_coordinator.dart';

class VideoCallScreen extends StatefulWidget {
  const VideoCallScreen({
    super.key,
    required this.callId,
    required this.participantName,
  });

  final String callId;
  final String participantName;

  @override
  State<VideoCallScreen> createState() => _VideoCallScreenState();
}

class _VideoCallScreenState extends State<VideoCallScreen>
    with WidgetsBindingObserver {
  late final VideoCallCoordinator _coordinator;

  bool _starting = true;
  bool _ending = false;
  bool _disposed = false;
  bool _autoEnding = false;
  bool _extensionRunning = false;
  bool _extendPromptShown = false;

  Timer? _countdownTimer;
  Timer? _serverSyncTimer;
  Timer? _remoteLeaveTimer;

  bool _hadRemoteParticipant = false;
  bool _remoteEndProcessing = false;

  DateTime? _expiresAt;
  int? _remainingSeconds;

  // A newly accepted video call can briefly return no current-call timer
  // while the backend/session state is settling. Do not treat that
  // transient state as an expired consultation.
  bool _hasReceivedServerTimer = false;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addObserver(this);

    _coordinator = VideoCallCoordinator();
    _coordinator.onChanged = _handleCoordinatorChanged;

    _startCall();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_disposed) {
      return;
    }

    debugPrint('VIDEO_LIFECYCLE state=$state');

    switch (state) {
      case AppLifecycleState.resumed:
        unawaited(_handleAppResumed());
        break;

      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        // Keep RTC alive while the app is temporarily backgrounded.
        // Local countdowns are stopped and resynced from the backend
        // when the app becomes active again.
        _countdownTimer?.cancel();
        _countdownTimer = null;

        _serverSyncTimer?.cancel();
        _serverSyncTimer = null;

        debugPrint('VIDEO_LIFECYCLE_BACKGROUND_KEEP_RTC');
        break;

      case AppLifecycleState.detached:
        // Do not call the backend end endpoint here. Android may detach
        // during activity/process lifecycle transitions. Normal dispose
        // and server expiry remain responsible for final cleanup.
        _stopTimers();
        debugPrint('VIDEO_LIFECYCLE_DETACHED');
        break;
    }
  }

  Future<void> _handleAppResumed() async {
    if (_disposed || !mounted || _ending || _autoEnding) {
      return;
    }

    debugPrint('VIDEO_LIFECYCLE_RESUME_SYNC_START');

    try {
      await _syncCallTimer();

      if (_disposed || !mounted || _ending || _autoEnding) {
        return;
      }

      _startTimers();

      debugPrint(
        'VIDEO_LIFECYCLE_RESUME_SYNC_OK '
        'remoteUid=${_coordinator.remoteUid} '
        'remaining=$_remainingSeconds',
      );
    } catch (error) {
      // A temporary resume-sync failure must not destroy a valid RTC call.
      debugPrint('VIDEO_LIFECYCLE_RESUME_SYNC_WARNING error=$error');

      if (!_disposed && mounted && !_ending && !_autoEnding) {
        _startTimers();
      }
    }
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
      // Coordinator already stores the error.
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

    final remoteUid = _coordinator.remoteUid;

    if (remoteUid != null) {
      _hadRemoteParticipant = true;
      _remoteLeaveTimer?.cancel();
      _remoteLeaveTimer = null;
    } else if (_hadRemoteParticipant &&
        !_ending &&
        !_autoEnding &&
        !_remoteEndProcessing &&
        _coordinator.state == VideoCallCoordinatorState.connected) {
      _scheduleRemoteLeaveVerification();
    }

    setState(() {});
  }

  void _scheduleRemoteLeaveVerification() {
    _remoteLeaveTimer?.cancel();

    debugPrint('VIDEO_REMOTE_LEFT_DETECTED - verifying server state');

    _remoteLeaveTimer = Timer(
      const Duration(seconds: 2),
      _verifyRemoteParticipantLeft,
    );
  }

  Future<void> _verifyRemoteParticipantLeft() async {
    if (_disposed ||
        !mounted ||
        _ending ||
        _autoEnding ||
        _remoteEndProcessing) {
      return;
    }

    // Participant came back during the short reconnect grace period.
    if (_coordinator.remoteUid != null) {
      debugPrint('VIDEO_REMOTE_REJOINED_DURING_GRACE');
      return;
    }

    try {
      final session = await _coordinator.refreshCurrentCall();

      if (_disposed || !mounted || _coordinator.remoteUid != null) {
        return;
      }

      // Active backend session means this was probably a temporary
      // network interruption. Keep the call alive for reconnection.
      if (session != null) {
        debugPrint(
          'VIDEO_REMOTE_OFFLINE_BUT_SESSION_ACTIVE - waiting for reconnect',
        );
        return;
      }

      debugPrint('VIDEO_REMOTE_END_CONFIRMED');

      await _finishAfterRemoteEnd();
    } catch (error) {
      // Never terminate a valid call only because the verification
      // request itself temporarily failed.
      debugPrint('VIDEO_REMOTE_END_VERIFY_WARNING: $error');
    }
  }

  Future<void> _finishAfterRemoteEnd() async {
    if (_remoteEndProcessing || _disposed || !mounted) {
      return;
    }

    _remoteEndProcessing = true;
    _ending = true;

    _stopTimers();
    _remoteLeaveTimer?.cancel();
    _remoteLeaveTimer = null;

    try {
      await _coordinator.leaveRtcOnly();
    } catch (error) {
      debugPrint('VIDEO_REMOTE_END_LOCAL_CLEANUP_WARNING: $error');
    }

    if (!mounted || _disposed) {
      return;
    }

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Video call ended.')));

    Navigator.of(context).pop(true);
  }

  Future<void> _syncCallTimer() async {
    try {
      final session = await _coordinator.refreshCurrentCall();

      if (!mounted || _disposed) {
        return;
      }

      if (session == null) {
        if (!_hasReceivedServerTimer) {
          debugPrint('VIDEO_TIMER_SESSION_NOT_READY - keeping RTC connected');
          return;
        }

        await _handleCallExpired();
        return;
      }

      _hasReceivedServerTimer = true;

      final serverExpiresAt = session.expiresAt;

      setState(() {
        _expiresAt = serverExpiresAt;
        _remainingSeconds = serverExpiresAt != null
            ? _secondsUntil(serverExpiresAt)
            : session.remainingSeconds;
      });
    } catch (error) {
      debugPrint('Video timer sync failed: $error');
    }
  }

  void _startTimers() {
    _countdownTimer?.cancel();
    _serverSyncTimer?.cancel();

    _countdownTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _tickCountdown(),
    );

    _serverSyncTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _syncCallTimer(),
    );

    _tickCountdown();
  }

  void _tickCountdown() {
    if (_disposed || !mounted || _autoEnding) {
      return;
    }

    final expiresAt = _expiresAt;

    if (expiresAt == null && _remainingSeconds == null) {
      debugPrint('VIDEO_TIMER_WAITING_FOR_SERVER');
      return;
    }

    final nextRemaining = expiresAt != null
        ? _secondsUntil(expiresAt)
        : ((_remainingSeconds ?? 0) - 1).clamp(0, 1 << 31);

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
          _showExtendDialog();
        }
      });
    }
  }

  int _secondsUntil(DateTime value) {
    final milliseconds = value.difference(DateTime.now()).inMilliseconds;

    if (milliseconds <= 0) {
      return 0;
    }

    return (milliseconds / 1000).ceil();
  }

  Future<void> _showExtendDialog() async {
    if (_disposed || !mounted || _ending || _autoEnding) {
      return;
    }

    final minutes = await showDialog<int>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Consultation ending soon'),
          content: const Text(
            'Your video consultation has less than one minute remaining. '
            'Would you like to extend it?',
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

    if (!mounted || _disposed || minutes == null) {
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

      if (!mounted || _disposed) {
        return;
      }

      if (session != null) {
        final serverExpiresAt = session.expiresAt;

        setState(() {
          _expiresAt = serverExpiresAt;
          _remainingSeconds = serverExpiresAt != null
              ? _secondsUntil(serverExpiresAt)
              : session.remainingSeconds;

          _extendPromptShown = false;
        });
      } else {
        await _syncCallTimer();

        if (mounted && !_disposed) {
          setState(() {
            _extendPromptShown = false;
          });
        }
      }
    } catch (error) {
      _showError(error.toString());

      if (mounted && !_disposed) {
        setState(() {
          _extendPromptShown = false;
        });
      }
    } finally {
      if (mounted && !_disposed) {
        setState(() {
          _extensionRunning = false;
        });
      }
    }
  }

  Future<void> _toggleMute() async {
    try {
      await _coordinator.setMuted(!_coordinator.isMuted);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _toggleCamera() async {
    try {
      await _coordinator.setCameraEnabled(!_coordinator.isCameraEnabled);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _switchCamera() async {
    try {
      await _coordinator.switchCamera();
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _toggleSpeaker() async {
    final current = _coordinator.isSpeakerEnabled;
    final requested = !current;

    debugPrint('VIDEO_SPEAKER_UI_TAP current=$current requested=$requested');

    try {
      await _coordinator.setSpeakerEnabled(requested);

      debugPrint(
        'VIDEO_SPEAKER_UI_COMPLETE enabled=${_coordinator.isSpeakerEnabled}',
      );
    } catch (error) {
      debugPrint('VIDEO_SPEAKER_UI_FAILED error=$error');
      _showError(error.toString());
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
      debugPrint('Automatic video call end response: $error');
    }

    if (!mounted || _disposed) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Consultation time has ended.')),
    );

    Navigator.of(context).pop(true);
  }

  Future<void> _endCall() async {
    if (_ending || _disposed) {
      return;
    }

    setState(() {
      _ending = true;
    });

    _stopTimers();
    _remoteLeaveTimer?.cancel();
    _remoteLeaveTimer = null;

    try {
      await _coordinator.end(reason: 'USER_ENDED');
    } catch (error) {
      // End is best-effort on the backend. Once the local RTC session
      // is closed, never resurrect the video screen/timers.
      debugPrint('VIDEO_MANUAL_END_WARNING: $error');
    }

    if (mounted && !_disposed) {
      Navigator.of(context).pop(true);
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

  void _stopTimers() {
    _countdownTimer?.cancel();
    _countdownTimer = null;

    _serverSyncTimer?.cancel();
    _serverSyncTimer = null;

    _remoteLeaveTimer?.cancel();
    _remoteLeaveTimer = null;
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
      return 'Preparing secure video call...';
    }

    switch (_coordinator.state) {
      case VideoCallCoordinatorState.idle:
        return 'Ready';

      case VideoCallCoordinatorState.ringing:
        return 'Ringing...';

      case VideoCallCoordinatorState.preparing:
        return 'Preparing video call...';

      case VideoCallCoordinatorState.joining:
        return 'Connecting...';

      case VideoCallCoordinatorState.connected:
        if (_coordinator.remoteUid == null) {
          return 'Waiting for ${widget.participantName} to join...';
        }

        return 'Connected';

      case VideoCallCoordinatorState.reconnecting:
        return 'Reconnecting...';

      case VideoCallCoordinatorState.rejected:
        return 'Video call declined';

      case VideoCallCoordinatorState.missed:
        return 'Video call missed';

      case VideoCallCoordinatorState.busy:
        return '${widget.participantName} is busy';

      case VideoCallCoordinatorState.ending:
        return 'Ending call...';

      case VideoCallCoordinatorState.ended:
        return 'Call ended';

      case VideoCallCoordinatorState.failed:
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

  Widget _buildRemoteVideo() {
    final engine = _coordinator.engine;
    final remoteUid = _coordinator.remoteUid;
    final credentials = _coordinator.credentials;

    if (engine == null || remoteUid == null || credentials == null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: Text(
          _statusText,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: engine,
        canvas: VideoCanvas(uid: remoteUid),
        connection: RtcConnection(channelId: credentials.channelName),
        // Android: use SurfaceView for the large remote layer.
        // iOS: use FlutterTexture for stable Flutter composition.
        useFlutterTexture: defaultTargetPlatform == TargetPlatform.iOS,
        useAndroidSurfaceView: defaultTargetPlatform == TargetPlatform.android,
      ),
    );
  }

  Widget _buildLocalVideo() {
    final engine = _coordinator.engine;

    if (engine == null || !_coordinator.isCameraEnabled) {
      return Container(
        color: Colors.black87,
        alignment: Alignment.center,
        child: const Icon(Icons.videocam_off, color: Colors.white),
      );
    }

    return AgoraVideoView(
      controller: VideoViewController(
        rtcEngine: engine,
        canvas: const VideoCanvas(uid: 0),
        // Keep PiP compositable above the remote layer.
        // Android uses TextureView; iOS uses FlutterTexture.
        useFlutterTexture: defaultTargetPlatform == TargetPlatform.iOS,
        useAndroidSurfaceView: false,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final connected = _coordinator.isConnected;

    return PopScope(
      canPop: _coordinator.state == VideoCallCoordinatorState.ended,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_ending) {
          _endCall();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(child: _buildRemoteVideo()),

              Positioned(
                top: 16,
                left: 16,
                right: 16,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.participantName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          _timerText,
                          key: const ValueKey('video-call-countdown'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          _statusText,
                          style: const TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              Positioned(
                right: 16,
                top: 90,
                width: 112,
                height: 160,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: _buildLocalVideo(),
                ),
              ),

              if (_coordinator.state == VideoCallCoordinatorState.failed)
                Center(
                  child: FilledButton.icon(
                    onPressed: _retry,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                ),

              Positioned(
                left: 12,
                right: 12,
                bottom: 22,
                child: Wrap(
                  alignment: WrapAlignment.spaceEvenly,
                  spacing: 8,
                  runSpacing: 12,
                  children: [
                    _VideoControlButton(
                      icon: _coordinator.isMuted ? Icons.mic_off : Icons.mic,
                      label: _coordinator.isMuted ? 'Unmute' : 'Mute',
                      onPressed: connected ? _toggleMute : null,
                    ),
                    _VideoControlButton(
                      icon: _coordinator.isCameraEnabled
                          ? Icons.videocam
                          : Icons.videocam_off,
                      label: _coordinator.isCameraEnabled
                          ? 'Camera'
                          : 'Camera off',
                      onPressed: connected ? _toggleCamera : null,
                    ),
                    _VideoControlButton(
                      icon: Icons.cameraswitch,
                      label: 'Switch',
                      onPressed: connected && _coordinator.isCameraEnabled
                          ? _switchCamera
                          : null,
                    ),
                    _VideoControlButton(
                      icon: _coordinator.isSpeakerEnabled
                          ? Icons.volume_up
                          : Icons.hearing,
                      label: _coordinator.isSpeakerEnabled
                          ? 'Speaker'
                          : 'Earpiece',
                      onPressed: connected ? _toggleSpeaker : null,
                    ),
                    _VideoControlButton(
                      icon: Icons.call_end,
                      label: 'End',
                      destructive: true,
                      onPressed: _ending ? null : _endCall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _disposed = true;

    WidgetsBinding.instance.removeObserver(this);

    _stopTimers();

    _coordinator.onChanged = null;

    unawaited(_coordinator.dispose());

    super.dispose();
  }
}

class _VideoControlButton extends StatelessWidget {
  const _VideoControlButton({
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton.filled(
          onPressed: onPressed,
          style: IconButton.styleFrom(
            backgroundColor: destructive
                ? Colors.red
                : Colors.black.withValues(alpha: 0.55),
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.black38,
            disabledForegroundColor: Colors.white38,
          ),
          icon: Icon(icon),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 11)),
      ],
    );
  }
}
