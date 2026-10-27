import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../auth/data/auth_session_store.dart';
import '../../../auth/data/secure_logout.dart';
import '../../../auth/data/auth_portal.dart';
import '../../../auth/presentation/screens/login_screen.dart';
import '../../data/support_api.dart';

enum SupportFailureKind {
  authentication,
  adminIdentity,
  authorization,
  network,
  unavailable,
  service,
}

class SupportFailure {
  const SupportFailure(this.kind, this.title, this.message);
  final SupportFailureKind kind;
  final String title, message;
  bool get requiresCustomerLogin =>
      kind == SupportFailureKind.authentication ||
      kind == SupportFailureKind.adminIdentity;
  factory SupportFailure.from(Object error) {
    if (error is SupportApiException) {
      if (error.statusCode == 403 &&
          const [
            'Admin identity is not authorized',
            'Admin authentication is not configured',
            'An existing active Admin mapping is required',
          ].contains(error.message)) {
        return const SupportFailure(
          SupportFailureKind.adminIdentity,
          'Customer sign-in required',
          'The backend rejected this Admin identity. Opening the Customer app does not change its account role. Sign in with an existing authorized customer account; no permissions have been changed.',
        );
      }
      if (error.statusCode == 401 ||
          error.message.startsWith('Please sign') ||
          error.message.startsWith('Please log in') ||
          error.message.startsWith('Your account changed')) {
        return const SupportFailure(
          SupportFailureKind.authentication,
          'Verify your customer session',
          'Your support session could not be verified. Sign in again with the authorized customer account.',
        );
      }
      if (error.statusCode == 403)
        return const SupportFailure(
          SupportFailureKind.authorization,
          'Access denied',
          'This account is not authorized to access this support request.',
        );
      if (error.statusCode == 503 ||
          error.message.startsWith('AI support is temporarily unavailable'))
        return const SupportFailure(
          SupportFailureKind.unavailable,
          'Support temporarily unavailable',
          'The service is unavailable right now. Retry shortly, or use the existing Help & Support menu.',
        );
    }
    if (error is TimeoutException ||
        error is SocketException ||
        error is http.ClientException)
      return const SupportFailure(
        SupportFailureKind.network,
        'Connection problem',
        'Support could not be reached. Check your connection and retry.',
      );
    return const SupportFailure(
      SupportFailureKind.service,
      'Support request not completed',
      'Support could not complete this request. Please retry.',
    );
  }
}

/// No action on build. Existing logout is invoked only after explicit confirmation.
class CustomerSupportRecoveryButton extends StatefulWidget {
  const CustomerSupportRecoveryButton({
    super.key,
    this.signOut,
    this.onSignedOut,
  });
  final Future<void> Function()? signOut;
  final VoidCallback? onSignedOut;
  @override
  State<CustomerSupportRecoveryButton> createState() =>
      _CustomerSupportRecoveryButtonState();
}

class _CustomerSupportRecoveryButtonState
    extends State<CustomerSupportRecoveryButton> {
  bool _busy = false;
  bool _prompting = false;
  Future<void> _recover() async {
    if (_busy || _prompting) return;
    _prompting = true;
    bool? confirmed;
    try {
      confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Choose a customer account?'),
          content: const Text(
            'This signs out the current account on this device. Continue only with an existing authorized customer account. It does not change roles, create accounts or link identities.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign out and continue'),
            ),
          ],
        ),
      );
    } finally {
      _prompting = false;
    }
    if (confirmed != true || !mounted) return;
    // The account boundary may dispose this button as logout clears the session.
    // Retain the existing root navigator, never a disposed BuildContext.
    final navigator = Navigator.of(context, rootNavigator: true);
    final onSignedOut = widget.onSignedOut;
    setState(() => _busy = true);
    try {
      await (widget.signOut ?? () => secureLogout(AuthSessionStore()))();
      if (onSignedOut != null) {
        if (mounted) onSignedOut();
      } else if (navigator.mounted) {
        navigator.pushAndRemoveUntil(
          MaterialPageRoute<void>(
            builder: (_) => const LoginScreen(portal: AuthPortal.customer),
          ),
          (_) => false,
        );
      }
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Complete sign-out could not be confirmed. Retry the existing Logout flow before signing in.',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => TextButton.icon(
    onPressed: _busy ? null : _recover,
    icon: const Icon(Icons.login),
    label: Text(_busy ? 'Signing out…' : 'Use a customer account'),
  );
}
