import 'package:flutter/material.dart';

/// Presentation only. The caller's verified bootstrap/AuthGate owns routing.
class BrandStartupTransition extends StatelessWidget {
  const BrandStartupTransition({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration:
        (MediaQuery.maybeOf(context)?.disableAnimations ??
            WidgetsBinding
                .instance
                .platformDispatcher
                .accessibilityFeatures
                .disableAnimations)
        ? Duration.zero
        : const Duration(milliseconds: 220),
    switchInCurve: Curves.easeOut,
    child: child,
  );
}
