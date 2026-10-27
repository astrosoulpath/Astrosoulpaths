import 'package:flutter/material.dart';
import '../../data/free_chat_promotion_session.dart';
import '../../data/free_chat_selection.dart';
export '../../data/free_chat_selection.dart';
import '../../../astrologers/data/public_astrologer.dart';
import '../../../astrologers/presentation/widgets/astrologer_default_avatar.dart';

class FreeChatAvatars extends StatefulWidget {
  const FreeChatAvatars({
    super.key,
    required this.records,
    required this.onSelect,
    this.presentModal = false,
    this.onPresented,
    this.promotionSession,
  });
  final List<PublicAstrologer> records;
  final Future<void> Function(PublicAstrologer) onSelect;
  final bool presentModal;
  final VoidCallback? onPresented;
  final FreeChatPromotionSession? promotionSession;

  @override
  State<FreeChatAvatars> createState() => _FreeChatAvatarsState();
}

class _FreeChatAvatarsState extends State<FreeChatAvatars> {
  // Chosen once for this mounted promotion; rebuilding never reshuffles it.
  late final int offset = DateTime.now().microsecondsSinceEpoch;
  bool opening = false;
  Route<void>? _offerRoute;
  List<PublicAstrologer> get selected =>
      widget.promotionSession?.select(widget.records) ??
      selectFreeChatAstrologers(widget.records, offset);

  @override
  void initState() {
    super.initState();
    if (widget.presentModal) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _present());
    }
  }

  Future<void> _present() async {
    if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
    if (widget.promotionSession?.claimPresentation() == false) return;
    widget.onPresented?.call();
    final selected = List<PublicAstrologer>.of(this.selected);
    PublicAstrologer? choice;
    final route = DialogRoute<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: const Color(0xFFFFFBF2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFFD8BB80)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  tooltip: 'Close Free Chat offer',
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                ),
              ),
              FreeChatAvatars(
                records: selected,
                onSelect: (a) async {
                  choice = a;
                  Navigator.of(dialogContext).pop();
                },
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: FilledButton(
                  onPressed: selected.isEmpty
                      ? null
                      : () {
                          choice = selected.first;
                          Navigator.of(dialogContext).pop();
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF172842),
                    foregroundColor: const Color(0xFFFFFBF2),
                  ),
                  child: const Text('Start Free Chat'),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Maybe Later'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    _offerRoute = route;
    await Navigator.of(context).push(route);
    _offerRoute = null;
    if (!mounted || choice == null || opening) return;
    setState(() => opening = true);
    try {
      await widget.onSelect(choice!);
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = this.selected;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text(
            'Your First Chat Is On Us',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 22),
          ),
          const Text('Connect with a trusted astrologer.'),
          const SizedBox(height: 12),
          if (selected.isEmpty)
            const Text('No eligible astrologers are available right now.')
          else
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 12,
              children: selected
                  .map(
                    (a) => SizedBox(
                      width: 76,
                      child: TextButton(
                        onPressed: opening
                            ? null
                            : () async {
                                setState(() => opening = true);
                                try {
                                  await widget.onSelect(a);
                                } finally {
                                  if (mounted) setState(() => opening = false);
                                }
                              },
                        child: Column(
                          children: [
                            SizedBox(
                              width: 52,
                              height: 52,
                              child: ClipOval(
                                child: AstrologerDefaultAvatar(
                                  astrologerId: a.id,
                                ),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              a.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  @override
  void didUpdateWidget(FreeChatAvatars oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.presentModal && oldWidget.presentModal) _dismissOffer();
  }

  void _dismissOffer() {
    final route = _offerRoute;
    if (route != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final navigator = route.navigator;
        if (route.isActive && navigator != null && navigator.mounted) {
          navigator.removeRoute(route);
        }
      });
    }
  }

  @override
  void dispose() {
    _dismissOffer();
    super.dispose();
  }
}
