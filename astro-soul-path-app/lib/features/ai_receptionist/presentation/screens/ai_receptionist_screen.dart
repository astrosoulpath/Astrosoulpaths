import 'package:flutter/material.dart';

import '../../data/ai_receptionist_api.dart';

class AiReceptionistScreen extends StatefulWidget {
  const AiReceptionistScreen({super.key});

  @override
  State<AiReceptionistScreen> createState() => _AiReceptionistScreenState();
}

class _AiReceptionistScreenState extends State<AiReceptionistScreen> {
  final AiReceptionistApi _api = const AiReceptionistApi();

  final TextEditingController _phoneController = TextEditingController();

  final TextEditingController _messageController = TextEditingController();

  AiReceptionistSystemStatus? _systemStatus;
  AiReceptionistProviderHealth? _providerHealth;
  AiReceptionistSession? _session;

  List<AiReceptionistMessage> _messages = const [];

  String _language = 'HINGLISH';
  String? _error;

  bool _loadingStatus = true;
  bool _starting = false;
  bool _sending = false;
  bool _ending = false;

  bool get _isActive => _session?.isActive == true;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final results = await Future.wait([
        _api.getStatus(),
        _api.getProviderHealth(),
      ]);

      if (!mounted) return;

      setState(() {
        _systemStatus = results[0] as AiReceptionistSystemStatus;
        _providerHealth = results[1] as AiReceptionistProviderHealth;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingStatus = false;
        });
      }
    }
  }

  Future<void> _startSession() async {
    if (_starting || _isActive) return;

    try {
      setState(() {
        _starting = true;
        _error = null;
        _messages = const [];
      });

      final session = await _api.createSession(
        language: _language,
        customerPhone: _phoneController.text,
      );

      if (!mounted) return;

      setState(() {
        _session = session;
      });

      await _refreshTranscript();
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _starting = false;
        });
      }
    }
  }

  Future<void> _sendMessage() async {
    final session = _session;
    final text = _messageController.text.trim();

    if (session == null || !session.isActive || text.isEmpty || _sending) {
      return;
    }

    try {
      setState(() {
        _sending = true;
        _error = null;
      });

      _messageController.clear();

      await _api.sendMessage(sessionId: session.id, message: text);

      await _refreshTranscript();
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  Future<void> _refreshTranscript() async {
    final session = _session;

    if (session == null) return;

    final messages = await _api.getTranscript(session.id);

    if (!mounted) return;

    setState(() {
      _messages = messages;
    });
  }

  Future<void> _endSession() async {
    final session = _session;

    if (session == null || !session.isActive || _ending) {
      return;
    }

    try {
      setState(() {
        _ending = true;
        _error = null;
      });

      final ended = await _api.endSession(session.id);

      if (!mounted) return;

      setState(() {
        _session = ended;
      });

      await _refreshTranscript();
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _ending = false;
        });
      }
    }
  }

  String _cleanError(Object error) {
    return error.toString().replaceFirst('Exception: ', '');
  }

  @override
  Widget build(BuildContext context) {
    const orange = Color(0xFFE57C18);
    const dark = Color(0xFF1D1A17);
    const background = Color(0xFFF8F5F1);

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: dark,
        elevation: 0,
        title: const Text(
          'AI Receptionist',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        child: _loadingStatus
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildHero(orange, dark),
                        const SizedBox(height: 14),
                        if (_error != null) _buildError(),
                        _buildStatusCard(orange, dark),
                        const SizedBox(height: 14),
                        _buildSetupCard(orange, dark),
                        const SizedBox(height: 14),
                        _buildConversationCard(orange, dark),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildHero(Color orange, Color dark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF3E5), Colors.white],
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: orange,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.support_agent_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '24/7 AI Receptionist',
                  style: TextStyle(
                    color: dark,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'Customer assistance and consultation support.',
                  style: TextStyle(
                    color: dark.withValues(alpha: 0.62),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard(Color orange, Color dark) {
    final providerOnline = _providerHealth?.available == true;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(),
      child: Column(
        children: [
          _statusRow(
            'Backend',
            _systemStatus?.enabled == true ? 'Connected' : 'Unavailable',
            Icons.cloud_done_outlined,
            orange,
            dark,
          ),
          const Divider(height: 24),
          _statusRow(
            'Receptionist',
            providerOnline ? 'Online' : 'Offline',
            Icons.headset_mic_outlined,
            orange,
            dark,
          ),
          const Divider(height: 24),
          _statusRow(
            'Provider',
            _providerHealth?.provider ?? '--',
            Icons.hub_outlined,
            orange,
            dark,
          ),
          const Divider(height: 24),
          _statusRow(
            'Session',
            _session?.status ?? 'READY',
            Icons.radio_button_checked,
            orange,
            dark,
          ),
        ],
      ),
    );
  }

  Widget _statusRow(
    String label,
    String value,
    IconData icon,
    Color orange,
    Color dark,
  ) {
    return Row(
      children: [
        Icon(icon, color: orange, size: 21),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(color: dark.withValues(alpha: 0.65)),
          ),
        ),
        Text(
          value,
          style: TextStyle(color: dark, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _buildSetupCard(Color orange, Color dark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Reception Setup',
            style: TextStyle(
              color: dark,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _phoneController,
            enabled: !_isActive,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Customer phone',
              hintText: '+91...',
              prefixIcon: Icon(Icons.phone_outlined),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            initialValue: _language,
            decoration: const InputDecoration(
              labelText: 'Language',
              prefixIcon: Icon(Icons.language_outlined),
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(value: 'AUTO', child: Text('Auto Detect')),
              DropdownMenuItem(value: 'HINGLISH', child: Text('Hinglish')),
              DropdownMenuItem(value: 'HINDI', child: Text('Hindi')),
              DropdownMenuItem(value: 'ENGLISH', child: Text('English')),
            ],
            onChanged: _isActive
                ? null
                : (value) {
                    if (value == null) return;

                    setState(() {
                      _language = value;
                    });
                  },
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              onPressed: _isActive
                  ? (_ending ? null : _endSession)
                  : (_starting ? null : _startSession),
              style: FilledButton.styleFrom(
                backgroundColor: _isActive ? const Color(0xFFB43A3A) : orange,
              ),
              icon: (_starting || _ending)
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(
                      _isActive
                          ? Icons.stop_circle_outlined
                          : Icons.play_circle_outline,
                    ),
              label: Text(_isActive ? 'End Session' : 'Start Demo Session'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConversationCard(Color orange, Color dark) {
    return Container(
      decoration: _cardDecoration(),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFFFFE8CC),
                  child: Icon(Icons.smart_toy_outlined, color: orange),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Astro AI Receptionist',
                        style: TextStyle(
                          color: dark,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _isActive
                            ? 'Conversation active'
                            : 'Ready for customer',
                        style: TextStyle(
                          color: dark.withValues(alpha: 0.58),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Container(
            constraints: const BoxConstraints(minHeight: 230, maxHeight: 380),
            padding: const EdgeInsets.all(14),
            child: _messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.forum_outlined,
                          size: 38,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Start a session to preview the conversation.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      return _messageBubble(_messages[index], orange);
                    },
                  ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    enabled: _isActive && !_sending,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: const InputDecoration(
                      hintText: 'Type customer message...',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _isActive && !_sending ? _sendMessage : null,
                  style: IconButton.styleFrom(backgroundColor: orange),
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _messageBubble(AiReceptionistMessage message, Color orange) {
    final customer = message.role == 'CUSTOMER';

    return Align(
      alignment: customer ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 290),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: customer ? orange : const Color(0xFFF3EEE8),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              customer ? 'Customer' : 'AI Receptionist',
              style: TextStyle(
                color: customer ? Colors.white70 : Colors.black54,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              message.content,
              style: TextStyle(
                color: customer ? Colors.white : const Color(0xFF27221D),
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEEEE),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(_error!, style: const TextStyle(color: Color(0xFFB3261E))),
    );
  }

  BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFECE6DF)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D000000),
          blurRadius: 18,
          offset: Offset(0, 6),
        ),
      ],
    );
  }
}
