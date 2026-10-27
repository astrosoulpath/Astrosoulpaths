import 'dart:async';
import 'package:flutter/material.dart';
import '../../data/consultation_kundli_api.dart';
import 'astrologer_saved_kundli_detail_screen.dart';

class ConsultationKundliConsentScreen extends StatefulWidget {
  const ConsultationKundliConsentScreen({
    super.key,
    required this.consultationId,
    this.api,
    this.enabled = consultationKundliV1Enabled,
  });
  final String consultationId;
  final ConsultationKundliApi? api;
  final bool enabled;
  @override
  State<ConsultationKundliConsentScreen> createState() => _ConsentState();
}

class _ConsentState extends State<ConsultationKundliConsentScreen>
    with WidgetsBindingObserver {
  Timer? _refresh;
  late final _api = widget.api ?? ConsultationKundliApi();
  Map<String, dynamic>? _state;
  String _error = '';
  String? _requestKey;
  String? _grantId;
  bool _accepted = false;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.enabled) _run(() => _api.status(widget.consultationId));
    if (widget.enabled) {
      _refresh = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _run(() => _api.status(widget.consultationId)),
      );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _run(() => _api.status(widget.consultationId));
    }
    if (state != AppLifecycleState.resumed) _refresh?.cancel();
    if (state == AppLifecycleState.resumed && widget.enabled) {
      _refresh?.cancel();
      _refresh = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _run(() => _api.status(widget.consultationId)),
      );
    }
  }

  @override
  void dispose() {
    _refresh?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _api.close();
    super.dispose();
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() work) async {
    if (_busy || !widget.enabled) return;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final state = await work();
      if (!mounted) return;
      setState(() {
        if (state.containsKey('consentId') && _grantId != state['consentId']) {
          _requestKey = null;
          _grantId = state['consentId'] as String?;
        }
        if (state['state'] == 'REVOKED') {
          _requestKey = null;
          _grantId = null;
        }
        _state = state;
        _accepted = false;
      });
    } on ConsultationKundliException catch (e) {
      if (mounted) {
        setState(() {
          _state = null;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _state = null;
          _error = 'Unable to confirm the Kundli request. Refresh and retry.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _generate() async {
    _requestKey ??= ConsultationKundliApi.newRequestKey();
    String? saved;
    await _run(() async {
      final result = await _api.generate(widget.consultationId, _requestKey!);
      saved = result['savedRecordId'] as String?;
      return _api.status(widget.consultationId);
    });
    if (mounted && saved != null && _error.isEmpty) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) =>
              AstrologerSavedKundliDetailScreen(savedRecordId: saved!),
        ),
      );
    }
  }

  Future<void> _confirmGrant() async {
    final name = (_state?['astrologerName'] as String?)?.trim() ?? '';
    if (name.isEmpty || !_accepted || _busy) return;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Allow $name to generate your Kundli?'),
        content: const Text(
          'Use only my saved primary birth profile (birth date, time, coordinates, timezone and birth place) for this consultation. I can revoke permission at any time. Permission ends with this consultation.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Decline'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Allow'),
          ),
        ],
      ),
    );
    if (accepted == true && mounted) {
      await _run(() => _api.grant(widget.consultationId));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Consultation Kundli permission')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (!widget.enabled)
          const Text('Consultation Kundli consent is not activated.')
        else ...[
          const Text(
            'Permission applies only to your saved primary birth profile, this consultation and its named astrologer. It allows local Kundli calculation using your date of birth, birth time, birth coordinates, timezone and birth place. It ends when this consultation ends. You may revoke at any time. Existing reports keep their current ownership rules.',
          ),
          const SizedBox(height: 16),
          if (_busy) const LinearProgressIndicator(),
          if (_error.isNotEmpty)
            Text(_error, semanticsLabel: 'Kundli request error: $_error'),
          if (_state != null) Text('Permission: ${_state!['state']}'),
          if (_state?['astrologerName'] is String)
            Text('Astrologer: ${_state!['astrologerName']}'),
          if (_state?['consultationStatus'] != null)
            Text('Consultation: ${_state!['consultationStatus']}'),
          if (_state?['subscriptionStatus'] != null &&
              _state?['canGrant'] != true) ...[
            Text(
              'Professional subscription: ${_state!['subscriptionStatus']} · ₹3,500 / 365 days',
            ),
            if (_state?['subscriptionExpiresAt'] != null)
              Text('Subscription expiry: ${_state!['subscriptionExpiresAt']}'),
          ],
          if (_state?['expiresAt'] != null)
            Text('Permission deadline: ${_state!['expiresAt']}'),
          if (_state?['canGrant'] == true && _state?['state'] != 'GRANTED') ...[
            CheckboxListTile(
              value: _accepted,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _accepted = v ?? false),
              title: const Text(
                'I explicitly authorize this use of my birth details.',
              ),
            ),
            FilledButton(
              onPressed:
                  _busy ||
                      !_accepted ||
                      (_state?['astrologerName'] as String? ?? '')
                          .trim()
                          .isEmpty
                  ? null
                  : _confirmGrant,
              child: const Text('Grant permission'),
            ),
          ],
          if (_state?['canRevoke'] == true)
            OutlinedButton(
              onPressed: _busy
                  ? null
                  : () => _run(() async {
                      await _api.revoke(widget.consultationId);
                      return _api.status(widget.consultationId);
                    }),
              child: const Text('Revoke permission'),
            ),
          if (_state?['canGenerate'] == true)
            FilledButton(
              onPressed: _busy ? null : _generate,
              child: const Text('Generate local Kundli'),
            ),
          TextButton(
            onPressed: _busy
                ? null
                : () => _run(() => _api.status(widget.consultationId)),
            child: const Text('Refresh permission'),
          ),
        ],
      ],
    ),
  );
}
