import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'kundli_assistant_design.dart';

const _ink = Color(0xFF273047);
const _gold = Color(0xFF997124);

class PremiumKundliAiPresentation extends StatelessWidget {
  const PremiumKundliAiPresentation({
    super.key,
    this.design = marriageAssistant,
    this.onBirthDetails,
    required this.controller,
    required this.messages,
    required this.sending,
    required this.grounded,
    required this.onSend,
    required this.onRetry,
    this.error,
    this.freeChat,
  });
  final KundliAssistantDesign design;
  final VoidCallback? onBirthDetails;
  final TextEditingController controller;
  final List<({String text, bool fromUser})> messages;
  final bool sending;
  final bool? grounded;
  final VoidCallback onSend, onRetry;
  final String? error;
  final Widget? freeChat;
  List<String> get _questions => design.questions;
  void _choose(String text) {
    controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  @override
  Widget build(BuildContext context) => Theme(
    data: Theme.of(context),
    child: Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        title: Text('Kundli AI · ${design.title}', softWrap: true),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(18),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  PremiumCelestialHero(
                    key: ValueKey(design.id),
                    design: design,
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    liveRegion: true,
                    child: _panel(
                      context,
                      child: Text(
                        grounded == true
                            ? '✓ Kundli context confirmed by the latest AI response'
                            : grounded == false
                            ? 'Latest response did not confirm Kundli grounding'
                            : 'Kundli context not yet verified. Checked when you ask.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ),
                  if (grounded != true && onBirthDetails != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: onBirthDetails,
                        icon: const Icon(Icons.assignment_outlined),
                        label: const Text('Review my birth details'),
                      ),
                    ),
                  const SizedBox(height: 22),
                  _title(context, '${design.title} Insights'),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final single =
                          constraints.maxWidth < 300 ||
                          MediaQuery.textScalerOf(context).scale(1) > 1.4;
                      final topics = design.topics;
                      return Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: List.generate(
                          4,
                          (i) => SizedBox(
                            width: single
                                ? constraints.maxWidth
                                : (constraints.maxWidth - 12) / 2,
                            child: _panel(
                              context,
                              child: TextButton(
                                onPressed: sending
                                    ? null
                                    : () => _choose(
                                        _questions[design
                                            .topicQuestionIndices[i]],
                                      ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(design.icon, color: _gold),
                                    const SizedBox(height: 10),
                                    Text(
                                      topics[i],
                                      style: TextStyle(
                                        color: Theme.of(
                                          context,
                                        ).colorScheme.onSurface,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 22),
                  _title(context, 'Popular Questions'),
                  for (final question in _questions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: OutlinedButton(
                        onPressed: sending ? null : () => _choose(question),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Theme.of(
                            context,
                          ).colorScheme.onSurface,
                          alignment: Alignment.centerLeft,
                          minimumSize: const Size.fromHeight(48),
                          padding: const EdgeInsets.all(14),
                          side: const BorderSide(color: Color(0xFFE1D0AD)),
                        ),
                        child: Text(question),
                      ),
                    ),
                  ?freeChat,
                  const SizedBox(height: 18),
                  _title(context, 'Your conversation'),
                  if (messages.isEmpty)
                    _panel(
                      context,
                      child: Text(
                        'Choose a question or write below. Astrology offers perspective, not certainty.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          height: 1.6,
                        ),
                      ),
                    ),
                  for (final message in messages)
                    Align(
                      alignment: message.fromUser
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _panel(
                          context,
                          color: message.fromUser
                              ? Theme.of(
                                  context,
                                ).colorScheme.surfaceContainerHighest
                              : Theme.of(context).colorScheme.surface,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                message.fromUser ? 'You' : 'ASP AI',
                                style: const TextStyle(
                                  color: _gold,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              SelectableText(
                                message.text,
                                style: TextStyle(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurface,
                                  height: 1.6,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  if (sending)
                    _panel(
                      context,
                      child: Semantics(
                        liveRegion: true,
                        child: Row(
                          children: [
                            if (!MediaQuery.disableAnimationsOf(context))
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: _gold,
                                ),
                              )
                            else
                              const Icon(Icons.more_horiz, color: _gold),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Preparing your guidance…',
                                style: TextStyle(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurface,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (error != null)
                    _panel(
                      context,
                      child: Column(
                        children: [
                          Text(
                            error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          TextButton.icon(
                            onPressed: sending ? null : onRetry,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      enabled: !sending,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1200,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) {
                        if (!sending && controller.text.trim().isNotEmpty) {
                          onSend();
                        }
                      },
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: 'Ask about ${design.title}…',
                        filled: true,
                        fillColor: Theme.of(context).colorScheme.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (_, value, _) => IconButton.filled(
                      tooltip: 'Send question',
                      style: IconButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Theme.of(
                          context,
                        ).colorScheme.onPrimary,
                        minimumSize: const Size(48, 48),
                      ),
                      onPressed: sending || value.text.trim().isEmpty
                          ? null
                          : onSend,
                      icon: const Icon(Icons.arrow_upward),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _title(BuildContext context, String value) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: Text(
    value,
    style: TextStyle(
      color: Theme.of(context).colorScheme.onSurface,
      fontSize: 21,
      fontWeight: FontWeight.w700,
    ),
  ),
);
Widget _panel(BuildContext context, {required Widget child, Color? color}) =>
    Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: (color ?? Theme.of(context).colorScheme.surface).withValues(
          alpha: .92,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE8DCC7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A997124),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );

class PremiumCelestialHero extends StatefulWidget {
  const PremiumCelestialHero({super.key, this.design = marriageAssistant});
  final KundliAssistantDesign design;
  @override
  State<PremiumCelestialHero> createState() => _PremiumCelestialHeroState();
}

class _PremiumCelestialHeroState extends State<PremiumCelestialHero>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  List<String> get messages => widget.design.messages;
  late final AnimationController _motion;
  Timer? _timer;
  bool _reduced = true, _active = true;
  int _index = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    _configure();
  }

  void _configure() {
    _timer?.cancel();
    if (_reduced || !_active) {
      _motion.stop();
      return;
    }
    _motion.repeat(reverse: true);
    _timer = Timer.periodic(const Duration(milliseconds: 4500), (_) {
      if (mounted) setState(() => _index = (_index + 1) % 6);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active = state == AppLifecycleState.resumed;
    _configure();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _motion.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _panel(
    context,
    child: Column(
      children: [
        RepaintBoundary(
          child: SizedBox(
            width: 140,
            height: 100,
            child: CustomPaint(
              painter: _Orbit(_motion),
              child: widget.design.id == 'marriage'
                  ? CustomPaint(painter: _Rings(_motion))
                  : ScaleTransition(
                      scale: Tween<double>(
                        begin: .96,
                        end: 1.02,
                      ).animate(_motion),
                      child: Icon(widget.design.icon, size: 64, color: _gold),
                    ),
            ),
          ),
        ),
        Text(
          widget.design.heroTitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 27,
            height: 1.2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 14),
        AnimatedSwitcher(
          duration: Duration(milliseconds: _reduced ? 0 : 450),
          layoutBuilder: (current, previous) => LayoutBuilder(
            builder: (context, constraints) {
              var height = 0.0;
              for (final message in messages) {
                final painter = TextPainter(
                  text: TextSpan(
                    text: message,
                    style: DefaultTextStyle.of(context).style.merge(
                      TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        height: 1.5,
                      ),
                    ),
                  ),
                  textDirection: Directionality.of(context),
                  textScaler: MediaQuery.textScalerOf(context),
                )..layout(maxWidth: constraints.maxWidth);
                if (painter.height > height) height = painter.height;
                painter.dispose();
              }
              return SizedBox(
                height: height,
                child: Stack(
                  alignment: Alignment.center,
                  children: [...previous, ?current],
                ),
              );
            },
          ),
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0, .08),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          ),
          child: Text(
            messages[_index],
            key: ValueKey(_index),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              height: 1.5,
            ),
          ),
        ),
        Wrap(
          alignment: WrapAlignment.center,
          children: List.generate(
            6,
            (i) => Semantics(
              selected: i == _index,
              child: IconButton(
                tooltip: '${widget.design.title} insight ${i + 1} of 6',
                onPressed: () {
                  setState(() => _index = i);
                  _configure();
                },
                constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                icon: Icon(
                  Icons.circle,
                  size: i == _index ? 8 : 5,
                  color: i == _index ? _gold : const Color(0xFFD8CBB9),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _Orbit extends CustomPainter {
  _Orbit(this.motion) : super(repaint: motion);
  final Animation<double> motion;
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = _gold.withValues(alpha: .22)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .8;
    canvas.drawOval(
      Rect.fromCenter(
        center: center,
        width: size.width - 5,
        height: size.height * .66,
      ),
      paint,
    );
    final angle = motion.value * math.pi * 2;
    canvas.drawCircle(
      center +
          Offset(
            math.cos(angle) * (size.width - 5) / 2,
            math.sin(angle) * size.height * .33,
          ),
      2,
      Paint()..color = _gold.withValues(alpha: .65),
    );
  }

  @override
  bool shouldRepaint(covariant _Orbit oldDelegate) =>
      oldDelegate.motion != motion;
}

class _Rings extends CustomPainter {
  _Rings(this.motion) : super(repaint: motion);
  final Animation<double> motion;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = _gold;
    canvas.drawCircle(const Offset(55, 55), 26, paint);
    canvas.drawCircle(const Offset(85, 55), 26, paint..color = _ink);
    final x = 65 + motion.value * 10;
    paint
      ..color = _gold
      ..strokeWidth = 1.5;
    canvas.drawLine(Offset(x, 8), Offset(x, 24), paint);
    canvas.drawLine(Offset(x - 8, 16), Offset(x + 8, 16), paint);
  }

  @override
  bool shouldRepaint(covariant _Rings oldDelegate) =>
      oldDelegate.motion != motion;
}
