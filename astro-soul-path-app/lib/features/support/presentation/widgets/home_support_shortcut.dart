import 'dart:async';
import 'package:flutter/material.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/support_api.dart';
import '../screens/assistant_support_chat_screen.dart';
import 'support_account_boundary.dart';
import 'support_failure.dart';

/// Additional Home entry point; existing support menus remain unchanged.
class HomeSupportShortcut extends StatefulWidget {
  const HomeSupportShortcut({super.key});
  // Process-local only: a new app process may show the welcome again.
  static bool _welcomeClaimed = false;
  @visibleForTesting
  static void resetWelcomeForTesting() => _welcomeClaimed = false;
  @override
  State<HomeSupportShortcut> createState() => _HomeSupportShortcutState();
}

class _HomeSupportShortcutState extends State<HomeSupportShortcut>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _welcome = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 350),
  );
  Timer? _welcomeTimer;
  bool _bubbleMounted = false;
  bool _welcomeScheduled = false;
  bool get _reducedMotion =>
      MediaQuery.disableAnimationsOf(context) ||
      MediaQuery.accessibleNavigationOf(context);

  void _scheduleWelcome() {
    if (_welcomeScheduled || HomeSupportShortcut._welcomeClaimed) return;
    _welcomeScheduled = true;
    HomeSupportShortcut._welcomeClaimed = true;
    _welcomeTimer = Timer(const Duration(seconds: 1), () async {
      if (!mounted || !_foreground || _hidden) return;
      setState(() => _bubbleMounted = true);
      if (_reducedMotion) {
        _welcome.value = 1;
      } else {
        try {
          await _welcome.forward().orCancel;
        } on TickerCanceled {
          return;
        }
      }
      if (!mounted) return;
      _welcomeTimer = Timer(const Duration(seconds: 3), _dismissWelcome);
    });
  }

  Future<void> _dismissWelcome() async {
    if (!mounted) return;
    if (!_reducedMotion) {
      try {
        await _welcome.reverse().orCancel;
      } on TickerCanceled {
        return;
      }
    }
    if (mounted) setState(() => _bubbleMounted = false);
  }

  late final AnimationController _motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 20),
  );
  bool _foreground = true;
  bool _hidden = false;
  final _accountRevision = AuthSessionStore.sessionRevision;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadVisibility();
  }

  Future<void> _loadVisibility() async {
    SupportApi? api;
    try {
      final session = await AuthSessionStore().read();
      if (!mounted ||
          session == null ||
          _accountRevision != AuthSessionStore.sessionRevision) {
        return;
      }
      api = SupportApi(accessToken: session.accessToken);
      final config = await api.getAssistantConfig();
      if (mounted && _accountRevision == AuthSessionStore.sessionRevision) {
        setState(() => _hidden = !config.visible);
      }
    } catch (_) {
      /* Optional config must not remove existing support access on network failure. */
    } finally {
      api?.close();
    }
  }

  void _sync() {
    if (!mounted) return;
    final run =
        _foreground &&
        !MediaQuery.disableAnimationsOf(context) &&
        !MediaQuery.accessibleNavigationOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (run && !_motion.isAnimating) _motion.repeat(reverse: true);
    if (!run && _motion.isAnimating) _motion.stop();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
    _scheduleWelcome();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _welcomeTimer?.cancel();
    _welcome.dispose();
    _motion.dispose();
    super.dispose();
  }

  bool _open = false;
  Future<void> _show() async {
    if (_open) return;
    setState(() => _open = true);
    try {
      await showModalBottomSheet<void>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        showDragHandle: false,
        backgroundColor: Colors.transparent,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .55,
        ),
        builder: (_) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(26),
            child: const SupportAccountBoundary(child: SupportWelcomeScreen()),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _open = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hidden) return const SizedBox.shrink();
    return SizedBox(
      width: _bubbleMounted
          ? (MediaQuery.sizeOf(context).width - 32).clamp(60, 270)
          : 60,
      height: _bubbleMounted
          ? (MediaQuery.textScalerOf(context).scale(13) * 3.6 + 16).clamp(
              60,
              150,
            )
          : 60,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (_bubbleMounted)
            Flexible(
              child: FadeTransition(
                opacity: _welcome,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(.05, .03),
                    end: Offset.zero,
                  ).animate(_welcome),
                  child: Material(
                    color: const Color(0xFFFFFAF0),
                    borderRadius: BorderRadius.circular(22),
                    child: InkWell(
                      onTap: _open ? null : _show,
                      borderRadius: BorderRadius.circular(22),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Text(
                          'Need Help? Ask Me! 👋',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFF35204F),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (_bubbleMounted) const SizedBox(width: 8),
          _avatar(context),
        ],
      ),
    );
  }

  Widget _avatar(BuildContext context) => SizedBox(
    width: 60,
    height: 60,
    child: Tooltip(
      message: 'AI Support',
      child: Semantics(
        button: true,
        label: 'AI Support',
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _open ? null : _show,
          child: RepaintBoundary(
            child: AnimatedBuilder(
              animation: _motion,
              builder: (context, child) => DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0x303D205D),
                      blurRadius: 5 + 2 * _motion.value,
                    ),
                  ],
                ),
                child: child,
              ),
              child: const SupportAstrologerPortrait(),
            ),
          ),
        ),
      ),
    ),
  );
}

