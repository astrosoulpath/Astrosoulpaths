import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/localization/app_locale_controller.dart';
import '../../../../core/localization/app_strings.dart';

import '../../../profile/data/geo_api.dart';
import '../../../customer/presentation/screens/customer_shell_screen.dart';
import '../../data/general_horoscope_api.dart';
import 'daily_horoscope_screen.dart';

class _AspWorldMapPainter extends CustomPainter {
  const _AspWorldMapPainter({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  @override
  void paint(Canvas canvas, Size size) {
    final land = Paint()
      ..color = const Color(0xFFB99FC3)
      ..style = PaintingStyle.fill;

    final outline = Paint()
      ..color = const Color(0xFF80608A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;

    final grid = Paint()
      ..color = const Color(0xFFDCCDE1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.7;

    final marker = Paint()
      ..color = const Color(0xFF6E4A7E)
      ..style = PaintingStyle.fill;

    final markerGlow = Paint()
      ..color = const Color(0x336E4A7E)
      ..style = PaintingStyle.fill;

    Path shape(List<Offset> points) {
      final path = Path();

      if (points.isEmpty) {
        return path;
      }

      path.moveTo(points.first.dx * size.width, points.first.dy * size.height);

      for (final point in points.skip(1)) {
        path.lineTo(point.dx * size.width, point.dy * size.height);
      }

      path.close();
      return path;
    }

    // Subtle geographic guides.
    canvas.drawLine(
      Offset(0, size.height * 0.5),
      Offset(size.width, size.height * 0.5),
      grid,
    );

    for (final x in <double>[0.25, 0.5, 0.75]) {
      canvas.drawLine(
        Offset(size.width * x, 5),
        Offset(size.width * x, size.height - 5),
        grid,
      );
    }

    final northAmerica = shape(const <Offset>[
      Offset(0.05, 0.23),
      Offset(0.12, 0.12),
      Offset(0.24, 0.15),
      Offset(0.31, 0.28),
      Offset(0.27, 0.40),
      Offset(0.19, 0.47),
      Offset(0.13, 0.40),
      Offset(0.08, 0.32),
    ]);

    final southAmerica = shape(const <Offset>[
      Offset(0.27, 0.50),
      Offset(0.35, 0.55),
      Offset(0.37, 0.68),
      Offset(0.33, 0.85),
      Offset(0.29, 0.94),
      Offset(0.26, 0.73),
      Offset(0.24, 0.59),
    ]);

    final eurasia = shape(const <Offset>[
      Offset(0.43, 0.27),
      Offset(0.50, 0.17),
      Offset(0.60, 0.19),
      Offset(0.68, 0.13),
      Offset(0.82, 0.18),
      Offset(0.94, 0.30),
      Offset(0.88, 0.42),
      Offset(0.79, 0.43),
      Offset(0.73, 0.54),
      Offset(0.64, 0.48),
      Offset(0.58, 0.39),
      Offset(0.51, 0.43),
      Offset(0.46, 0.37),
    ]);

    final africa = shape(const <Offset>[
      Offset(0.48, 0.44),
      Offset(0.58, 0.43),
      Offset(0.63, 0.55),
      Offset(0.59, 0.74),
      Offset(0.53, 0.83),
      Offset(0.48, 0.69),
      Offset(0.45, 0.54),
    ]);

    final australia = shape(const <Offset>[
      Offset(0.78, 0.70),
      Offset(0.87, 0.66),
      Offset(0.94, 0.74),
      Offset(0.90, 0.85),
      Offset(0.81, 0.86),
      Offset(0.76, 0.78),
    ]);

    for (final continent in <Path>[
      northAmerica,
      southAmerica,
      eurasia,
      africa,
      australia,
    ]) {
      canvas.drawPath(continent, land);
      canvas.drawPath(continent, outline);
    }

    // Real selected Panchang coordinate -> map position.
    final x = ((longitude + 180.0) / 360.0).clamp(0.0, 1.0) * size.width;

    final y = ((90.0 - latitude) / 180.0).clamp(0.0, 1.0) * size.height;

    final point = Offset(x, y);

    canvas.drawCircle(point, 9, markerGlow);
    canvas.drawCircle(point, 4.5, marker);

    canvas.drawCircle(point, 1.6, Paint()..color = const Color(0xFFFFF8EE));
  }

  @override
  bool shouldRepaint(covariant _AspWorldMapPainter oldDelegate) {
    return oldDelegate.latitude != latitude ||
        oldDelegate.longitude != longitude;
  }
}

class GeneralHoroscopeScreen extends StatefulWidget {
  const GeneralHoroscopeScreen({super.key});

  @override
  State<GeneralHoroscopeScreen> createState() => _GeneralHoroscopeScreenState();
}

class _GeneralHoroscopeScreenState extends State<GeneralHoroscopeScreen> {
  static const _moonSigns = <String>[
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];

  final GeneralHoroscopeApi _api = GeneralHoroscopeApi();
  final GeoApi _geoApi = GeoApi();

  final TextEditingController _panchangCityController = TextEditingController();
  final FocusNode _panchangCityFocusNode = FocusNode();
  final FlutterTts _horoscopeTts = FlutterTts();

  List<GeoSuggestion> _panchangGeoSuggestions = <GeoSuggestion>[];
  GeoSuggestion? _selectedPanchangLocation;
  bool _searchingPanchangCity = false;

  String _moonSign = 'Scorpio';
  String _selectedHoroscopeTab = 'Daily';
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _daily;
  Map<String, dynamic>? _panchang;
  DateTime _selectedPanchangDate = DateTime.now();
  Map<String, dynamic>? _weekly;
  Map<String, dynamic>? _weeklyLove;
  Map<String, dynamic>? _monthly;
  Map<String, dynamic>? _yearly;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _panchangCityController.dispose();
    _panchangCityFocusNode.dispose();
    _geoApi.close();
    _api.close();
    super.dispose();
  }

  Future<void> _searchPanchangCity(String query) async {
    final normalized = query.trim();

    if (normalized.length < 2) {
      if (mounted) {
        setState(() {
          _panchangGeoSuggestions = <GeoSuggestion>[];
          _searchingPanchangCity = false;
        });
      }
      return;
    }

    setState(() {
      _searchingPanchangCity = true;
    });

    try {
      final suggestions = await _geoApi.searchCity(normalized);

      if (!mounted || _panchangCityController.text.trim() != normalized) {
        return;
      }

      setState(() {
        _panchangGeoSuggestions = suggestions;
      });
    } on GeoApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _panchangGeoSuggestions = <GeoSuggestion>[];
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _searchingPanchangCity = false;
        });
      }
    }
  }

  void _selectPanchangLocation(GeoSuggestion suggestion) {
    setState(() {
      _selectedPanchangLocation = suggestion;
      _panchangCityController.text = suggestion.fullName;
      _panchangGeoSuggestions = <GeoSuggestion>[];
      _panchang = null;
      _error = null;
    });

    FocusScope.of(context).unfocus();

    if (_selectedHoroscopeTab == 'Panchang') {
      _load(force: true);
    }
  }

  Future<void> _load({bool force = false}) async {
    if (!mounted) return;

    final now = DateTime.now();

    bool alreadyLoaded = false;

    switch (_selectedHoroscopeTab) {
      case 'Daily':
        alreadyLoaded = _daily != null;
        break;
      case 'Panchang':
        alreadyLoaded = _panchang != null;
        break;
      case 'Weekly':
        alreadyLoaded = _weekly != null;
        break;
      case 'Weekly Love':
        alreadyLoaded = _weeklyLove != null;
        break;
      case 'Monthly':
        alreadyLoaded = _monthly != null;
        break;
      case 'Yearly':
        alreadyLoaded = _yearly != null;
        break;
    }

    if (alreadyLoaded && !force) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final Map<String, dynamic> result;

      switch (_selectedHoroscopeTab) {
        case 'Panchang':
          final location = _selectedPanchangLocation;

          result = await _api.getPanchang(
            date: _selectedPanchangDate,
            languageCode: AppLocaleController.languageCode,
            latitude: location?.latitude,
            longitude: location?.longitude,
            timezone: location?.timezone,
            timezoneName: location?.timezoneName,
            place: location?.fullName,
          );
          break;

        case 'Weekly':
          result = await _api.getWeekly(
            moonSign: _moonSign,
            date: now,
            languageCode: AppLocaleController.languageCode,
          );
          break;

        case 'Weekly Love':
          result = await _api.getWeeklyLove(
            moonSign: _moonSign,
            date: now,
            languageCode: AppLocaleController.languageCode,
          );
          break;

        case 'Monthly':
          result = await _api.getMonthly(
            moonSign: _moonSign,
            date: now,
            languageCode: AppLocaleController.languageCode,
          );
          break;

        case 'Yearly':
          result = await _api.getYearly(
            moonSign: _moonSign,
            date: now,
            languageCode: AppLocaleController.languageCode,
          );
          break;

        case 'Daily':
        default:
          result = await _api.getDaily(
            moonSign: _moonSign,
            date: now,
            languageCode: AppLocaleController.languageCode,
          );
          break;
      }

      if (!mounted) return;

      setState(() {
        switch (_selectedHoroscopeTab) {
          case 'Panchang':
            _panchang = result;

            break;
          case 'Weekly':
            _weekly = result;
            break;
          case 'Weekly Love':
            _weeklyLove = result;
            break;
          case 'Monthly':
            _monthly = result;
            break;
          case 'Yearly':
            _yearly = result;
            break;
          case 'Daily':
          default:
            _daily = result;
            break;
        }

        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  void _clearFreeHoroscopeCache() {
    _daily = null;
    _panchang = null;
    _weekly = null;
    _weeklyLove = null;
    _monthly = null;
    _yearly = null;
  }

  Map<String, dynamic>? get _currentShareData {
    switch (_selectedHoroscopeTab) {
      case 'Panchang':
        return _panchang;
      case 'Weekly':
        return _weekly;
      case 'Weekly Love':
        return _weeklyLove;
      case 'Monthly':
        return _monthly;
      case 'Yearly':
        return _yearly;
      case 'Daily':
      default:
        return _daily;
    }
  }

  String get _currentShareTitle {
    switch (_selectedHoroscopeTab) {
      case 'Panchang':
        return 'Panchang';
      case 'Weekly':
        return 'Weekly Horoscope';
      case 'Weekly Love':
        return 'Weekly Love Horoscope';
      case 'Monthly':
        return 'Monthly Horoscope';
      case 'Yearly':
        return 'Yearly Horoscope';
      case 'Daily':
      default:
        return 'Daily Horoscope';
    }
  }

  String _shareBackendValue(dynamic value) {
    if (value == null) return '';

    if (value is Map) {
      final name = value['name'];

      if (name != null && name.toString().trim().isNotEmpty) {
        return name.toString().trim();
      }
    }

    return value.toString().trim();
  }

  Map<String, dynamic>? _currentHoroscopeActionData() {
    switch (_selectedHoroscopeTab) {
      case 'Daily':
        return _daily;
      case 'Panchang':
        return _panchang;
      case 'Weekly':
        return _weekly;
      case 'Weekly Love':
        return _weeklyLove;
      case 'Monthly':
        return _monthly;
      case 'Yearly':
        return _yearly;
    }

    return null;
  }

  String _currentHoroscopeActionText() {
    final data = _currentHoroscopeActionData();

    if (data == null || data.isEmpty) {
      return '';
    }

    final lines = <String>['Astro Soul Path', _selectedHoroscopeTab];

    if (_selectedHoroscopeTab != 'Panchang') {
      lines.add('Moon Sign: $_moonSign');
    }

    final date = _shareBackendValue(data['date']);
    final startDate = _shareBackendValue(data['startDate']);
    final endDate = _shareBackendValue(data['endDate']);

    if (date.isNotEmpty) {
      lines.add(date);
    }

    if (startDate.isNotEmpty || endDate.isNotEmpty) {
      final period = <String>[
        if (startDate.isNotEmpty) startDate,
        if (endDate.isNotEmpty) endDate,
      ].join(' - ');

      if (period.isNotEmpty) {
        lines.add(period);
      }
    }

    if (_selectedHoroscopeTab == 'Panchang') {
      final panchang = _map(data['panchang']);

      final values = <String, String>{
        'Day': _shareBackendValue(panchang['day']),
        'Tithi': _shareBackendValue(panchang['tithi']),
        'Paksha': _shareBackendValue(panchang['paksha']),
        'Nakshatra': _shareBackendValue(panchang['nakshatra']),
        'Yoga': _shareBackendValue(panchang['yoga']),
        'Karana': _shareBackendValue(panchang['karana']),
      };

      for (final entry in values.entries) {
        if (entry.value.isNotEmpty) {
          lines.add('${entry.key}: ${entry.value}');
        }
      }
    } else {
      final interpretation = _map(data['interpretation']);

      final summary = _shareBackendValue(interpretation['summary']);

      final advice = _shareBackendValue(interpretation['advice']);

      if (summary.isNotEmpty) {
        lines.add(summary);
      }

      if (advice.isNotEmpty) {
        lines.add('Advice: $advice');
      }
    }

    return lines.join('\n\n').trim();
  }

  Future<void> _listenCurrentHoroscope() async {
    final text = _currentHoroscopeActionText();
    if (text.isEmpty) return;

    await _horoscopeTts.stop();
    await _horoscopeTts.speak(text);
  }

  Future<void> _copyCurrentHoroscope() async {
    final text = _currentHoroscopeActionText();
    if (text.isEmpty) return;

    await Clipboard.setData(ClipboardData(text: text));

    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Horoscope copied'),
          duration: Duration(seconds: 2),
        ),
      );
  }

  Future<void> _shareCurrentHoroscopeToWhatsApp() async {
    final text = _currentHoroscopeActionText();
    if (text.isEmpty) return;

    final uri = Uri.https('wa.me', '/', <String, String>{'text': text});

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!opened && mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('WhatsApp could not be opened')),
        );
    }
  }

  Widget _horoscopeActionBar() {
    return Builder(
      builder: (shareContext) {
        return Container(
          margin: const EdgeInsets.fromLTRB(18, 10, 18, 4),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFCF8),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE7D9E9)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x126F3D82),
                blurRadius: 14,
                offset: Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              _horoscopeActionItem(
                icon: Icons.volume_up_rounded,
                label: 'Listen',
                onTap: _listenCurrentHoroscope,
              ),
              _horoscopeActionDivider(),
              _horoscopeActionItem(
                icon: Icons.content_copy_rounded,
                label: 'Copy',
                onTap: _copyCurrentHoroscope,
              ),
              _horoscopeActionDivider(),
              _horoscopeActionItem(
                icon: Icons.share_rounded,
                label: 'Share',
                onTap: () => _shareCurrentHoroscope(shareContext),
              ),
              _horoscopeActionDivider(),
              _horoscopeActionItem(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                isWhatsApp: true,
                onTap: _shareCurrentHoroscopeToWhatsApp,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _horoscopeActionDivider() {
    return Container(width: 1, height: 40, color: const Color(0xFFE9E0E5));
  }

  Widget _horoscopeActionItem({
    required IconData icon,
    required String label,
    required Future<void> Function() onTap,
    bool isWhatsApp = false,
  }) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          await onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 25,
                color: isWhatsApp
                    ? const Color(0xFF25D366)
                    : const Color(0xFFD89A16),
              ),
              const SizedBox(height: 5),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF30243A),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _shareCurrentHoroscope(BuildContext shareContext) async {
    final data = _currentShareData;

    if (data == null) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Horoscope is still loading.')),
      );
      return;
    }

    final lines = <String>[
      _currentShareTitle,
      if (_selectedHoroscopeTab != 'Panchang') 'Moon Sign: $_moonSign',
    ];

    final date = _shareBackendValue(data['date']);
    final startDate = _shareBackendValue(data['startDate']);
    final endDate = _shareBackendValue(data['endDate']);

    if (startDate.isNotEmpty && endDate.isNotEmpty) {
      lines.add('$startDate - $endDate');
    } else if (date.isNotEmpty) {
      lines.add(date);
    }

    if (_selectedHoroscopeTab == 'Panchang') {
      final panchang = data['panchang'];

      if (panchang is Map) {
        final day = _shareBackendValue(panchang['day']);
        final tithi = _shareBackendValue(panchang['tithi']);
        final nakshatra = _shareBackendValue(panchang['nakshatra']);
        final yoga = _shareBackendValue(panchang['yoga']);
        final karana = _shareBackendValue(panchang['karana']);

        if (day.isNotEmpty) {
          lines.add('Day: $day');
        }

        if (tithi.isNotEmpty) {
          lines.add('Tithi: $tithi');
        }

        if (nakshatra.isNotEmpty) {
          lines.add('Nakshatra: $nakshatra');
        }

        if (yoga.isNotEmpty) {
          lines.add('Yoga: $yoga');
        }

        if (karana.isNotEmpty) {
          lines.add('Karana: $karana');
        }
      }
    } else {
      final interpretation = data['interpretation'];

      if (interpretation is Map) {
        final summary = _shareBackendValue(interpretation['summary']);

        final advice = _shareBackendValue(interpretation['advice']);

        if (summary.isNotEmpty) {
          lines.add('');
          lines.add(summary);
        }

        if (advice.isNotEmpty) {
          lines.add('');
          lines.add('Advice: $advice');
        }
      }
    }

    lines.add('');
    lines.add('Astro Soul Path');

    final renderObject = shareContext.findRenderObject();

    final box = renderObject is RenderBox ? renderObject : null;

    final origin = box == null
        ? null
        : box.localToGlobal(Offset.zero) & box.size;

    await SharePlus.instance.share(
      ShareParams(
        text: lines.join('\n'),
        subject: _currentShareTitle,
        sharePositionOrigin: origin,
      ),
    );
  }

  void _goToCustomerHome() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => const CustomerShellScreen(initialIndex: 0),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8EE),
      appBar: AppBar(
        backgroundColor: const Color(0xFF24152F),
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: const BackButton(color: Colors.white),
        title: const Text(
          'Horoscope',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        actions: [
          Builder(
            builder: (shareContext) => IconButton(
              tooltip: 'Share horoscope',
              onPressed: _loading
                  ? null
                  : () => _shareCurrentHoroscope(shareContext),
              icon: const Icon(Icons.share_rounded),
            ),
          ),
          IconButton(
            tooltip: 'Home',
            onPressed: _goToCustomerHome,
            icon: const Icon(Icons.home_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
          children: [
            const Text(
              'Moon Sign Horoscope',
              style: TextStyle(
                color: Color(0xFF24152F),
                fontSize: 23,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 5),
            const SizedBox(height: 18),

            _moonSignSelector(),

            const SizedBox(height: 18),

            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 50),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _errorCard()
            else ...[
              _horoscopeTypeStrip(),
              const SizedBox(height: 14),
              _freeHoroscopeHero(),
              _horoscopeActionBar(),
              const SizedBox(height: 16),
              _selectedHoroscopeContent(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _moonSignSelector() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8DED4)),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Moon Sign',
                  style: TextStyle(
                    color: Color(0xFF7A6C80),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Choose Rashi',
                  style: TextStyle(
                    color: Color(0xFF24152F),
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _moonSign,
              borderRadius: BorderRadius.circular(14),
              items: _moonSigns
                  .map(
                    (sign) => DropdownMenuItem<String>(
                      value: sign,
                      child: Text(sign),
                    ),
                  )
                  .toList(),
              onChanged: _loading
                  ? null
                  : (value) {
                      if (value == null || value == _moonSign) return;

                      setState(() {
                        _moonSign = value;
                        _clearFreeHoroscopeCache();
                      });

                      _load(force: true);
                    },
            ),
          ),
        ],
      ),
    );
  }

  String get _zodiacArtworkAsset {
    switch (_moonSign.toLowerCase()) {
      case 'aries':
        return 'assets/images/horoscope/zodiac/aries.png';
      case 'taurus':
        return 'assets/images/horoscope/zodiac/taurus.png';
      case 'gemini':
        return 'assets/images/horoscope/zodiac/gemini.png';
      case 'cancer':
        return 'assets/images/horoscope/zodiac/cancer.png';
      case 'leo':
        return 'assets/images/horoscope/zodiac/leo.png';
      case 'virgo':
        return 'assets/images/horoscope/zodiac/virgo.png';
      case 'libra':
        return 'assets/images/horoscope/zodiac/libra.png';
      case 'scorpio':
        return 'assets/images/horoscope/zodiac/scorpio.png';
      case 'sagittarius':
        return 'assets/images/horoscope/zodiac/sagittarius.png';
      case 'capricorn':
        return 'assets/images/horoscope/zodiac/capricorn.png';
      case 'aquarius':
        return 'assets/images/horoscope/zodiac/aquarius.png';
      case 'pisces':
        return 'assets/images/horoscope/zodiac/pisces.png';
      default:
        return 'assets/images/horoscope/zodiac/scorpio.png';
    }
  }

  Widget _zodiacArtwork() {
    return Center(
      child: SizedBox(
        width: 190,
        height: 190,
        child: ClipOval(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Image.asset(
              _zodiacArtworkAsset,
              width: 182,
              height: 182,
              fit: BoxFit.contain,
              alignment: Alignment.center,
              filterQuality: FilterQuality.high,
            ),
          ),
        ),
      ),
    );
  }

  String get _freeHoroscopeHeroAsset {
    switch (_selectedHoroscopeTab) {
      case 'Daily':
        return 'assets/images/horoscope/daily_horoscope_bg.png';
      case 'Panchang':
        return 'assets/images/horoscope/panchang_bg.png';
      case 'Weekly':
        return 'assets/images/horoscope/weekly_horoscope_bg.png';
      case 'Weekly Love':
        return 'assets/images/horoscope/weekly_love_bg.png';
      case 'Monthly':
        return 'assets/images/horoscope/monthly_horoscope_bg.png';
      case 'Yearly':
        return 'assets/images/horoscope/yearly_horoscope_bg.png';
      default:
        return 'assets/images/horoscope/daily_horoscope_bg.png';
    }
  }

  Widget _freeHoroscopeHero() {
    return Container(
      width: double.infinity,
      height: 184,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F281A32),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Image.asset(
          _freeHoroscopeHeroAsset,
          width: double.infinity,
          height: 184,
          fit: BoxFit.cover,
          alignment: Alignment.center,
        ),
      ),
    );
  }

  Widget _horoscopeTypeStrip() {
    const tabs = <String>[
      'Daily',
      'Panchang',
      'Weekly',
      'Weekly Love',
      'Monthly',
      'Yearly',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 46,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: tabs.length,
            separatorBuilder: (_, _) => const SizedBox(width: 22),
            itemBuilder: (context, index) {
              final tab = tabs[index];
              final selected = tab == _selectedHoroscopeTab;

              return InkWell(
                borderRadius: BorderRadius.circular(4),
                onTap: () {
                  if (_selectedHoroscopeTab == tab) return;

                  setState(() {
                    _selectedHoroscopeTab = tab;
                    _error = null;
                  });

                  _load();
                },
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: selected
                            ? const Color(0xFF6E4A7E)
                            : Colors.transparent,
                        width: 3,
                      ),
                    ),
                  ),
                  child: Text(
                    tab,
                    style: TextStyle(
                      color: selected
                          ? const Color(0xFF281A32)
                          : const Color(0xFF8C8190),
                      fontSize: 15,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Material(
          color: const Color(0xFF281A32),
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const DailyHoroscopeScreen(),
                ),
              );
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, color: Colors.white),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Personalized Daily Horoscope',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Your personal Vedic day | Subscription',
                          style: TextStyle(
                            color: Color(0xFFE4D8E9),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _selectedHoroscopeContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _zodiacArtwork(),
        const SizedBox(height: 14),
        _selectedHoroscopeContentBody(),
      ],
    );
  }

  Widget _selectedHoroscopeContentBody() {
    switch (_selectedHoroscopeTab) {
      case 'Daily':
        return _dailyCard();
      case 'Panchang':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _panchangLocationSelector(),
            const SizedBox(height: 14),
            _panchangDateSelector(),
            _panchangCard(),
            const SizedBox(height: 14),
            _sunMoonCalculationsCard(),
            _hinduMonthAndYearCard(),
            _auspiciousInauspiciousTimingsCard(),
            _dishaShoolaCard(),
            _chandrabalamTarabalamCard(),
          ],
        );

      case 'Weekly':
        return _periodTransitCard(title: 'Weekly Horoscope', data: _weekly);

      case 'Weekly Love':
        return _periodTransitCard(
          title: 'Weekly Love Horoscope',
          data: _weeklyLove,
        );

      case 'Monthly':
        return _periodTransitCard(title: 'Monthly Horoscope', data: _monthly);

      case 'Yearly':
        return _periodTransitCard(title: 'Yearly Horoscope', data: _yearly);
    }

    return _dailyCard();
  }

  Widget _periodTransitCard({
    required String title,
    required Map<String, dynamic>? data,
  }) {
    final root = data ?? const <String, dynamic>{};
    final interpretation = _map(root['interpretation']);

    final summary = _text(interpretation['summary'], fallback: '');

    final advice = _text(interpretation['advice'], fallback: '');

    final startDate = _text(root['startDate'], fallback: '');
    final endDate = _text(root['endDate'], fallback: '');

    final snapshotsRaw = root['snapshots'];
    final snapshots = snapshotsRaw is List ? snapshotsRaw : const <dynamic>[];

    final subtitle = startDate.isNotEmpty && endDate.isNotEmpty
        ? '$startDate - $endDate'
        : '';

    return _sectionCard(
      accent: true,
      title: title,
      subtitle: subtitle,
      children: [
        if (summary.isNotEmpty) ...[
          Text(
            summary,
            style: const TextStyle(
              fontSize: 15,
              height: 1.55,
              color: Color(0xFF292333),
            ),
          ),
          const SizedBox(height: 16),
        ],

        if (advice.isNotEmpty) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F1FF),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.auto_awesome_rounded,
                  size: 18,
                  color: Color(0xFF6D4C8D),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    advice,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF493858),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
        ],

        if (summary.isEmpty && advice.isEmpty)
          const Text('Interpretation is currently unavailable.'),

        if (snapshots.isNotEmpty) ...[
          const Divider(height: 28),
          const Text(
            'Vedic Basis',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF292333),
            ),
          ),
          const SizedBox(height: 10),

          ...snapshots.map((raw) {
            final snapshot = _map(raw);
            final planetsRaw = snapshot['planets'];
            final planets = planetsRaw is List ? planetsRaw : const <dynamic>[];

            return ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(
                _text(snapshot['date']),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              children: planets.map((planetRaw) {
                final planet = _map(planetRaw);

                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '${_text(planet['name'])}: '
                      '${_text(planet['sign'])} - '
                      '${_text(planet['nakshatra'])}',
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: Color(0xFF6B6570),
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          }),
        ],
      ],
    );
  }

  Widget _dailyCard() {
    final daily = _daily ?? const <String, dynamic>{};
    final transit = _map(daily['transit']);
    final engine = _map(daily['engine']);
    final interpretation = _map(daily['interpretation']);
    final todayRating = _map(daily['todayRating']);
    final ratings = _map(todayRating['ratings']);

    final planetsRaw = transit['planets'];
    final planets = planetsRaw is List ? planetsRaw : const [];

    final summary = _text(interpretation['summary'], fallback: '');
    final advice = _text(interpretation['advice'], fallback: '');

    return _sectionCard(
      title: 'Daily Horoscope',
      subtitle: _text(daily['date']),
      children: [
        if (summary.isNotEmpty) ...[
          Text(
            summary,
            style: const TextStyle(
              fontSize: 15,
              height: 1.55,
              color: Color(0xFF2B2430),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
        ],

        if (advice.isNotEmpty) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F1FA),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.auto_awesome_rounded,
                  size: 19,
                  color: Color(0xFF6F3D82),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    advice,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      color: Color(0xFF3A3040),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
        ],

        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF6EDF8),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE4D2E9)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D6F3D82),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: const Row(
            children: [
              Icon(Icons.star_rounded, size: 19, color: Color(0xFF7A4A88)),
              SizedBox(width: 8),
              Text(
                "Today's Rating",
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF281A32),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        _ratingRow('Health', ratings['health']),
        _ratingRow('Wealth', ratings['wealth']),
        _ratingRow('Family', ratings['family']),
        _ratingRow('Love Matters', ratings['loveMatters']),
        _ratingRow('Occupation', ratings['occupation']),
        _ratingRow('Married Life', ratings['marriedLife']),

        const SizedBox(height: 22),
        const SizedBox(height: 18),

        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF7E9),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFEEDDBF)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D8A6B35),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: const Row(
            children: [
              Icon(
                Icons.auto_graph_rounded,
                size: 18,
                color: Color(0xFF6F3D82),
              ),
              SizedBox(width: 8),
              Text(
                'Vedic Basis',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF201724),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        _factRow(
          'Zodiac',
          _text(engine['zodiac'], fallback: _text(transit['zodiac'])),
        ),
        _factRow(
          'Ayanamsha',
          _text(engine['ayanamsha'], fallback: _text(transit['ayanamsha'])),
        ),

        if (planets.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text(
            'Planetary positions',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF403647),
            ),
          ),
          const SizedBox(height: 8),
          ...planets.map((raw) {
            final planet = _map(raw);
            final name = _text(planet['name']);
            final sign = _text(planet['sign']);
            final nakshatra = _text(planet['nakshatra']);

            return _factRow(name, '$sign | $nakshatra');
          }),
        ],
      ],
    );
  }

  Widget _ratingRow(String label, dynamic rawValue) {
    final parsed = rawValue is num
        ? rawValue.toInt()
        : int.tryParse(rawValue?.toString() ?? '');

    final value = parsed == null ? 0 : parsed.clamp(0, 5).toInt();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF403647),
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(5, (index) {
              final filled = index < value;

              return Padding(
                padding: const EdgeInsets.only(left: 2),
                child: Icon(
                  filled ? Icons.star_rounded : Icons.star_border_rounded,
                  size: 21,
                  color: const Color(0xFF7A4A88),
                ),
              );
            }),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 28,
            child: Text(
              parsed == null ? '-' : '$value/5',
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6A5E70),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _samePanchangDate(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _panchangDateLabel(DateTime date) {
    const months = <String>[
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  Future<void> _setPanchangDate(DateTime date) async {
    final normalized = DateTime(date.year, date.month, date.day);

    if (_samePanchangDate(normalized, _selectedPanchangDate)) {
      return;
    }

    setState(() {
      _selectedPanchangDate = normalized;
      _panchang = null;
      _error = null;
    });

    await _load(force: true);
  }

  Future<void> _shiftPanchangDate(int days) async {
    final nextDate = DateTime(
      _selectedPanchangDate.year,
      _selectedPanchangDate.month,
      _selectedPanchangDate.day + days,
    );

    await _setPanchangDate(nextDate);
  }

  Future<void> _showPanchangDatePicker() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedPanchangDate,
      firstDate: DateTime(1900, 1, 1),
      lastDate: DateTime(2100, 12, 31),
      helpText: AppStrings.text(context, en: 'Select Panchang Date'),
      cancelText: AppStrings.text(context, en: 'Cancel'),
      confirmText: AppStrings.text(context, en: 'View Panchang'),
      builder: (pickerContext, child) {
        final base = Theme.of(pickerContext);

        return Theme(
          data: base.copyWith(
            colorScheme: base.colorScheme.copyWith(
              primary: const Color(0xFF684475),
              onPrimary: Colors.white,
              surface: const Color(0xFFFFFBF5),
              onSurface: const Color(0xFF35263D),
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFFFFFBF5),
            ),
          ),
          child: child!,
        );
      },
    );

    if (!mounted || picked == null) {
      return;
    }

    await _setPanchangDate(picked);
  }

  Widget _panchangDateSelector() {
    final isToday = _samePanchangDate(_selectedPanchangDate, DateTime.now());

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBF5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE6D4C0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x10000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Material(
              color: const Color(0xFFF2E8F4),
              borderRadius: BorderRadius.circular(13),
              child: InkWell(
                borderRadius: BorderRadius.circular(13),
                onTap: () => _shiftPanchangDate(-1),
                child: const SizedBox(
                  width: 44,
                  height: 50,
                  child: Icon(
                    Icons.chevron_left_rounded,
                    size: 28,
                    color: Color(0xFF684475),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Material(
                color: const Color(0xFFF8F0F8),
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: _showPanchangDatePicker,
                  borderRadius: BorderRadius.circular(14),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.calendar_month_rounded,
                          size: 21,
                          color: Color(0xFF684475),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isToday
                                    ? AppStrings.text(context, en: 'Today')
                                    : AppStrings.text(
                                        context,
                                        en: 'Selected Date',
                                      ),
                                maxLines: 1,
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF8B798F),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _panchangDateLabel(_selectedPanchangDate),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF35263D),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: const Color(0xFFF2E8F4),
              borderRadius: BorderRadius.circular(13),
              child: InkWell(
                borderRadius: BorderRadius.circular(13),
                onTap: () => _shiftPanchangDate(1),
                child: const SizedBox(
                  width: 44,
                  height: 50,
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 28,
                    color: Color(0xFF684475),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _panchangLocationSelector() {
    final selected = _selectedPanchangLocation;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE8DED4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.public_rounded, color: Color(0xFF6E4A7E), size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Panchang Location',
                  style: TextStyle(
                    color: Color(0xFF24152F),
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Search any city worldwide for location-aware Panchang.',
            style: TextStyle(
              color: Color(0xFF756A79),
              fontSize: 12,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _panchangCityController,
            focusNode: _panchangCityFocusNode,
            textInputAction: TextInputAction.search,
            onChanged: _searchPanchangCity,
            decoration: InputDecoration(
              hintText: 'Search city, e.g. Delhi, Denver, Paris',
              prefixIcon: const Icon(
                Icons.location_on_outlined,
                color: Color(0xFF6E4A7E),
              ),
              suffixIcon: _searchingPanchangCity
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : const Icon(Icons.search_rounded),
              filled: true,
              fillColor: const Color(0xFFFFFBF6),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE8DED4)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE8DED4)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFF6E4A7E),
                  width: 1.5,
                ),
              ),
            ),
          ),
          if (_panchangGeoSuggestions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              constraints: const BoxConstraints(maxHeight: 240),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBF6),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE8DED4)),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _panchangGeoSuggestions.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, color: Color(0xFFE8DED4)),
                itemBuilder: (context, index) {
                  final suggestion = _panchangGeoSuggestions[index];

                  return ListTile(
                    dense: true,
                    leading: const Icon(
                      Icons.location_on_rounded,
                      color: Color(0xFF6E4A7E),
                    ),
                    title: Text(
                      suggestion.fullName,
                      style: const TextStyle(
                        color: Color(0xFF24152F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      suggestion.timezoneName,
                      style: const TextStyle(
                        color: Color(0xFF756A79),
                        fontSize: 11,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: Color(0xFF756A79),
                    ),
                    onTap: () => _selectPanchangLocation(suggestion),
                  );
                },
              ),
            ),
          ],
          if (selected != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF5EEF7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF6E4A7E),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      selected.fullName,
                      style: const TextStyle(
                        color: Color(0xFF3B2944),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      selected.timezoneName,
                      textAlign: TextAlign.right,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF756A79),
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _panchangCard() {
    final root = _panchang ?? const <String, dynamic>{};
    final panchang = _map(root['panchang']);
    final timings = _map(panchang['timings']);

    return _sectionCard(
      accent: true,
      title: "Today's Panchang",
      subtitle: _text(root['date']),
      children: [
        _panchangValue('Day', panchang['day']),
        _panchangTimedValue('Tithi', panchang['tithi'], timings['tithiEnd']),
        _panchangValue('Paksha', panchang['paksha']),
        _panchangTimedValue(
          'Nakshatra',
          panchang['nakshatra'],
          timings['nakshatraEnd'],
        ),
        _panchangTimedValue('Yoga', panchang['yoga'], timings['yogaEnd']),
        _panchangKaranaValue(
          panchang['karanas'],
          panchang['karana'],
          timings['karanaEnd'],
        ),
      ],
    );
  }

  Widget _hinduMonthAndYearCard() {
    final raw = _panchang?['hinduMonthAndYear'];

    if (raw is! Map) {
      return const SizedBox.shrink();
    }

    final data = Map<String, dynamic>.from(raw);

    Map<String, dynamic>? mapValue(dynamic value) {
      if (value is Map) {
        return Map<String, dynamic>.from(value);
      }
      return null;
    }

    String displayValue(dynamic value) {
      final text = value?.toString().trim() ?? '';
      return text.isEmpty ? '\u2014' : text;
    }

    final amanta = mapValue(data['lunarMonth']);
    final purnimanta = mapValue(data['purnimantaMonth']);
    final lunarYear = mapValue(data['lunarYear']);

    final amantaName = displayValue(amanta?['name']);
    final purnimantaName = displayValue(purnimanta?['name']);
    final vikramSamvat = displayValue(lunarYear?['vikramSamvat']);
    final shakaSamvat = displayValue(lunarYear?['shakaSamvat']);
    final samvatsara = displayValue(data['samvatsara']);
    final kaliSamvat = displayValue(data['kaliSamvat']);
    final dayDuration = displayValue(data['dayDuration']);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCFA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE7D9E9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x126F3D82),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.calendar_month_rounded,
                size: 21,
                color: Color(0xFF7A4D87),
              ),
              SizedBox(width: 9),
              Expanded(
                child: Text(
                  'Hindu Month And Year',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2D2031),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _openLunarExplorerFromPanchang(
                    convention: 'amanta',
                    amantaMonth: amantaName,
                    purnimantaMonth: purnimantaName,
                  ),
                  child: _hinduMonthYearValue(
                    label: 'Amanta Month',
                    value: amantaName,
                    showLunarButton: true,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _openLunarExplorerFromPanchang(
                    convention: 'purnimanta',
                    amantaMonth: amantaName,
                    purnimantaMonth: purnimantaName,
                  ),
                  child: _hinduMonthYearValue(
                    label: 'Purnimanta Month',
                    value: purnimantaName,
                    showLunarButton: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _hinduMonthYearValue(
                  label: 'Vikram Samvat',
                  value: vikramSamvat,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _hinduMonthYearValue(
                  label: 'Shaka Samvat',
                  value: shakaSamvat,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _hinduMonthYearValue(
                  label: 'Samvatsara',
                  value: samvatsara,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _hinduMonthYearValue(
                  label: 'Kali Samvat',
                  value: kaliSamvat,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _hinduMonthYearValue(label: 'Day Duration', value: dayDuration),
        ],
      ),
    );
  }

  void _showLunarMonthPreview({
    required String convention,
    required String amantaMonth,
    required String purnimantaMonth,
    required String locationName,
    required double latitude,
    required double longitude,
  }) {
    String selectedConvention = convention;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final isAmanta = selectedConvention == 'amanta';
            final calculatedMonth = isAmanta ? amantaMonth : purnimantaMonth;

            return SafeArea(
              top: false,
              child: Container(
                margin: const EdgeInsets.fromLTRB(12, 38, 12, 12),
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.86,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBF6),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFE7DBEA)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x26000000),
                      blurRadius: 28,
                      offset: Offset(0, -5),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 22),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 42,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFFD8CBDC),
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF4A3054), Color(0xFF896596)],
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              Icons.brightness_2_rounded,
                              color: Colors.white,
                              size: 25,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppStrings.text(
                                    context,
                                    en: 'Lunar Calendar Explorer',
                                  ),
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF302135),
                                  ),
                                ),
                                SizedBox(height: 3),
                                Text(
                                  AppStrings.text(
                                    context,
                                    en: 'Astro Soul Path',
                                  ),
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF876A90),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.public_rounded,
                            color: Color(0xFF80608A),
                          ),
                        ],
                      ),

                      const SizedBox(height: 18),

                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFF0E5F4), Color(0xFFFFF4DF)],
                          ),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: const Color(0xFFE3D5E6)),
                        ),
                        child: Column(
                          children: [
                            SizedBox(
                              width: double.infinity,
                              height: 118,
                              child: CustomPaint(
                                painter: _AspWorldMapPainter(
                                  latitude: latitude,
                                  longitude: longitude,
                                ),
                              ),
                            ),
                            SizedBox(height: 9),
                            Text(
                              AppStrings.text(
                                context,
                                en: 'Worldwide Panchang',
                              ),
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF453149),
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              AppStrings.text(
                                context,
                                en: 'Explore both lunar month conventions using your current Panchang calculation.',
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11.5,
                                height: 1.4,
                                color: Color(0xFF7D7080),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 19),

                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFDF9),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE6DCE7)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF0E5F3),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.location_on_rounded,
                                size: 20,
                                color: Color(0xFF765184),
                              ),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    AppStrings.text(
                                      context,
                                      en: 'Selected Panchang Location',
                                    ),
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF89788C),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    locationName,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF3B2A40),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${latitude.toStringAsFixed(3)}, ${longitude.toStringAsFixed(3)}',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: Color(0xFF806F84),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        AppStrings.text(
                          context,
                          en: 'Choose calendar convention',
                        ),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF39283E),
                        ),
                      ),
                      const SizedBox(height: 11),

                      _lunarExplorerOption(
                        title: 'Amanta',
                        subtitle: AppStrings.text(
                          context,
                          en: 'New-moon month boundary',
                        ),
                        month: amantaMonth,
                        selected: isAmanta,
                        icon: Icons.dark_mode_outlined,
                        onTap: () {
                          setSheetState(() {
                            selectedConvention = 'amanta';
                          });
                        },
                      ),

                      const SizedBox(height: 10),

                      _lunarExplorerOption(
                        title: 'Purnimanta',
                        subtitle: AppStrings.text(
                          context,
                          en: 'Full-moon month boundary',
                        ),
                        month: purnimantaMonth,
                        selected: !isAmanta,
                        icon: Icons.light_mode_outlined,
                        onTap: () {
                          setSheetState(() {
                            selectedConvention = 'purnimanta';
                          });
                        },
                      ),

                      const SizedBox(height: 15),

                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF4EBF6),
                          borderRadius: BorderRadius.circular(17),
                          border: Border.all(color: const Color(0xFFE3D4E7)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: const BoxDecoration(
                                color: Color(0xFF765184),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.calendar_month_rounded,
                                size: 19,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isAmanta
                                        ? AppStrings.text(
                                            context,
                                            en: 'Amanta calculated month',
                                          )
                                        : AppStrings.text(
                                            context,
                                            en: 'Purnimanta calculated month',
                                          ),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF806F84),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    calculatedMonth,
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF35243A),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 12),

                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            size: 17,
                            color: Color(0xFF866990),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              AppStrings.text(
                                context,
                                en: 'The month values shown here come from your current Panchang response.',
                              ),
                              style: TextStyle(
                                fontSize: 11.5,
                                height: 1.45,
                                color: Color(0xFF776A7A),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 18),

                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () {
                            Navigator.of(sheetContext).pop();
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF43284C),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: Text(
                            AppStrings.text(context, en: 'Done'),
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _lunarExplorerOption({
    required String title,
    required String subtitle,
    required String month,
    required bool selected,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(17),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFF1E7F4) : const Color(0xFFFFFDF9),
            borderRadius: BorderRadius.circular(17),
            border: Border.all(
              color: selected
                  ? const Color(0xFF876294)
                  : const Color(0xFFE7DEE7),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF765184)
                      : const Color(0xFFF1E9F2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  selected ? Icons.check_rounded : icon,
                  size: 20,
                  color: selected ? Colors.white : const Color(0xFF765184),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF35263A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF817486),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                month,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF765184),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openLunarExplorerFromPanchang({
    required String convention,
    required String amantaMonth,
    required String purnimantaMonth,
  }) {
    final location = _selectedPanchangLocation;

    if (location == null) {
      final fieldContext = _panchangCityFocusNode.context;
      if (fieldContext != null) {
        Scrollable.ensureVisible(
          fieldContext,
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOutCubic,
          alignment: 0.22,
        );
      }

      _panchangCityFocusNode.requestFocus();

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Select a city first to open the Lunar Calendar Explorer.',
            ),
            duration: Duration(seconds: 2),
          ),
        );
      return;
    }

    _showLunarMonthPreview(
      convention: convention,
      amantaMonth: amantaMonth,
      purnimantaMonth: purnimantaMonth,
      locationName: location.fullName,
      latitude: location.latitude,
      longitude: location.longitude,
    );
  }

  Widget _hinduMonthYearValue({
    required String label,
    required String value,
    bool showLunarButton = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F3FA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEADFEB)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF806F84),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF302235),
                  ),
                ),
              ],
            ),
          ),
          if (showLunarButton) ...[
            const SizedBox(width: 8),

            // First-sticker style:
            // clearly visible soft-purple button.
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFE9DDF1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCDB5DA), width: 1.2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x245B3A69),
                    blurRadius: 8,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: const Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.nightlight_round,
                    size: 23,
                    color: Color(0xFF684475),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Icon(
                      Icons.auto_awesome,
                      size: 10,
                      color: Color(0xFF9366A5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _auspiciousInauspiciousTimingsCard() {
    final root = _panchang ?? const <String, dynamic>{};
    final timingRoot = _map(root['auspiciousInauspiciousTimings']);

    if (timingRoot.isEmpty) {
      return const SizedBox.shrink();
    }

    final auspicious = _map(timingRoot['auspicious']);
    final inauspicious = _map(timingRoot['inauspicious']);

    String timingValue(Map<String, dynamic> source, String key) {
      final window = _map(source[key]);

      final start = _text(window['start'], fallback: '').trim();
      final end = _text(window['end'], fallback: '').trim();

      if (start.isEmpty || end.isEmpty) {
        return '-';
      }

      return '$start - $end';
    }

    Widget timingRow({
      required String label,
      required String value,
      required bool isAuspicious,
      bool showDivider = true,
    }) {
      final accent = isAuspicious
          ? const Color(0xFF557A58)
          : const Color(0xFF8B5261);

      final background = isAuspicious
          ? const Color(0xFFF0F6EE)
          : const Color(0xFFF9EEF1);

      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 11),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: background,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    isAuspicious
                        ? Icons.auto_awesome_rounded
                        : Icons.schedule_rounded,
                    size: 18,
                    color: accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      color: Color(0xFF66596A),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerRight,
                    child: Text(
                      value,
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: accent,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (showDivider)
            const Divider(height: 1, thickness: 1, color: Color(0xFFF0E8F0)),
        ],
      );
    }

    Widget timingSection({
      required String title,
      required bool isAuspicious,
      required List<Widget> children,
    }) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(15, 14, 15, 5),
        decoration: BoxDecoration(
          color: isAuspicious
              ? const Color(0xFFFBFDF8)
              : const Color(0xFFFFFAFB),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isAuspicious
                ? const Color(0xFFDDE9D8)
                : const Color(0xFFEEDDE2),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: isAuspicious
                    ? const Color(0xFF557A58)
                    : const Color(0xFF8B5261),
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 5),
            ...children,
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCFA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE7D9E9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x126F3D82),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.access_time_filled_rounded,
                size: 21,
                color: Color(0xFF7A4D87),
              ),
              SizedBox(width: 9),
              Expanded(
                child: Text(
                  'Auspicious & Inauspicious Timings',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2D2031),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          timingSection(
            title: 'Auspicious Timings',
            isAuspicious: true,
            children: [
              timingRow(
                label: 'Abhijit Muhurta',
                value: timingValue(auspicious, 'abhijit'),
                isAuspicious: true,
                showDivider: false,
              ),
            ],
          ),

          const SizedBox(height: 12),

          timingSection(
            title: 'Inauspicious Timings',
            isAuspicious: false,
            children: [
              timingRow(
                label: 'Dushta Muhurtas',
                value: timingValue(inauspicious, 'dushtaMuhurtas'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Kantaka / Mrityu',
                value: timingValue(inauspicious, 'kantakaMrityu'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Yamaghanta',
                value: timingValue(inauspicious, 'yamaghanta'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Rahu Kaal',
                value: timingValue(inauspicious, 'rahuKaal'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Kulika',
                value: timingValue(inauspicious, 'kulika'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Kalavela',
                value: timingValue(inauspicious, 'kalavela'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Yamaganda',
                value: timingValue(inauspicious, 'yamaganda'),
                isAuspicious: false,
              ),
              timingRow(
                label: 'Gulika Kaal',
                value: timingValue(inauspicious, 'gulikaKaal'),
                isAuspicious: false,
                showDivider: false,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chandrabalamTarabalamCard() {
    final root = _map(_panchang);
    final bala = _map(root['chandrabalamTarabalam']);

    final taraRaw = bala['taraBala'];
    final chandraRaw = bala['chandraBala'];

    final taraBala = taraRaw is List
        ? taraRaw
              .map((value) => value?.toString().trim() ?? '')
              .where((value) => value.isNotEmpty)
              .toList(growable: false)
        : const <String>[];

    final chandraBala = chandraRaw is List
        ? chandraRaw
              .map((value) => value?.toString().trim() ?? '')
              .where((value) => value.isNotEmpty)
              .toList(growable: false)
        : const <String>[];

    // Never invent or substitute Bala values in the UI.
    if (taraBala.isEmpty && chandraBala.isEmpty) {
      return const SizedBox.shrink();
    }

    final title = AppStrings.text(context, en: 'Chandrabalam And Tarabalam');

    final taraLabel = AppStrings.text(context, en: 'Tara Bala');

    final chandraLabel = AppStrings.text(context, en: 'Chandra Bala');

    Widget balaSection({
      required String label,
      required List<String> values,
      required IconData icon,
    }) {
      if (values.isEmpty) {
        return const SizedBox.shrink();
      }

      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBF5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE8D9C8)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFF1E7F4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: const Color(0xFF684475)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF513A5C),
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    values.join(', '),
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.45,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF453B42),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8EE),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE6D4C0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x12000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
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
                    color: const Color(0xFFEADDF0),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: Color(0xFF684475),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF35263D),
                    ),
                  ),
                ),
              ],
            ),
            if (taraBala.isNotEmpty) ...[
              const SizedBox(height: 14),
              balaSection(
                label: taraLabel,
                values: taraBala,
                icon: Icons.star_outline_rounded,
              ),
            ],
            if (chandraBala.isNotEmpty) ...[
              const SizedBox(height: 10),
              balaSection(
                label: chandraLabel,
                values: chandraBala,
                icon: Icons.nightlight_round,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _dishaShoolaCard() {
    final root = _map(_panchang);
    final disha = _map(root['dishaShoola']);

    final direction = _text(disha['direction'], fallback: '').trim();

    // Never invent a direction in Flutter.
    // If backend has no calculated value, hide the card.
    if (direction.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8EE),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE9DCCB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFF0E4F3),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.explore_outlined,
              color: Color(0xFF684475),
              size: 23,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.text(context, en: 'Disha Shoola'),
                  style: const TextStyle(
                    color: Color(0xFF35283D),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  AppStrings.text(context, en: 'Direction to avoid today'),
                  style: const TextStyle(
                    color: Color(0xFF786C7D),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFD9C8DF)),
            ),
            child: Text(
              direction,
              maxLines: 1,
              softWrap: false,
              style: const TextStyle(
                color: Color(0xFF55375F),
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sunMoonCalculationsCard() {
    final root = _panchang ?? const <String, dynamic>{};
    final sunMoon = _map(root['sunMoon']);

    String backendValue(String key) {
      final value = _text(sunMoon[key], fallback: '').trim();
      return value.isEmpty ? '-' : value;
    }

    return _sectionCard(
      accent: true,
      title: 'Sun And Moon Calculations',
      subtitle: _text(root['date']),
      children: [
        _sunMoonCalculationRow(
          leftLabel: 'Sun Rise',
          leftValue: backendValue('sunrise'),
          rightLabel: 'Moon Rise',
          rightValue: backendValue('moonrise'),
        ),
        _sunMoonCalculationRow(
          leftLabel: 'Moon Sign',
          leftValue: backendValue('moonSign'),
          rightLabel: 'Sun Set',
          rightValue: backendValue('sunset'),
        ),
        _sunMoonCalculationRow(
          leftLabel: 'Moon Set',
          leftValue: backendValue('moonset'),
          rightLabel: 'Ritu',
          rightValue: backendValue('ritu'),
          showDivider: false,
        ),
      ],
    );
  }

  Widget _sunMoonCalculationRow({
    required String leftLabel,
    required String leftValue,
    required String rightLabel,
    required String rightValue,
    bool showDivider = true,
  }) {
    Widget valueBlock(String label, String value) {
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF786C7B),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                value,
                style: const TextStyle(
                  color: Color(0xFF34253B),
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            valueBlock(leftLabel, leftValue),
            Container(
              width: 1,
              height: 48,
              margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              color: const Color(0xFFE8DEE9),
            ),
            valueBlock(rightLabel, rightValue),
          ],
        ),
        if (showDivider) const Divider(height: 1, color: Color(0xFFECE3ED)),
      ],
    );
  }

  String _panchangDisplayTime(dynamic raw) {
    final text = _text(raw, fallback: '').trim();

    if (text.isEmpty) {
      return '';
    }

    // Backend may already provide a clean local time such as "11:07 PM".
    final cleanTime = RegExp(
      r'^\d{1,2}:\d{2}\s*(AM|PM)$',
      caseSensitive: false,
    );

    if (cleanTime.hasMatch(text)) {
      return text.toUpperCase();
    }

    // Some runtime responses can contain an ISO UTC instant.
    // Convert it to a compact clock value for display only.
    final parsed = DateTime.tryParse(text);

    if (parsed == null) {
      return text;
    }

    final hour24 = parsed.hour;
    final minute = parsed.minute;

    final suffix = hour24 >= 12 ? 'PM' : 'AM';

    var hour12 = hour24 % 12;
    if (hour12 == 0) {
      hour12 = 12;
    }

    return '${hour12.toString().padLeft(2, '0')}:'
        '${minute.toString().padLeft(2, '0')} $suffix';
  }

  Widget _panchangKaranaValue(
    dynamic sequenceValue,
    dynamic fallbackValue,
    dynamic fallbackEndTime,
  ) {
    final sequence = sequenceValue is List
        ? sequenceValue
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
        : <Map<String, dynamic>>[];

    if (sequence.isEmpty) {
      return _panchangTimedValue('Karana', fallbackValue, fallbackEndTime);
    }

    final names = <String>[];
    final times = <String>[];

    for (final item in sequence) {
      final name = item['name']?.toString().trim() ?? '';
      final time = item['endTime']?.toString().trim() ?? '';

      if (name.isNotEmpty) {
        names.add(name);
      }

      if (time.isNotEmpty) {
        times.add(_panchangDisplayTime(time));
      }
    }

    if (names.isEmpty) {
      return _panchangTimedValue('Karana', fallbackValue, fallbackEndTime);
    }

    final displayValue = <String, dynamic>{'name': names.join(', ')};

    final displayTime = times.isEmpty ? fallbackEndTime : times.join(' / ');

    return _panchangTimedValue('Karana', displayValue, displayTime);
  }

  Widget _panchangTimedValue(String label, dynamic raw, dynamic rawEndTime) {
    final time = _panchangDisplayTime(rawEndTime);
    final isKarana = label == 'Karana';

    String value;

    if (raw is Map) {
      final mapped = _map(raw);
      value = _text(mapped['name'], fallback: _text(mapped['value']));
    } else {
      value = _text(raw);
    }

    if (time.isEmpty) {
      return _factRow(label, value);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 105,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF776B7C),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFF24152F),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              minWidth: 70,
              maxWidth: isKarana ? 125 : 100,
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(
                time,
                maxLines: 1,
                softWrap: false,
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: Color(0xFF24152F),
                  fontSize: 13,
                  fontWeight: isKarana ? FontWeight.w800 : FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _panchangValue(String label, dynamic raw) {
    if (raw is Map) {
      final value = _map(raw);

      return _factRow(
        label,
        _text(value['name'], fallback: _text(value['value'])),
      );
    }

    return _factRow(label, _text(raw));
  }

  Widget _sectionCard({
    required String title,
    required String subtitle,
    required List<Widget> children,
    bool accent = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: accent ? const Color(0xFFFFFCFA) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accent ? const Color(0xFFE7D9E9) : const Color(0xFFE8DED4),
        ),
        boxShadow: [
          BoxShadow(
            color: accent ? const Color(0x126F3D82) : const Color(0x0D000000),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF24152F),
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            subtitle,
            style: const TextStyle(color: Color(0xFF7A6C80), fontSize: 12),
          ),
          const SizedBox(height: 15),
          ...children,
        ],
      ),
    );
  }

  Widget _factRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF776B7C),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF24152F),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCFA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE9DFEB), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D281A32),
            blurRadius: 14,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 32,
            color: Color(0xFF7B506F),
          ),
          const SizedBox(height: 10),
          Text(
            _error ?? 'Unable to load horoscope.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF4B3E4F)),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: _load, child: const Text('Try again')),
        ],
      ),
    );
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);

    return <String, dynamic>{};
  }

  String _text(dynamic value, {String fallback = '-'}) {
    if (value == null) return fallback;

    final text = value.toString().trim();

    return text.isEmpty ? fallback : text;
  }
}
