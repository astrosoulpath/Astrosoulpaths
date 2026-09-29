import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/material.dart';

import '../../data/live_api.dart';
import '../../data/live_models.dart';
import '../../data/live_rtc_service.dart';
import '../../data/live_socket_service.dart';

class CustomerLiveViewerScreen extends StatefulWidget {
  const CustomerLiveViewerScreen({super.key, required this.liveSession});

  final LiveSession liveSession;

  @override
  State<CustomerLiveViewerScreen> createState() =>
      _CustomerLiveViewerScreenState();
}

class _CustomerLiveViewerScreenState extends State<CustomerLiveViewerScreen> {
  final LiveApi _api = LiveApi();
  final LiveRtcService _rtc = LiveRtcService();
  final LiveSocketService _chat = LiveSocketService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _messageScrollController = ScrollController();

  final List<Map<String, dynamic>> _liveMessages = <Map<String, dynamic>>[];

  bool _chatJoined = false;

  late LiveSession _session;

  bool _joining = true;
  bool _leaving = false;
  bool _disposed = false;

  String? _error;

  @override
  void initState() {
    super.initState();

    _session = widget.liveSession;

    _rtc.onChanged = _handleRtcChanged;
    _rtc.onError = _handleRtcError;
    _rtc.onTokenRenewalRequested = _renewAudienceToken;

    _chat.onJoined = () {
      if (!mounted || _disposed) {
        return;
      }

      setState(() {
        _chatJoined = true;
      });
    };

    _chat.onMessage = (message) {
      if (!mounted || _disposed) {
        return;
      }

      setState(() {
        _liveMessages.add(message);
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_messageScrollController.hasClients) {
          _messageScrollController.animateTo(
            _messageScrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    };

    _chat.onError = (message) {
      if (!mounted || _disposed) {
        return;
      }

      _showError(message);
    };

    _joinLive();
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

  Future<void> _joinLive() async {
    try {
      final result = await _api.joinLive(_session.id);

      if (!mounted || _disposed) {
        return;
      }

      _session = result.session;

      await _rtc.connect(credentials: result.rtc, role: LiveRtcRole.audience);

      await _chat.connect(_session.id);
    } catch (error) {
      if (mounted && !_disposed) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted && !_disposed) {
        setState(() {
          _joining = false;
        });
      }
    }
  }

  void _sendLiveMessage() {
    final message = _messageController.text.trim();

    if (message.isEmpty) {
      return;
    }

    if (!_chatJoined) {
      _showError('Live chat is still connecting.');
      return;
    }

    _chat.sendMessage(message);
    _messageController.clear();
  }

  String _senderName(Map<String, dynamic> item) {
    final sender = item['sender'];

    if (sender is Map) {
      final name = sender['name']?.toString().trim();

      if (name != null && name.isNotEmpty) {
        return name;
      }
    }

    return 'Viewer';
  }

  Future<String?> _renewAudienceToken() async {
    final result = await _api.joinLive(_session.id);

    _session = result.session;

    if (mounted && !_disposed) {
      setState(() {});
    }

    return result.rtc.token;
  }

  Future<void> _leaveLive() async {
    if (_leaving) {
      return;
    }

    setState(() {
      _leaving = true;
    });

    try {
      await _rtc.leave();

      await _api.leaveLive(_session.id);

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _leaving = false;
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
        return 'Preparing live';

      case LiveRtcConnectionState.preparing:
        return 'Preparing live';

      case LiveRtcConnectionState.joining:
        return 'Joining live';

      case LiveRtcConnectionState.connected:
        return _rtc.remoteUid == null ? 'Waiting for astrologer video' : 'LIVE';

      case LiveRtcConnectionState.reconnecting:
        return 'Reconnecting';

      case LiveRtcConnectionState.failed:
        return 'Connection failed';

      case LiveRtcConnectionState.left:
        return 'Live ended';
    }
  }

  Widget _buildRemoteVideo() {
    final engine = _rtc.engine;
    final uid = _rtc.remoteUid;
    final credentials = _rtc.credentials;

    if (engine == null || uid == null || credentials == null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: Text(
          _statusText,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: engine,
        canvas: VideoCanvas(uid: uid),
        connection: RtcConnection(
          channelId: credentials.channelName,
          localUid: credentials.uid,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _rtc.state == LiveRtcConnectionState.left,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_leaving) {
          _leaveLive();
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
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Text(
                        'LIVE',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _session.astrologer.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '${_session.viewerCount} watching',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),

              if (_session.title != null && _session.title!.trim().isNotEmpty)
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 88,
                  child: Text(
                    _session.title!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),

              if (_joining) const Center(child: CircularProgressIndicator()),

              if (_error != null && !_joining)
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
                left: 14,
                right: 14,
                bottom: 76,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_liveMessages.isNotEmpty)
                      Container(
                        constraints: const BoxConstraints(maxHeight: 190),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.58),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: ListView.builder(
                          controller: _messageScrollController,
                          shrinkWrap: true,
                          itemCount: _liveMessages.length,
                          itemBuilder: (context, index) {
                            final item = _liveMessages[index];
                            final sender = _senderName(item);
                            final message =
                                item['message']?.toString().trim() ?? '';

                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 3),
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '$sender: ',
                                      style: const TextStyle(
                                        color: Colors.amber,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    TextSpan(
                                      text: message,
                                      style: const TextStyle(
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _messageController,
                            enabled: !_leaving,
                            maxLength: 500,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _sendLiveMessage(),
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              counterText: '',
                              hintText: _chatJoined
                                  ? 'Ask a question...'
                                  : 'Connecting chat...',
                              hintStyle: const TextStyle(color: Colors.white70),
                              filled: true,
                              fillColor: Colors.black.withValues(alpha: 0.68),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          onPressed: _chatJoined && !_leaving
                              ? _sendLiveMessage
                              : null,
                          icon: const Icon(Icons.send_rounded),
                          tooltip: 'Send question',
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              Positioned(
                right: 18,
                bottom: 22,
                child: FilledButton.icon(
                  onPressed: _leaving ? null : _leaveLive,
                  style: FilledButton.styleFrom(backgroundColor: Colors.red),
                  icon: const Icon(Icons.logout),
                  label: const Text('Leave'),
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
    unawaited(_chat.dispose());

    _messageController.dispose();
    _messageScrollController.dispose();

    _api.close();

    super.dispose();
  }
}
