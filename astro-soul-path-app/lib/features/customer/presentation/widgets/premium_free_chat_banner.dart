import 'package:flutter/material.dart';
import '../../../../core/widgets/golden_sparkle_loading.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/free_chat_entitlement_api.dart';
import '../../data/free_chat_promotion_session.dart';

class FreeChatBannerDesign {
  const FreeChatBannerDesign(this.id, this.name, this.background, this.ink);
  final String id, name;
  final Color background, ink;
  String get asset => 'assets/images/free_chat_stickers/premium_$id.webp';
  static const values = [
    FreeChatBannerDesign(
      'royal',
      'Royal Purple Welcome Offer',
      Color(0xFF392046),
      Color(0xFFFFF6E5),
    ),
    FreeChatBannerDesign(
      'ivory',
      'Ivory Divine Guidance',
      Color(0xFFFFF8E8),
      Color(0xFF382145),
    ),
    FreeChatBannerDesign(
      'rose',
      'Pink-Gold Welcome',
      Color(0xFFF9E8EC),
      Color(0xFF47203D),
    ),
    FreeChatBannerDesign(
      'vedic',
      'Vedic Expert',
      Color(0xFF271B42),
      Color(0xFFFFF6E5),
    ),
    FreeChatBannerDesign(
      'namaste',
      'Namaste Welcome',
      Color(0xFFFCEDCF),
      Color(0xFF462D31),
    ),
    FreeChatBannerDesign(
      'modern',
      'Modern Astrology Guidance',
      Color(0xFFF3ECF6),
      Color(0xFF352344),
    ),
  ];
}

/// One inline promotion, never a modal or a grant of free-chat eligibility.
/// Portraits are explicitly fictional models; selection uses real discovery.
class PremiumFreeChatBanner extends StatefulWidget {
  const PremiumFreeChatBanner({
    super.key,
    required this.entitlement,
    required this.session,
    required this.onContinue,
    this.api,
  });
  final FreeChatEntitlement? entitlement;
  final FreeChatPromotionSession session;
  final Future<void> Function(FreeChatEntitlement fresh) onContinue;
  final FreeChatEntitlementApi? api;
  @override
  State<PremiumFreeChatBanner> createState() => _PremiumFreeChatBannerState();
}

class _PremiumFreeChatBannerState extends State<PremiumFreeChatBanner> {
  late final _api = widget.api ?? FreeChatEntitlementApi();
  late final bool _claimed =
      widget.entitlement != null && widget.session.claimPresentation();
  bool _busy = false, _invalid = false;
  bool get _eligible {
    final e = widget.entitlement;
    return _claimed &&
        !_invalid &&
        !widget.session.dismissed &&
        e != null &&
        e.eligible &&
        !e.used &&
        e.minutes > 0 &&
        e.canPresent &&
        e.revision == AuthSessionStore.sessionRevision;
  }

  Future<void> _open() async {
    if (_busy || !_eligible) return;
    final owner = widget.entitlement!;
    setState(() => _busy = true);
    try {
      final fresh = await _api.fetch();
      if (!mounted || widget.session.dismissed) return;
      if (fresh == null ||
          fresh.userId != owner.userId ||
          fresh.revision != owner.revision ||
          fresh.revision != AuthSessionStore.sessionRevision ||
          !fresh.eligible ||
          fresh.used ||
          fresh.minutes <= 0 ||
          !fresh.canPresent) {
        setState(() => _invalid = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'The Free Chat offer is not available right now. No chat has started.',
            ),
          ),
        );
        return;
      }
      await widget.onContinue(fresh);
    } catch (_) {
      if (!mounted) return;
      setState(() => _invalid = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Unable to verify the offer. Please try again from astrologer discovery.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    if (widget.api == null) _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_eligible) return const SizedBox.shrink();
    final design = FreeChatBannerDesign.values[widget.session.offset % 6];
    final reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: reduced ? 1 : 0, end: 1),
        duration: reduced ? Duration.zero : const Duration(milliseconds: 350),
        builder: (context, value, child) => Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 6),
            child: child,
          ),
        ),
        child: Material(
          color: design.background,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFFD7B46C)),
          ),
          elevation: 3,
          shadowColor: const Color(0x223A214B),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 42, 14, 14),
                child: InkWell(
                  onTap: _busy ? null : _open,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final stacked =
                          constraints.maxWidth < 290 ||
                          MediaQuery.textScalerOf(context).scale(14) > 20;
                      final portrait = Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Image.asset(
                              design.asset,
                              width: stacked ? 130 : 100,
                              height: stacked ? 150 : 156,
                              cacheWidth: 360,
                              fit: BoxFit.cover,
                              alignment: const Alignment(0, -.25),
                              excludeFromSemantics: true,
                              errorBuilder: (_, _, _) =>
                                  const SizedBox(width: 100, height: 156),
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            'Illustrative model',
                            style: TextStyle(color: design.ink, fontSize: 10),
                          ),
                        ],
                      );
                      final content = Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'WELCOME OFFER',
                            style: TextStyle(
                              color: design.ink,
                              fontSize: 10,
                              letterSpacing: 1,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Your First ${widget.entitlement!.minutes} Min Chat is FREE',
                            style: TextStyle(
                              color: design.ink,
                              fontSize: 20,
                              height: 1.2,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Choose an available verified astrologer',
                            style: TextStyle(
                              color: design.ink,
                              fontSize: 12,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: _busy ? null : _open,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFFE9C16C),
                              foregroundColor: const Color(0xFF35203F),
                              minimumSize: const Size(120, 48),
                            ),
                            child: const Text('Chat Now →'),
                          ),
                        ],
                      );
                      return AbsorbPointer(
                        absorbing: _busy,
                        child: stacked
                            ? Column(
                                children: [
                                  portrait,
                                  const SizedBox(height: 14),
                                  content,
                                ],
                              )
                            : Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  portrait,
                                  const SizedBox(width: 14),
                                  Expanded(child: content),
                                ],
                              ),
                      );
                    },
                  ),
                ),
              ),
              if (_busy)
                const Positioned.fill(
                  child: IgnorePointer(child: Center(child: GoldenSparkle())),
                ),
              Positioned(
                right: 0,
                top: 0,
                child: IconButton(
                  tooltip: 'Close Free Chat offer',
                  onPressed: () {
                    setState(widget.session.dismiss);
                  },
                  icon: Icon(Icons.close, color: design.ink),
                  constraints: const BoxConstraints(
                    minWidth: 48,
                    minHeight: 48,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
