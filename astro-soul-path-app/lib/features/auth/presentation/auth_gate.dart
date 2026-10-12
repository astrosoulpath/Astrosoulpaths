import '../../astrologer/presentation/screens/astrologer_application_screen.dart';
import 'package:flutter/material.dart';

import '../../astrologer/presentation/screens/astrologer_dashboard_screen.dart';
import '../../customer/presentation/screens/customer_shell_screen.dart';
import '../data/auth_session_store.dart';
import '../data/customer_onboarding_flow.dart';
import '../../profile/data/profile_api.dart';
import '../../customer/presentation/screens/customer_birth_onboarding_screen.dart';
import 'screens/welcome_screen.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key, this.sessionStore});
  final AuthSessionStore? sessionStore;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final _sessionStore = widget.sessionStore ?? AuthSessionStore();

  StoredAuthSession? _session;
  bool _isLoading = true;
  bool _restoreFailed = false;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    setState(() {
      _isLoading = true;
      _restoreFailed = false;
    });
    try {
      final session = await _sessionStore.restore();

      if (mounted &&
          session?.role == 'CUSTOMER' &&
          session?.portal == 'customer') {
        final profiles = ProfileApi();
        try {
          final completed = await completeCustomerOnboarding(
            sessions: _sessionStore,
            loadProfiles: profiles.getProfiles,
            showForm: (profile) async {
              if (!mounted) return false;
              return Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) =>
                      CustomerBirthOnboardingScreen(existingProfile: profile),
                ),
              );
            },
          );
          if (!completed) throw StateError('Birth profile is not complete');
        } finally {
          profiles.close();
        }
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _session = session;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _session = null;
        _restoreFailed = true;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_restoreFailed) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Unable to verify account access.'),
              TextButton(
                onPressed: _restoreSession,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
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

    if (session != null &&
        (session.portal == 'joinAstrologer' ||
            session.portal == 'astrologer')) {
      return const AstrologerApplicationScreen();
    }

    // No valid session -> Welcome/Login
    return const WelcomeScreen();
  }
}