class SupportWelcomeScreen extends StatefulWidget {
  const SupportWelcomeScreen({super.key});
  @override
  State<SupportWelcomeScreen> createState() => _SupportWelcomeScreenState();
}

class _SupportWelcomeScreenState extends State<SupportWelcomeScreen> {
  bool _opening = false;
  String? _error;
  SupportFailure? _failure;
  final _revision = AuthSessionStore.sessionRevision;

  Future<void> _destination() async {
    if (_opening || _revision != AuthSessionStore.sessionRevision) return;
    setState(() {
      _opening = true;
      _error = null;
      _failure = null;
    });
    SupportApi? api;
    try {
      {
        final session = await AuthSessionStore().read();
        if (!mounted || _revision != AuthSessionStore.sessionRevision) return;
        if (session == null || session.accessToken.trim().isEmpty) {
          throw const SupportApiException(
            'Please log in again to access support.',
          );
        }
        api = SupportApi(accessToken: session.accessToken);
      }
      if (!mounted || _revision != AuthSessionStore.sessionRevision) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => AssistantSupportChatScreen(api: api!),
        ),
      );
    } catch (error) {
      if (mounted) {
        setState(() {
          _failure = SupportFailure.from(error);
          _error = _failure!.message;
        });
      }
    } finally {
      api?.close();
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: const Color(0xFFFBF7EF),
      borderRadius: BorderRadius.circular(26),
      border: Border.all(color: const Color(0xFFD9BD80)),
      boxShadow: const [BoxShadow(color: Color(0x2635204F), blurRadius: 18)],
    ),
    child: Material(
      borderRadius: BorderRadius.circular(26),
      color: const Color(0xFFFBF7EF),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.only(left: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF35204F), Color(0xFF72508D)],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  const SizedBox(
                    width: 36,
                    height: 36,
                    child: SupportAstrologerPortrait(),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'AI Support',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFFFF8E9),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close AI Support',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Color(0xFFFFF8E9)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'A little guidance, whenever you need it.',
              style: TextStyle(
                fontSize: 16,
                height: 1.4,
                color: Color(0xFF62516A),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
              leading: const Icon(Icons.auto_awesome, color: Color(0xFF826120)),
              title: const Text(
                'Chat with AI Assistant',
                style: TextStyle(
                  color: Color(0xFF35204F),
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: const Text(
                'Instant help, anytime',
                style: TextStyle(color: Color(0xFF62516A)),
              ),
              trailing: const Icon(
                Icons.arrow_forward,
                color: Color(0xFF826120),
              ),
              onTap: _opening ? null : _destination,
            ),
            if (_opening) const LinearProgressIndicator(),
            if (_error != null)
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFF9E2439)),
                ),
              ),
            if (_failure?.requiresCustomerLogin == true)
              const CustomerSupportRecoveryButton(),
          ],
        ),
      ),
    ),
  );
}

/// Bundled illustration; never substitutes a real astrologer's profile photo.
class SupportAstrologerPortrait extends StatelessWidget {
  const SupportAstrologerPortrait({super.key});
  @override
  Widget build(BuildContext context) => ClipOval(
    child: Image.asset(
      'assets/stickers/support_astrologer.webp',
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const ColoredBox(
        color: Color(0xFF35204F),
        child: Icon(Icons.auto_awesome, color: Color(0xFFE5CA8A)),
      ),
    ),
  );
}
