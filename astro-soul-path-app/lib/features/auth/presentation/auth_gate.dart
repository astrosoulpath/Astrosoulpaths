import 'package:flutter/material.dart';

import '../../astrologer/presentation/screens/astrologer_dashboard_screen.dart';
import '../../customer/presentation/screens/customer_shell_screen.dart';
import '../data/auth_session_store.dart';
import 'screens/welcome_screen.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final _sessionStore = AuthSessionStore();

  StoredAuthSession? _session;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      final session = await _sessionStore.read();

      if (!mounted) {
        return;
      }

      setState(() {
        _session = session;
        _isLoading = false;
      });
    } catch (_) {
      await _sessionStore.clear();

      if (!mounted) {
        return;
      }

      setState(() {
        _session = null;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final session = _session;

    // Any valid CUSTOMER session enters the customer app.
    // Profile completeness must never redirect an authenticated customer
    // back to Welcome/Login.
    if (session != null &&
        session.role == 'CUSTOMER' &&
        session.portal == 'customer') {
      return const CustomerShellScreen(initialIndex: 0);
    }

    // Astrologer dashboard is allowed only after backend explicitly
    // confirms that onboarding + admin approval are complete.
    if (session != null &&
        session.role == 'ASTROLOGER' &&
        session.portal == 'astrologer' &&
        session.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
      return const AstrologerDashboardScreen();
    }

    // No valid session -> Welcome/Login
    return const WelcomeScreen();
  }
}
