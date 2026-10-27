import 'package:flutter/material.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/support_api.dart';
import '../widgets/support_account_boundary.dart';
import 'support_ticket_detail_screen.dart';

class SupportTicketEntryScreen extends StatefulWidget {
  const SupportTicketEntryScreen({required this.ticketId, super.key});
  final String ticketId;
  @override
  State<SupportTicketEntryScreen> createState() =>
      _SupportTicketEntryScreenState();
}

class _SupportTicketEntryScreenState extends State<SupportTicketEntryScreen> {
  final revision = AuthSessionStore.sessionRevision;
  SupportApi? api;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final session = await AuthSessionStore().read();
      if (!mounted || revision != AuthSessionStore.sessionRevision) return;
      if (session == null) throw StateError('No session');
      setState(() => api = SupportApi(accessToken: session.accessToken));
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Sign in again to open your support ticket.');
      }
    }
  }

  @override
  void dispose() {
    api?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SupportAccountBoundary(
    child: api != null
        ? SupportTicketDetailScreen(api: api!, ticketId: widget.ticketId)
        : Scaffold(
            body: Center(
              child: error == null
                  ? const CircularProgressIndicator()
                  : Text(error!),
            ),
          ),
  );
}
