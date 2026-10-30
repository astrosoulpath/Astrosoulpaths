import 'dart:async';
import 'package:flutter/material.dart';
import '../../auth/data/auth_session_store.dart';

/// Private marketplace screens belong to the session that opened them.
/// Clears rendered private content within 500 ms, and on foreground recovery.
/// API clients independently reject requests/responses across account changes.
abstract class MarketplacePrivateState<T extends StatefulWidget>
    extends State<T>
    with WidgetsBindingObserver {
  int get sessionRevision => AuthSessionStore.sessionRevision;
  late final int _revision;
  Timer? _sessionTimer;
  bool _locked = false;
  @override
  void initState() {
    super.initState();
    _revision = sessionRevision;
    WidgetsBinding.instance.addObserver(this);
    _sessionTimer = Timer.periodic(
      const Duration(milliseconds: 500),
      (_) => _checkSession(),
    );
  }

  void _checkSession() {
    if (mounted && !_locked && _revision != sessionRevision) {
      setState(() => _locked = true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkSession();
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Widget buildMarketplace(BuildContext context);
  @override
  Widget build(BuildContext context) {
    if (_locked || _revision != sessionRevision) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(title: const Text('Soul Bazaar')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Your account changed. Close this screen and reopen Soul Bazaar.',
            ),
          ),
        ),
      );
    }
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: Theme.of(context).colorScheme,
        scaffoldBackgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBarTheme: AppBarTheme(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          foregroundColor: Theme.of(context).colorScheme.onSurface,
        ),
      ),
      child: Builder(builder: buildMarketplace),
    );
  }
}
