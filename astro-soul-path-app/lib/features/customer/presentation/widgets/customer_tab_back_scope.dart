import 'package:flutter/material.dart';

/// Back from a non-home tab returns Home before leaving the customer shell.
class CustomerTabBackScope extends StatelessWidget {
  const CustomerTabBackScope({
    super.key,
    required this.index,
    required this.onHome,
    required this.child,
  });
  final int index;
  final VoidCallback onHome;
  final Widget child;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: index == 0,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop && index != 0) onHome();
    },
    child: child,
  );
}
