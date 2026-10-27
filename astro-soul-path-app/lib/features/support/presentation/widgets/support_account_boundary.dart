import 'dart:async';
import 'package:flutter/material.dart';
import '../../../auth/data/auth_session_store.dart';

/// Local account-switch fence, independent of notification/provider availability.
class SupportAccountBoundary extends StatefulWidget {
  const SupportAccountBoundary({required this.child, super.key});
  final Widget child;
  @override
  State<SupportAccountBoundary> createState() => _SupportAccountBoundaryState();
}

class _SupportAccountBoundaryState extends State<SupportAccountBoundary>
    with WidgetsBindingObserver {
  final revision = AuthSessionStore.sessionRevision;
  Timer? watch;
  bool blocked = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    watch = Timer.periodic(const Duration(milliseconds: 250), (_) => check());
  }

  void check() {
    if (!blocked && revision != AuthSessionStore.sessionRevision && mounted) {
      setState(() => blocked = true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) check();
  }

  @override
  void dispose() {
    watch?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (blocked || revision != AuthSessionStore.sessionRevision) {
      return const Scaffold(
        body: SafeArea(
          child: Center(
            child: Text('Your account changed. Reopen Help & Support.'),
          ),
        ),
      );
    }
    return widget.child;
  }
}
