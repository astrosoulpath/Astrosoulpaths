import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/horoscope_api.dart';
import '../../data/today_for_you_model.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';

class DailyHoroscopeScreen extends StatefulWidget {
  const DailyHoroscopeScreen({super.key});

  @override
  State<DailyHoroscopeScreen> createState() => _DailyHoroscopeScreenState();
}

class _DailyHoroscopeScreenState extends State<DailyHoroscopeScreen> {
  final HoroscopeApi _api = HoroscopeApi();

  bool _loading = true;
  String _error = '';
  bool _subscriptionRequired = false;
  String _selectedDay = 'today';
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _loadHoroscope();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _loadHoroscope() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
        _subscriptionRequired = false;
      });
    }

    try {
      final result = await _api.getDailyHoroscope(day: _selectedDay);

      if (!mounted) return;

      setState(() {
        _data = result;
      });
    } on HoroscopeApiException catch (error) {
      if (!mounted) return;

      final message = error.message.trim();
      final subscriptionRequired =
          message.contains('DAILY_HOROSCOPE_SUBSCRIPTION_REQUIRED') ||
          message.toLowerCase().contains('subscription');

      setState(() {
        _error = message;
        _subscriptionRequired = subscriptionRequired;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _error = 'Unable to load your daily horoscope right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _selectDay(String day) async {
    if (_selectedDay == day || _loading) {
      return;
    }

    setState(() {
      _selectedDay = day;
    });

    await _loadHoroscope();
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return <String, dynamic>{};
  }

  List<dynamic> _list(dynamic value) {
    if (value is List) {
      return value;
    }

    return const <dynamic>[];
  }

  String _text(dynamic value, {String fallback = 'Currently unavailable'}) {
    final source = value?.toString().trim() ?? '';

    return source.isEmpty ? fallback : source;
  }

  String _join(dynamic value, {String fallback = 'Currently unavailable'}) {
    final values = _list(value)
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();

    if (values.isEmpty) {
      return fallback;
    }

    return values.join(', ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Daily Horoscope',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _loadHoroscope,
            icon: const Icon(Icons.refresh_rounded, color: AppColors.gold),
          ),
        ],
      ),
      body: RefreshIndicator(onRefresh: _loadHoroscope, child: _body()),
    );
  }

  Widget _daySelector() {
    const days = <String>['yesterday', 'today', 'tomorrow'];

    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF20182E), Color(0xFF15111E)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x44F4C45E)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x2B000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: days.map((day) {
          final selected = _selectedDay == day;

          final label = switch (day) {
            'yesterday' => 'Yesterday',
            'tomorrow' => 'Tomorrow',
            _ => 'Today',
          };

          return Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: _loading ? null : () => _selectDay(day),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: selected
                        ? const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFF8D978), Color(0xFFE5AA34)],
                          )
                        : null,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: selected
                          ? const Color(0xFFFFE8A8)
                          : Colors.transparent,
                    ),
                    boxShadow: selected
                        ? const [
                            BoxShadow(
                              color: Color(0x33F4C45E),
                              blurRadius: 14,
                              spreadRadius: 1,
                              offset: Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        day == 'yesterday'
                            ? Icons.west_rounded
                            : day == 'tomorrow'
                            ? Icons.east_rounded
                            : Icons.auto_awesome_rounded,
                        size: 16,
                        color: selected
                            ? const Color(0xFF291E08)
                            : AppColors.muted,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: selected
                              ? const Color(0xFF291E08)
                              : AppColors.white,
                          fontSize: 12,
                          fontWeight: selected
                              ? FontWeight.w900
                              : FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  String _selectedDayLabel() {
    return switch (_selectedDay) {
      'yesterday' => 'Yesterday',
      'tomorrow' => 'Tomorrow',
      _ => 'Today',
    };
  }

  Widget _body() {
    if (_loading) {
      return const CustomScrollView(
        physics: AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            ),
          ),
        ],
      );
    }

    if (_error.isNotEmpty) {
      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: _daySelector(),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: _subscriptionRequired
                ? _subscriptionPaywall()
                : _errorWidget(),
          ),
        ],
      );
    }

    return _content();
  }

  Widget _content() {
    final data = _data ?? <String, dynamic>{};
    final ai = _map(data['ai']);

    final todayForYou = parseTodayForYou(data);
    final user = _map(data['user']);
    final cosmic = _map(data['cosmic']);
    final tarabala = _map(cosmic['tarabala']);
    final moon = _map(data['moon']);
    final currentMoon = _map(moon['current']);
    final natalMoon = _map(moon['natal']);
    final lucky = _map(data['lucky']);
    final dailyHighlights = _map(data['dailyHighlights']);
    final guidance = _map(data['guidance']);
    final summary = _map(data['summary']);
    final lifeAreas = _list(data['lifeAreas']);

    final vedic = _map(data['vedic']);
    final dasha = _map(vedic['dasha']);
    final currentMahadasha = _map(dasha['currentMahadasha']);
    final currentAntardasha = _map(dasha['currentAntardasha']);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 36),
      children: [
        _daySelector(),
        const SizedBox(height: 16),
        if (_selectedDay == 'today' && todayForYou != null) ...[
          _todayForYouCard(todayForYou),
          const SizedBox(height: 18),
        ],

        if (ai.isNotEmpty) ...[
          _sectionTitle('${_selectedDayLabel()} Cosmic Alignment'),
          const SizedBox(height: 5),

          const Text(
            'Personalized for you',
            style: TextStyle(
              color: AppColors.muted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),

          const SizedBox(height: 14),

          _infoCard(
            icon: Icons.auto_awesome_rounded,
            title: 'DAILY PREDICTION',
            value: _text(
              ai['shortReading'],
              fallback: 'Personalized prediction is unavailable.',
            ),
          ),

          _infoCard(
            icon: Icons.lightbulb_outline_rounded,
            title: 'Actionable Tip',
            value: _text(
              ai['dailyAdvice'],
              fallback: 'No specific advice is available.',
            ),
          ),

          const SizedBox(height: 8),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _compactHighlightCard(
                  icon: Icons.sentiment_satisfied_alt_rounded,
                  title: 'Mood',
                  value: _text(ai['mood'], fallback: 'Not specified'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _compactHighlightCard(
                  icon: Icons.center_focus_strong_rounded,
                  title: 'Focus',
                  value: _text(ai['focusArea'], fallback: 'Not specified'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _compactHighlightCard(
                  icon: Icons.palette_outlined,
                  title: 'Lucky Color',
                  value: _text(ai['luckyColor'], fallback: 'Not specified'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _compactHighlightCard(
                  icon: Icons.pin_outlined,
                  title: 'Lucky No.',
                  value: _text(ai['luckyNumber'], fallback: 'Not specified'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          _sectionTitle('DO / AVOID'),
          const SizedBox(height: 10),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _infoCard(
                  icon: Icons.check_circle_outline_rounded,
                  title: 'DO',
                  value: _join(
                    ai['favorableActivities'],
                    fallback: 'No specific favorable activity identified.',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _infoCard(
                  icon: Icons.do_not_disturb_alt_rounded,
                  title: 'AVOID',
                  value: _join(
                    ai['cautionActivities'],
                    fallback: 'No specific caution activity identified.',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          _infoCard(
            icon: Icons.nightlight_round,
            title: 'Closing Insight',
            value: _text(
              ai['generalGuidance'],
              fallback: 'No additional guidance is available.',
            ),
          ),

          const SizedBox(height: 20),
        ],

        _heroCard(user, cosmic),
        const SizedBox(height: 18),

        _sectionTitle('Cosmic Overview'),
        const SizedBox(height: 10),

        _cosmicCard(cosmic, tarabala),
        const SizedBox(height: 18),

        if (currentMahadasha.isNotEmpty || currentAntardasha.isNotEmpty) ...[
          _sectionTitle('Vedic Dasha'),
          const SizedBox(height: 10),
          _vedicDashaCard(
            currentMahadasha: currentMahadasha,
            currentAntardasha: currentAntardasha,
          ),
          const SizedBox(height: 18),
        ],

        if (_text(dailyHighlights['dailyAdvice']).isNotEmpty) ...[
          _sectionTitle('Daily Advice'),
          const SizedBox(height: 10),
          _infoCard(
            icon: Icons.lightbulb_outline_rounded,
            title: 'Advice',
            value: _text(dailyHighlights['dailyAdvice']),
          ),
          const SizedBox(height: 16),
        ],

        if (_text(dailyHighlights['mood']).isNotEmpty ||
            _text(dailyHighlights['focus']).isNotEmpty) ...[
          _sectionTitle('Today Highlights'),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_text(dailyHighlights['mood']).isNotEmpty)
                Expanded(
                  child: _compactHighlightCard(
                    icon: Icons.sentiment_satisfied_alt_rounded,
                    title: 'Mood',
                    value: _text(dailyHighlights['mood']),
                  ),
                ),
              if (_text(dailyHighlights['mood']).isNotEmpty &&
                  _text(dailyHighlights['focus']).isNotEmpty)
                const SizedBox(width: 12),
              if (_text(dailyHighlights['focus']).isNotEmpty)
                Expanded(
                  child: _compactHighlightCard(
                    icon: Icons.center_focus_strong_rounded,
                    title: 'Focus',
                    value: _text(dailyHighlights['focus']),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
        ],
        _sectionTitle('${_selectedDayLabel()} Guidance'),
        const SizedBox(height: 10),

        ...lifeAreas.map((item) {
          final area = _map(item);

          return _predictionCard(
            title: _text(area['title'], fallback: 'Daily Insight'),
            description: _text(area['description']),
            emoji: _text(area['emoji'], fallback: '\u2728'),
          );
        }),

        if (lifeAreas.isEmpty)
          _infoCard(
            icon: Icons.auto_awesome_rounded,
            title: 'Daily Insight',
            value: 'Personalized prediction is currently unavailable.',
          ),

        const SizedBox(height: 4),

        _sectionTitle('Moon Energy'),
        const SizedBox(height: 10),

        _moonCard(currentMoon: currentMoon, natalMoon: natalMoon),

        const SizedBox(height: 18),

        _sectionTitle('Lucky Elements'),
        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: _compactHighlightCard(
                icon: Icons.palette_outlined,
                title: 'Lucky Colors',
                value: _join(lucky['colors']),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _compactHighlightCard(
                icon: Icons.pin_outlined,
                title: 'Lucky Numbers',
                value: _join(lucky['numbers']),
              ),
            ),
          ],
        ),

        const SizedBox(height: 4),

        _sectionTitle('Activities'),
        const SizedBox(height: 10),

        _infoCard(
          icon: Icons.thumb_up_alt_outlined,
          title: 'Favorable Activities',
          value: _join(guidance['favorableActivities']),
        ),

        _infoCard(
          icon: Icons.warning_amber_rounded,
          title: 'Activities to Avoid',
          value: _join(guidance['avoidActivities']),
        ),

        const SizedBox(height: 4),

        _sectionTitle('${_selectedDayLabel()} at a Glance'),
        const SizedBox(height: 10),

        _infoCard(
          icon: Icons.stars_rounded,
          title: 'Best For',
          value: _text(summary['bestFor']),
        ),

        _infoCard(
          icon: Icons.shield_outlined,
          title: 'Use Caution With',
          value: _text(summary['cautionFor']),
        ),
      ],
    );
  }

  Widget _todayForYouCard(TodayForYouModel today) {
    final score = today.overallScore;
    final phase = today.currentPhase.display;
    final headline = today.headline?.trim();
    final advice = today.dailyAdvice?.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.surfaceLight, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x88F4C45E)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 22,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0x20F4C45E),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.gold,
                  size: 25,
                ),
              ),
              const SizedBox(width: 13),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TODAY FOR YOU',
                      style: TextStyle(
                        color: AppColors.gold,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.1,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Your personal Vedic day',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              if (score != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x1FF4C45E),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x44F4C45E)),
                  ),
                  child: Text(
                    score % 1 == 0
                        ? score.toStringAsFixed(0)
                        : score.toStringAsFixed(1),
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
            ],
          ),

          if (headline != null && headline.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              headline,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 16,
                height: 1.45,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],

          if (phase != null && phase.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0x14000000),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.timelapse_rounded,
                    color: AppColors.gold,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Current phase  \u2022  $phase',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (advice != null && advice.isNotEmpty && advice != headline) ...[
            const SizedBox(height: 15),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.lightbulb_outline_rounded,
                  color: AppColors.gold,
                  size: 19,
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    advice,
                    style: const TextStyle(
                      color: AppColors.muted,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ],

          const SizedBox(height: 18),

          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showWhyToday(today),
                  icon: const Icon(Icons.query_stats_rounded, size: 18),
                  label: const Text('Why Today?'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.gold,
                    side: const BorderSide(color: Color(0x66F4C45E)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _showCalculationBasis(today),
                  icon: const Icon(Icons.verified_outlined, size: 18),
                  label: const Text('Vedic Basis'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.background,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _showWhyToday(TodayForYouModel today) async {
    final evidence = today.whyToday
        .where((item) => item.isUseful)
        .toList(growable: false);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: FractionallySizedBox(
            heightFactor: 0.82,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0x55FFFFFF),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded, color: AppColors.gold),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Why Today?',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'The Vedic factors used for your personal daily guidance.',
                  style: TextStyle(color: AppColors.muted, height: 1.4),
                ),

                if (evidence.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  ...evidence.map((item) => _todayEvidenceTile(item)),
                ],

                if (today.panchang.hasData) ...[
                  const SizedBox(height: 18),
                  const Text(
                    'Panchang',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (today.panchang.tithi != null)
                    _sheetDetailRow('Tithi', today.panchang.tithi!),
                  if (today.panchang.nakshatra != null)
                    _sheetDetailRow('Nakshatra', today.panchang.nakshatra!),
                  if (today.panchang.yoga != null)
                    _sheetDetailRow('Yoga', today.panchang.yoga!),
                  if (today.panchang.karana != null)
                    _sheetDetailRow('Karana', today.panchang.karana!),
                ],

                if (today.timing.hasData) ...[
                  const SizedBox(height: 18),
                  const Text(
                    'Day Timing',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (today.timing.sunrise != null)
                    _sheetDetailRow('Sunrise', today.timing.sunrise!),
                  if (today.timing.sunset != null)
                    _sheetDetailRow('Sunset', today.timing.sunset!),
                  if (today.timing.rahuKaal != null)
                    _sheetDetailRow('Rahu Kaal', today.timing.rahuKaal!),
                  if (today.timing.abhijitMuhurat != null)
                    _sheetDetailRow(
                      'Abhijit Muhurat',
                      today.timing.abhijitMuhurat!,
                    ),
                ],

                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0x14F4C45E),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0x33F4C45E)),
                  ),
                  child: const Text(
                    'Calculated Vedic data is generated first. AI is used only to explain the supplied astrological context.',
                    style: TextStyle(
                      color: AppColors.muted,
                      height: 1.45,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showCalculationBasis(TodayForYouModel today) async {
    final sources = today.transparency.calculationSources;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0x55FFFFFF),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Vedic Calculation Basis',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Only data actually available for this reading is listed below.',
                  style: TextStyle(color: AppColors.muted, height: 1.4),
                ),
                const SizedBox(height: 18),
                if (sources.isEmpty)
                  const Text(
                    'Calculation source details are not available for this reading.',
                    style: TextStyle(color: AppColors.muted),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: sources
                        .map(
                          (source) => Chip(
                            avatar: const Icon(
                              Icons.check_circle_outline_rounded,
                              size: 17,
                              color: AppColors.gold,
                            ),
                            label: Text(source),
                            backgroundColor: const Color(0x18F4C45E),
                            side: const BorderSide(color: Color(0x33F4C45E)),
                            labelStyle: const TextStyle(
                              color: AppColors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
                const SizedBox(height: 18),
                _sheetDetailRow(
                  'AI role',
                  today.transparency.isInterpretationOnly
                      ? 'Interpretation only'
                      : 'Not specified',
                ),
                if (today.transparency.scoreSource != null)
                  _sheetDetailRow(
                    'Day score source',
                    today.transparency.scoreSource!,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _todayEvidenceTile(TodayForYouEvidence evidence) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x22FFFFFF)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.check_circle_outline_rounded,
            color: AppColors.gold,
            size: 20,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  evidence.label,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  evidence.value,
                  style: const TextStyle(color: AppColors.muted, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sheetDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroCard(Map<String, dynamic> user, Map<String, dynamic> cosmic) {
    final name = _text(user['name'], fallback: 'User');
    final greeting = _text(user['greeting'], fallback: 'Hello');
    final date = _text(user['date'], fallback: 'Today');

    final scoreValue = cosmic['overallScore'];
    final score = scoreValue is num
        ? scoreValue
        : num.tryParse(scoreValue?.toString() ?? '') ?? 0;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x55F4C45E)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: const Color(0x22F4C45E),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.wb_sunny_rounded,
                  color: AppColors.gold,
                  size: 30,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      greeting,
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      name,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 23,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(date, style: const TextStyle(color: AppColors.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0x11000000),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, color: AppColors.gold),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Overall Cosmic Score',
                        style: TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Your personalized Vedic outlook',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Text(
                  _formatScore(score),
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip('Natal: ${_text(user['natalNakshatra'], fallback: 'N/A')}'),
              _chip(
                'Current: ${_text(user['currentNakshatra'], fallback: 'N/A')}',
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatScore(num score) {
    if (score == score.roundToDouble()) {
      return score.toInt().toString();
    }

    return score.toStringAsFixed(1);
  }

  Widget _cosmicCard(
    Map<String, dynamic> cosmic,
    Map<String, dynamic> tarabala,
  ) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          _detailRow('Tarabala', _text(tarabala['name'])),
          _divider(),
          _detailRow('Effect', _text(tarabala['effect'])),
          _divider(),
          _detailRow('Count', _text(tarabala['count'], fallback: 'N/A')),
        ],
      ),
    );
  }

  Widget _moonCard({
    required Map<String, dynamic> currentMoon,
    required Map<String, dynamic> natalMoon,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          _moonBlock(
            title: 'Current Moon',
            icon: Icons.nightlight_round,
            data: currentMoon,
            includeExtra: true,
          ),
          const SizedBox(height: 16),
          _divider(),
          const SizedBox(height: 16),
          _moonBlock(
            title: 'Natal Moon',
            icon: Icons.brightness_2_outlined,
            data: natalMoon,
          ),
        ],
      ),
    );
  }

  Widget _moonBlock({
    required String title,
    required IconData icon,
    required Map<String, dynamic> data,
    bool includeExtra = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.gold, size: 26),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.gold,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _text(data['nakshatra']),
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Lord: ${_text(data['lord'], fallback: 'N/A')}',
                style: const TextStyle(color: AppColors.muted),
              ),
              if (includeExtra) ...[
                const SizedBox(height: 4),
                Text(
                  'Deity: ${_text(data['deity'], fallback: 'N/A')}  |  Pada: ${_text(data['pada'], fallback: 'N/A')}',
                  style: const TextStyle(color: AppColors.muted),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _predictionCard({
    required String title,
    required String description,
    required String emoji,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 27)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  description,
                  style: const TextStyle(color: AppColors.muted, height: 1.45),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _compactHighlightCard({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Container(
      constraints: const BoxConstraints(minHeight: 136),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF211B34), Color(0xFF171322)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x55F4C45E), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
          BoxShadow(color: Color(0x14F4C45E), blurRadius: 16, spreadRadius: 1),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x33F4C45E), Color(0x14F4C45E)],
              ),
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: const Color(0x44F4C45E)),
            ),
            alignment: Alignment.center,
            child: Icon(icon, color: AppColors.gold, size: 21),
          ),
          const SizedBox(height: 14),
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFFD4C7A4),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.7,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 15,
              height: 1.35,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard({
    required IconData icon,
    required String title,
    required String value,
  }) {
    final normalizedTitle = title.trim().toUpperCase();

    final isDo = normalizedTitle == 'DO';
    final isAvoid = normalizedTitle == 'AVOID';
    final isClosing = normalizedTitle == 'CLOSING INSIGHT';

    final accent = isDo
        ? const Color(0xFF7BD89B)
        : isAvoid
        ? const Color(0xFFFF8C8C)
        : AppColors.gold;

    final accentBackground = isDo
        ? const Color(0x167BD89B)
        : isAvoid
        ? const Color(0x16FF8C8C)
        : const Color(0x18F4C45E);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isClosing
              ? const [Color(0xFF292039), Color(0xFF181321)]
              : const [Color(0xFF211B31), Color(0xFF17131F)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDo
              ? const Color(0x447BD89B)
              : isAvoid
              ? const Color(0x44FF8C8C)
              : const Color(0x44F4C45E),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x2D000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: accentBackground,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: accent, width: 0.7),
            ),
            alignment: Alignment.center,
            child: Icon(icon, color: accent, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: accent,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.35,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  value,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 14,
                    height: 1.55,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 4,
          height: 24,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFFFE59A), Color(0xFFE5A72D)],
            ),
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(color: Color(0x55F4C45E), blurRadius: 8),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 19,
              height: 1.2,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.15,
            ),
          ),
        ),
        Container(
          width: 7,
          height: 7,
          decoration: const BoxDecoration(
            color: AppColors.gold,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: Color(0x66F4C45E), blurRadius: 9)],
          ),
        ),
      ],
    );
  }

  Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x18F4C45E),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0x44F4C45E)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(color: AppColors.muted)),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _vedicDashaCard({
    required Map<String, dynamic> currentMahadasha,
    required Map<String, dynamic> currentAntardasha,
  }) {
    final mahaLord = _text(currentMahadasha['lord']);
    final mahaStart = _text(currentMahadasha['start']);
    final mahaEnd = _text(currentMahadasha['end']);

    final antarLord = _text(currentAntardasha['lord']);
    final antarStart = _text(currentAntardasha['start']);
    final antarEnd = _text(currentAntardasha['end']);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x33F4C45E)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0x18F4C45E),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(
                  Icons.timelapse_rounded,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Current Vimshottari Dasha',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Calculated from your Vedic birth chart',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (currentMahadasha.isNotEmpty) ...[
            const SizedBox(height: 18),
            _detailRow('Mahadasha', mahaLord.isEmpty ? 'N/A' : mahaLord),
            if (mahaStart.isNotEmpty || mahaEnd.isNotEmpty) ...[
              _divider(),
              _detailRow('Mahadasha Period', _periodLabel(mahaStart, mahaEnd)),
            ],
          ],

          if (currentAntardasha.isNotEmpty) ...[
            if (currentMahadasha.isNotEmpty) _divider(),
            _detailRow('Antardasha', antarLord.isEmpty ? 'N/A' : antarLord),
            if (antarStart.isNotEmpty || antarEnd.isNotEmpty) ...[
              _divider(),
              _detailRow(
                'Antardasha Period',
                _periodLabel(antarStart, antarEnd),
              ),
            ],
          ],
        ],
      ),
    );
  }

  String _periodLabel(String start, String end) {
    final formattedStart = _formatDashaDate(start);
    final formattedEnd = _formatDashaDate(end);

    if (formattedStart.isNotEmpty && formattedEnd.isNotEmpty) {
      return '$formattedStart \u2192 $formattedEnd';
    }

    if (formattedStart.isNotEmpty) {
      return 'From $formattedStart';
    }

    if (formattedEnd.isNotEmpty) {
      return 'Until $formattedEnd';
    }

    return 'N/A';
  }

  String _formatDashaDate(String raw) {
    final value = raw.trim();

    if (value.isEmpty) {
      return '';
    }

    // Prefer the provider's original calendar date.
    // This avoids timezone conversion accidentally shifting Dasha boundaries.
    final isoDate = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);

    int? year;
    int? month;
    int? day;

    if (isoDate != null) {
      year = int.tryParse(isoDate.group(1) ?? '');
      month = int.tryParse(isoDate.group(2) ?? '');
      day = int.tryParse(isoDate.group(3) ?? '');
    } else {
      final parsed = DateTime.tryParse(value);

      if (parsed != null) {
        year = parsed.year;
        month = parsed.month;
        day = parsed.day;
      }
    }

    if (year == null ||
        month == null ||
        day == null ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31) {
      // Unknown provider format: preserve it instead of inventing a date.
      return value;
    }

    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '$day ${months[month - 1]} $year';
  }

  Widget _divider() {
    return const Divider(height: 24, color: Color(0x22FFFFFF));
  }

  Future<void> _openSubscriptionPlans() async {
    final activated = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => const SubscriptionPlansScreen(
          audience: SubscriptionAudience.customer,
        ),
      ),
    );

    if (!mounted || activated != true) {
      return;
    }

    await _loadHoroscope();
  }

  Widget _subscriptionPaywall() {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0x55F4C45E)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0x18F4C45E),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.workspace_premium_rounded,
                        color: AppColors.gold,
                        size: 34,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Unlock Daily Horoscope',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Get your personalized Vedic daily horoscope, lucky elements, life-area guidance and daily insights.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, height: 1.5),
                    ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _openSubscriptionPlans,
                        icon: const Icon(Icons.lock_open_rounded),
                        label: const Text('View Horoscope Plan'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: _loadHoroscope,
                      child: const Text('Already subscribed? Refresh'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _errorWidget() {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(30),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.auto_awesome_outlined,
                  size: 54,
                  color: AppColors.gold,
                ),
                const SizedBox(height: 18),
                Text(
                  _error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: _loadHoroscope,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
