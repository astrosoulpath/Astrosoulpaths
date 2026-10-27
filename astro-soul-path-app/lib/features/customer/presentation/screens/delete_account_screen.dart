import 'package:flutter/material.dart';
import '../../../../core/theme/cosmic_ivory.dart';
import '../../../profile/data/profile_api.dart';
import '../../../support/presentation/screens/support_home_screen.dart';

/// Truthful readiness UI. Never submits a destructive or provider-side request.
class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key, this.loadReadiness});
  final Future<Map<String, dynamic>> Function()? loadReadiness;
  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _api = ProfileApi();
  bool _loading = true;
  bool _failed = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final response = await (widget.loadReadiness ?? _api.deletionReadiness)();
      final data = response['data'];
      if (response['success'] != true ||
          data is! Map ||
          data['available'] != false ||
          data['status'] != 'NOT_ENABLED') {
        throw const FormatException('Unknown deletion status');
      }
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CosmicIvory.background,
    appBar: AppBar(
      title: const Text('Delete Account'),
      backgroundColor: CosmicIvory.background,
    ),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(
            Icons.shield_outlined,
            size: 48,
            color: CosmicIvory.danger,
          ),
          const SizedBox(height: 20),
          const CosmicSection(
            title: 'Before you continue',
            child: Text(
              'Account deletion is not enabled yet. This screen does not delete your account or record a deletion request.\n\nFinancial and audit records may require retention. Active consultations, orders, disputes, subscriptions and wallet obligations need an approved resolution process. No payment will be refunded or cancelled automatically.',
              style: TextStyle(color: CosmicIvory.ink, height: 1.6),
            ),
          ),
          const SizedBox(height: 16),
          const CosmicSection(
            title: 'Secure account ownership',
            child: Text(
              'A supported deletion workflow must verify your identity again, protect Admin access, revoke sessions and coordinate authentication-provider cleanup. Never share a Google password with support.',
              style: TextStyle(color: CosmicIvory.ink, height: 1.6),
            ),
          ),
          const SizedBox(height: 20),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_failed) ...[
            const Text(
              'Deletion availability could not be verified. Your account has not been changed.',
              style: TextStyle(color: CosmicIvory.danger),
            ),
            TextButton(
              onPressed: _load,
              child: const Text('Retry availability check'),
            ),
          ] else
            const Text(
              'Server status: deletion not enabled. Your account remains unchanged.',
              style: TextStyle(color: CosmicIvory.muted),
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const SupportHomeScreen(),
              ),
            ),
            icon: const Icon(Icons.support_agent_outlined),
            label: const Text('Contact Support'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Keep my account'),
          ),
        ],
      ),
    ),
  );
}
