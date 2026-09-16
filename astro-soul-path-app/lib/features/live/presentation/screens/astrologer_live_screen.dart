import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/material.dart';

import '../../data/live_api.dart';
import '../../data/live_models.dart';
import '../../data/live_rtc_service.dart';

class AstrologerLiveScreen extends StatefulWidget {
  const AstrologerLiveScreen({super.key, this.initialTitle});

  final String? initialTitle;

  @override
  State<AstrologerLiveScreen> createState() => _AstrologerLiveScreenState();
}

class _AstrologerLiveScreenState extends State<AstrologerLiveScreen> {
  final LiveApi _api = LiveApi();
  final LiveRtcService _rtc = LiveRtcService();

  LiveSession? _session;

  bool _starting = true;
  bool _ending = false;
  bool _disposed = false;

  String? _error;

  @override
  void initState() {
    super.initState();

    _rtc.onChanged = _handleRtcChanged;
    _rtc.onError = _handleRtcError;
    _rtc.onTokenRenewalRequested = _renewPublisherToken;

    _startLive();
  }

  void _handleRtcChanged() {
    if (!mounted || _disposed) {
      return;
    }

    setState(() {});
  }

  void _handleRtcError(String message) {
    if (!mounted || _disposed) {
      return;
    }

    setState(() {
      _error = message;
    });
  }

  Future<void> _startLive() async {
    try {
      final result = await _api.startLive(title: widget.initialTitle);

      if (!mounted || _disposed) {
        return;
      }

      _session = result.session;

      await _rtc.connect(
        credentials: result.rtc,
        role: LiveRtcRole.broadcaster,
      );
    } catch (error) {
      if (mounted && !_disposed) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted && !_disposed) {
        setState(() {
          _starting = false;
        });
      }
    }
  }

  Future<String?> _renewPublisherToken() async {
    final result = await _api.startLive(title: _session?.title);

    _session = result.session;

    if (mounted && !_disposed) {
      setState(() {});
    }

    return result.rtc.token;
  }

  Future<void> _toggleMute() async {
    try {
      await _rtc.setMuted(!_rtc.isMuted);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _toggleCamera() async {
    try {
      await _rtc.setCameraEnabled(!_rtc.isCameraEnabled);
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _switchCamera() async {
    try {
      await _rtc.switchCamera();
    } catch (error) {
      _showError(error.toString());
    }
  }

  Future<void> _endLive() async {
    if (_ending) {
      return;
    }

    final session = _session;

    setState(() {
      _ending = true;
    });

    try {
      await _rtc.leave();

      if (session != null) {
        await _api.endLive(session.id);
      }

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _ending = false;
        });
      }

      _showError(error.toString());
    }
  }

  void _showError(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  String get _statusText {
    switch (_rtc.state) {
      case LiveRtcConnectionState.idle:
        return 'Preparing';

      case LiveRtcConnectionState.preparing:
        return 'Preparing live stream';

      case LiveRtcConnectionState.joining:
        return 'Connecting';

      case LiveRtcConnectionState.connected:
        return 'LIVE';

      case LiveRtcConnectionState.reconnecting:
        return 'Reconnecting';

      case LiveRtcConnectionState.failed:
        return 'Connection failed';

      case LiveRtcConnectionState.left:
        return 'Live ended';
    }
  }

  Widget _buildPreview() {
    final engine = _rtc.engine;

    if (engine == null || !_rtc.isCameraEnabled) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: const Icon(Icons.videocam_off, color: Colors.white70, size: 54),
      );
    }

    return AgoraVideoView(
      controller: VideoViewController(
        rtcEngine: engine,
        canvas: const VideoCanvas(uid: 0),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _rtc.state == LiveRtcConnectionState.left,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_ending) {
          _endLive();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(child: _buildPreview()),

              Positioned(
                top: 16,
                left: 16,
                right: 16,
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        _statusText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${_session?.viewerCount ?? 0} watching',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              if (_session?.title != null && _session!.title!.trim().isNotEmpty)
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 120,
                  child: Text(
                    _session!.title!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),

              if (_starting) const Center(child: CircularProgressIndicator()),

              if (_error != null && !_starting)
                Center(
                  child: Container(
                    margin: const EdgeInsets.all(24),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ),

              Positioned(
                left: 12,
                right: 12,
                bottom: 24,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _LiveControlButton(
                      icon: _rtc.isMuted ? Icons.mic_off : Icons.mic,
                      label: _rtc.isMuted ? 'Unmute' : 'Mute',
                      onPressed: _rtc.isConnected ? _toggleMute : null,
                    ),
                    _LiveControlButton(
                      icon: _rtc.isCameraEnabled
                          ? Icons.videocam
                          : Icons.videocam_off,
                      label: 'Camera',
                      onPressed: _rtc.isConnected ? _toggleCamera : null,
                    ),
                    _LiveControlButton(
                      icon: Icons.cameraswitch,
                      label: 'Switch',
                      onPressed: _rtc.isConnected && _rtc.isCameraEnabled
                          ? _switchCamera
                          : null,
                    ),
                    _LiveControlButton(
                      icon: Icons.stop_circle,
                      label: 'End',
                      destructive: true,
                      onPressed: _ending ? null : _endLive,
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

    _rtc.onChanged = null;
    _rtc.onError = null;
    _rtc.onTokenRenewalRequested = null;

    unawaited(_rtc.dispose());

    _api.close();

    super.dispose();
  }
}

class _LiveControlButton extends StatelessWidget {
  const _LiveControlButton({
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
          ),
          icon: Icon(icon),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 11)),
      ],
    );
  }
}
