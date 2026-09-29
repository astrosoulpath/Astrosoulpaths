import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../kundli/data/kundli_api.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../profile/data/profile_api.dart';

class PredictionsScreen extends StatefulWidget {
  const PredictionsScreen({super.key});

  @override
  State<PredictionsScreen> createState() => _PredictionsScreenState();
}

class _PredictionsScreenState extends State<PredictionsScreen> {
  static const Color _background = Color(0xFFFFF8EE);
  static const Color _navy = Color(0xFF17233C);
  static const Color _purple = Color(0xFF6F4A8E);
  static const Color _border = Color(0xFFE8DCEC);

  final ProfileApi _profileApi = ProfileApi();
  final KundliApi _kundliApi = KundliApi();

  CustomerProfile? _profile;
  KundliReport? _report;
  TimeOfDay? _editedBirthTime;
  String? _editedBirthCity;
  double? _editedLatitude;
  double? _editedLongitude;
  double? _editedTimezone;
  bool _makeDefaultCity = false;

  bool _loadingProfile = true;
  bool _loadingPredictions = false;

  String _error = '';
  bool _loginRequired = false;
  bool _subscriptionRequired = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _profileApi.close();
    _kundliApi.close();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    if (mounted) {
      setState(() {
        _loadingProfile = true;
        _error = '';
        _loginRequired = false;
        _subscriptionRequired = false;
      });
    }

    try {
      final profiles = await _profileApi.getProfiles();

      if (!mounted) {
        return;
      }

      final usableProfiles = profiles.where((profile) => !profile.isDeleted);

      setState(() {
        _profile = usableProfiles.isEmpty ? null : usableProfiles.first;
      });
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to load your saved birth profile.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingProfile = false;
        });
      }
    }
  }

  String _displayBirthTime(CustomerProfile profile) {
    final edited = _editedBirthTime;

    if (edited != null) {
      final hour = edited.hour.toString().padLeft(2, '0');
      final minute = edited.minute.toString().padLeft(2, '0');
      return '$hour:$minute:00';
    }

    if (profile.birthTimeKnown && profile.birthTime.trim().isNotEmpty) {
      return profile.birthTime.trim();
    }

    return 'Birth time not known';
  }

  String _displayBirthPlace(CustomerProfile profile) {
    final city = _editedBirthCity?.trim() ?? '';

    if (city.isNotEmpty) {
      return city;
    }

    return _placeText(profile);
  }

  Future<void> _changeBirthTime(CustomerProfile profile) async {
    TimeOfDay initialTime = const TimeOfDay(hour: 12, minute: 0);

    if (_editedBirthTime != null) {
      initialTime = _editedBirthTime!;
    } else {
      final parts = profile.birthTime.trim().split(':');

      if (parts.length >= 2) {
        final hour = int.tryParse(parts[0]);
        final minute = int.tryParse(parts[1]);

        if (hour != null &&
            minute != null &&
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59) {
          initialTime = TimeOfDay(hour: hour, minute: minute);
        }
      }
    }

    final selected = await showTimePicker(
      context: context,
      initialTime: initialTime,
      helpText: 'Select exact birth time',
    );

    if (selected == null || !mounted) {
      return;
    }

    setState(() {
      _editedBirthTime = selected;

      // Existing report belongs to old birth details.
      _report = null;
      _error = '';
    });
  }

  Future<void> _openManualBirthPlaceEditor(CustomerProfile profile) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _ManualBirthPlaceSheet(
          initialCity: _editedBirthCity?.trim().isNotEmpty == true
              ? _editedBirthCity!.trim()
              : (profile.city?.trim() ?? ''),
          initialLatitude: _editedLatitude ?? profile.latitude,
          initialLongitude: _editedLongitude ?? profile.longitude,
          initialTimezone: _editedTimezone ?? profile.timezone,
          initialMakeDefault: _makeDefaultCity,
        );
      },
    );

    if (!mounted || result == null) {
      return;
    }

    setState(() {
      _editedBirthCity = result['city'] as String;
      _editedLatitude = result['latitude'] as double;
      _editedLongitude = result['longitude'] as double;
      _editedTimezone = result['timezone'] as double;
      _makeDefaultCity = result['makeDefault'] as bool? ?? false;

      // Existing report belongs to the previous birth details.
      _report = null;
      _error = '';
    });
  }

  Future<void> _loadPredictions() async {
    if (_profile == null || _loadingPredictions) {
      return;
    }

    setState(() {
      _loadingPredictions = true;
      _error = '';
      _loginRequired = false;
      _subscriptionRequired = false;
    });

    try {
      // IMPORTANT:
      // This is the same authenticated real Kundli source already used by
      // CustomerKundliScreen. No local/random prediction is generated here.
      final languageCode = Localizations.localeOf(context).languageCode;
      final profile = _profile!;
      final editedTime = _editedBirthTime;

      final birthTimeOverride = editedTime == null
          ? null
          : '${editedTime.hour.toString().padLeft(2, '0')}:'
                '${editedTime.minute.toString().padLeft(2, '0')}:00';

      final hasLocationOverride =
          _editedBirthCity != null ||
          _editedLatitude != null ||
          _editedLongitude != null ||
          _editedTimezone != null;

      final report = await _kundliApi.generateMyKundli(
        language: languageCode,
        birthTimeOverride: birthTimeOverride,
        latitudeOverride: hasLocationOverride
            ? (_editedLatitude ?? profile.latitude)
            : null,
        longitudeOverride: hasLocationOverride
            ? (_editedLongitude ?? profile.longitude)
            : null,
        timezoneOverride: hasLocationOverride
            ? (_editedTimezone ?? profile.timezone)
            : null,
        birthPlaceOverride: hasLocationOverride
            ? _displayBirthPlace(profile)
            : null,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _report = report;
      });
      if (_makeDefaultCity &&
          _editedBirthCity != null &&
          _editedLatitude != null &&
          _editedLongitude != null &&
          _editedTimezone != null) {
        try {
          final updatedProfile = await _profileApi.updateProfile(
            profileId: profile.id,
            city: _editedBirthCity,
            lat: _editedLatitude,
            lon: _editedLongitude,
            timezone: _editedTimezone,
          );

          if (mounted) {
            setState(() {
              _profile = updatedProfile;
              _makeDefaultCity = false;
            });
          }
        } catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Predictions generated, but default city could not be saved: $error',
                ),
              ),
            );
          }
        }
      }
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _loginRequired = error.loginRequired;
        _subscriptionRequired = error.subscriptionRequired;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to generate predictions right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingPredictions = false;
        });
      }
    }
  }

  String _dateText(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');

    return '$day/$month/${date.year}';
  }

  String _placeText(CustomerProfile profile) {
    final parts = <String>[
      if ((profile.city ?? '').trim().isNotEmpty) profile.city!.trim(),
      if ((profile.state ?? '').trim().isNotEmpty) profile.state!.trim(),
      if ((profile.country ?? '').trim().isNotEmpty) profile.country!.trim(),
    ];

    if (parts.isNotEmpty) {
      return parts.join(', ');
    }

    return '${profile.latitude.toStringAsFixed(4)}, '
        '${profile.longitude.toStringAsFixed(4)}';
  }

  String _prettyKey(Object? key) {
    final raw = key?.toString().trim() ?? '';

    if (raw.isEmpty) {
      return '';
    }

    final spaced = raw
        .replaceAllMapped(
          RegExp(r'([a-z0-9])([A-Z])'),
          (match) => '${match.group(1)} ${match.group(2)}',
        )
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim();

    if (spaced.isEmpty) {
      return '';
    }

    return spaced
        .split(RegExp(r'\s+'))
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1)}',
        )
        .join(' ');
  }

  String _predictionText(dynamic value, {int depth = 0}) {
    if (value == null) {
      return 'No prediction data available.';
    }

    if (value is String) {
      final text = value.trim();
      return text.isEmpty ? 'No prediction data available.' : text;
    }

    if (value is num || value is bool) {
      return value.toString();
    }

    if (value is List) {
      if (value.isEmpty) {
        return 'No prediction data available.';
      }

      final rows = <String>[];

      for (final item in value) {
        final text = _predictionText(item, depth: depth + 1).trim();

        if (text.isNotEmpty && text != 'No prediction data available.') {
          rows.add(
            'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ $text',
          );
        }
      }

      return rows.isEmpty ? 'No prediction data available.' : rows.join('\n\n');
    }

    if (value is Map) {
      if (value.isEmpty) {
        return 'No prediction data available.';
      }

      for (final key in const [
        'summary',
        'prediction',
        'description',
        'interpretation',
        'reading',
        'text',
        'message',
        'overview',
        'guidance',
      ]) {
        if (!value.containsKey(key)) {
          continue;
        }

        final text = _predictionText(value[key], depth: depth + 1).trim();

        if (text.isNotEmpty && text != 'No prediction data available.') {
          return text;
        }
      }

      final sections = <String>[];

      for (final entry in value.entries) {
        final text = _predictionText(entry.value, depth: depth + 1).trim();

        if (text.isEmpty || text == 'No prediction data available.') {
          continue;
        }

        final title = _prettyKey(entry.key);

        sections.add(title.isEmpty ? text : '$title\n$text');
      }

      return sections.isEmpty
          ? 'No prediction data available.'
          : sections.join('\n\n');
    }

    try {
      return const JsonEncoder.withIndent('  ').convert(value);
    } catch (_) {
      return value.toString();
    }
  }

  void _openPrediction({
    required String title,
    required IconData icon,
    required dynamic value,
  }) {
    final text = _predictionText(value);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.58,
          minChildSize: 0.35,
          maxChildSize: 0.90,
          expand: false,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFFFFFBF5),
                borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD8CEDC),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF1E8F7),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, color: _purple, size: 23),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(
                              color: _navy,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
                      child: SelectableText(
                        text,
                        style: const TextStyle(
                          color: Color(0xFF403847),
                          fontSize: 15,
                          height: 1.55,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    final report = _report;

    return Scaffold(
      backgroundColor: _background,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: _background,
        foregroundColor: _navy,
        centerTitle: true,
        title: const Text(
          'Predictions',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadProfile,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
            children: [
              const _PredictionHero(),
              const SizedBox(height: 20),

              const Text(
                'Birth details',
                style: TextStyle(
                  color: _navy,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),

              if (_loadingProfile)
                const _LoadingCard(text: 'Loading your saved birth details...')
              else if (profile == null)
                _EmptyProfileCard(onRetry: _loadProfile)
              else
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: _border),
                  ),
                  child: Column(
                    children: [
                      _BirthRow(
                        icon: Icons.person_outline_rounded,
                        label: 'Name',
                        value: profile.fullName?.trim().isNotEmpty == true
                            ? profile.fullName!.trim()
                            : profile.name,
                      ),
                      const Divider(height: 22),
                      _BirthRow(
                        icon: Icons.calendar_month_outlined,
                        label: 'Date of birth',
                        value: _dateText(profile.birthDate),
                      ),
                      const Divider(height: 22),
                      _BirthRow(
                        icon: Icons.schedule_rounded,
                        label: 'Time of birth',
                        value: _displayBirthTime(profile),
                        actionLabel: 'Change',
                        onAction: () => _changeBirthTime(profile),
                      ),
                      const Divider(height: 22),
                      _BirthRow(
                        icon: Icons.location_on_outlined,
                        label: 'Birth place',
                        value: _displayBirthPlace(profile),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () =>
                                  _openManualBirthPlaceEditor(profile),
                              icon: const Icon(
                                Icons.edit_location_alt_outlined,
                                size: 18,
                              ),
                              label: const Text('Fill City Manually'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _purple,
                                side: const BorderSide(color: _border),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(13),
                                ),
                              ),
                            ),
                          ),
                          if (_editedBirthCity != null) ...[
                            const SizedBox(width: 10),
                            Tooltip(
                              message: _makeDefaultCity
                                  ? 'Default city selected'
                                  : 'Current prediction only',
                              child: Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: _makeDefaultCity
                                      ? const Color(0xFFECE1F3)
                                      : const Color(0xFFF5F0F6),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  _makeDefaultCity
                                      ? Icons.check_circle_rounded
                                      : Icons.check_circle_outline_rounded,
                                  color: _purple,
                                  size: 21,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

              if (_error.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                _ErrorCard(
                  message: _error,
                  loginRequired: _loginRequired,
                  subscriptionRequired: _subscriptionRequired,
                  onRetry: profile == null ? _loadProfile : _loadPredictions,
                ),
              ],

              const SizedBox(height: 20),

              const Text(
                'Your predictions',
                style: TextStyle(
                  color: _navy,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),

              if (report != null) ...[
                _KundliStatusCard(report: report),
                const SizedBox(height: 12),
              ],

              if (report == null)
                _PredictionLockedCard(loading: _loadingPredictions)
              else ...[
                Row(
                  children: [
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.work_outline_rounded,
                        title: 'Career',
                        subtitle: 'Work & growth',
                        onTap: () => _openPrediction(
                          title: 'Career',
                          icon: Icons.work_outline_rounded,
                          value: report.career,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.favorite_border_rounded,
                        title: 'Love',
                        subtitle: 'Marriage & bonds',
                        onTap: () => _openPrediction(
                          title: 'Love & Marriage',
                          icon: Icons.favorite_border_rounded,
                          value: report.marriage,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'Finance',
                        subtitle: 'Money & stability',
                        onTap: () => _openPrediction(
                          title: 'Finance',
                          icon: Icons.account_balance_wallet_outlined,
                          value: report.finance,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.health_and_safety_outlined,
                        title: 'Health',
                        subtitle: 'Well-being',
                        onTap: () => _openPrediction(
                          title: 'Health',
                          icon: Icons.health_and_safety_outlined,
                          value: report.health,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.timeline_rounded,
                        title: 'Dasha',
                        subtitle: 'Life periods',
                        onTap: () => _openPrediction(
                          title: 'Dasha',
                          icon: Icons.timeline_rounded,
                          value: report.dasha,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PredictionTile(
                        icon: Icons.public_rounded,
                        title: 'Transit',
                        subtitle: 'Current influences',
                        onTap: () => _openPrediction(
                          title: 'Transit',
                          icon: Icons.public_rounded,
                          value: report.transit,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 20),

              SizedBox(
                height: 52,
                child: FilledButton.icon(
                  onPressed: profile == null || _loadingPredictions
                      ? null
                      : _loadPredictions,
                  style: FilledButton.styleFrom(
                    backgroundColor: _purple,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: _purple.withValues(alpha: 0.45),
                    disabledForegroundColor: Colors.white.withValues(
                      alpha: 0.75,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  icon: _loadingPredictions
                      ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : Icon(
                          report == null
                              ? Icons.auto_awesome_rounded
                              : Icons.refresh_rounded,
                        ),
                  label: Text(
                    _loadingPredictions
                        ? 'Reading your Kundli...'
                        : report == null
                        ? 'Show Predictions'
                        : 'Refresh Predictions',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 10),

              const Text(
                'Predictions are generated from your saved birth details and Vedic Kundli data.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF716779),
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PredictionHero extends StatelessWidget {
  const _PredictionHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6F4A8E), Color(0xFF8B65A7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A4E2F61),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: const Row(
        children: [
          _HeroIcon(),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Personalized Vedic Predictions',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  'Insights from your birth chart, Dasha and current planetary transits.',
                  style: TextStyle(
                    color: Color(0xFFF7EFFB),
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroIcon extends StatelessWidget {
  const _HeroIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: const BoxDecoration(
        color: Color(0x22FFFFFF),
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.auto_awesome_rounded,
        color: Colors.white,
        size: 29,
      ),
    );
  }
}

class _BirthRow extends StatelessWidget {
  const _BirthRow({
    required this.icon,
    required this.label,
    required this.value,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: Color(0xFFF1E8F7),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 19, color: const Color(0xFF6F4A8E)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF776F7C),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: Color(0xFF17233C),
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(width: 8),
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF6F4A8E),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              actionLabel!,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ],
    );
  }
}

InputDecoration _manualInputDecoration(String label) {
  return InputDecoration(
    labelText: label,
    labelStyle: const TextStyle(color: Color(0xFF776F7C), fontSize: 12),
    filled: true,
    fillColor: Colors.white,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(13),
      borderSide: const BorderSide(color: Color(0xFFE8DCEC)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(13),
      borderSide: const BorderSide(color: Color(0xFF6F4A8E), width: 1.4),
    ),
  );
}

class _ManualBirthPlaceSheet extends StatefulWidget {
  const _ManualBirthPlaceSheet({
    required this.initialCity,
    required this.initialLatitude,
    required this.initialLongitude,
    required this.initialTimezone,
    required this.initialMakeDefault,
  });

  final String initialCity;
  final double initialLatitude;
  final double initialLongitude;
  final double initialTimezone;
  final bool initialMakeDefault;

  @override
  State<_ManualBirthPlaceSheet> createState() => _ManualBirthPlaceSheetState();
}

class _ManualBirthPlaceSheetState extends State<_ManualBirthPlaceSheet> {
  late final TextEditingController _cityController;
  late final TextEditingController _latitudeDegreeController;
  late final TextEditingController _latitudeMinuteController;
  late final TextEditingController _longitudeDegreeController;
  late final TextEditingController _longitudeMinuteController;
  late final TextEditingController _timezoneController;

  late String _latitudeDirection;
  late String _longitudeDirection;
  late bool _makeDefault;

  String _validationError = '';

  @override
  void initState() {
    super.initState();

    final latitudeAbs = widget.initialLatitude.abs();
    final longitudeAbs = widget.initialLongitude.abs();

    _cityController = TextEditingController(text: widget.initialCity);

    _latitudeDegreeController = TextEditingController(
      text: latitudeAbs.floor().toString(),
    );

    _latitudeMinuteController = TextEditingController(
      text: ((latitudeAbs - latitudeAbs.floor()) * 60).toStringAsFixed(2),
    );

    _longitudeDegreeController = TextEditingController(
      text: longitudeAbs.floor().toString(),
    );

    _longitudeMinuteController = TextEditingController(
      text: ((longitudeAbs - longitudeAbs.floor()) * 60).toStringAsFixed(2),
    );

    _timezoneController = TextEditingController(
      text: widget.initialTimezone.toString(),
    );

    _latitudeDirection = widget.initialLatitude < 0 ? 'S' : 'N';
    _longitudeDirection = widget.initialLongitude < 0 ? 'W' : 'E';
    _makeDefault = widget.initialMakeDefault;
  }

  @override
  void dispose() {
    _cityController.dispose();
    _latitudeDegreeController.dispose();
    _latitudeMinuteController.dispose();
    _longitudeDegreeController.dispose();
    _longitudeMinuteController.dispose();
    _timezoneController.dispose();

    super.dispose();
  }

  void _submit() {
    final city = _cityController.text.trim();

    final latitudeDegree = double.tryParse(
      _latitudeDegreeController.text.trim(),
    );

    final latitudeMinute = double.tryParse(
      _latitudeMinuteController.text.trim(),
    );

    final longitudeDegree = double.tryParse(
      _longitudeDegreeController.text.trim(),
    );

    final longitudeMinute = double.tryParse(
      _longitudeMinuteController.text.trim(),
    );

    final timezone = double.tryParse(_timezoneController.text.trim());

    if (city.isEmpty) {
      setState(() {
        _validationError = 'Please enter the birth city.';
      });
      return;
    }

    if (latitudeDegree == null ||
        latitudeMinute == null ||
        latitudeDegree < 0 ||
        latitudeDegree > 90 ||
        latitudeMinute < 0 ||
        latitudeMinute >= 60) {
      setState(() {
        _validationError = 'Please enter a valid latitude.';
      });
      return;
    }

    if (longitudeDegree == null ||
        longitudeMinute == null ||
        longitudeDegree < 0 ||
        longitudeDegree > 180 ||
        longitudeMinute < 0 ||
        longitudeMinute >= 60) {
      setState(() {
        _validationError = 'Please enter a valid longitude.';
      });
      return;
    }

    if (timezone == null || timezone < -12 || timezone > 14) {
      setState(() {
        _validationError = 'Timezone must be between -12 and +14.';
      });
      return;
    }

    var latitude = latitudeDegree + (latitudeMinute / 60);
    var longitude = longitudeDegree + (longitudeMinute / 60);

    if (_latitudeDirection == 'S') {
      latitude = -latitude;
    }

    if (_longitudeDirection == 'W') {
      longitude = -longitude;
    }

    Navigator.of(context).pop(<String, dynamic>{
      'city': city,
      'latitude': latitude,
      'longitude': longitude,
      'timezone': timezone,
      'makeDefault': _makeDefault,
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          18,
          12,
          18,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFFFFF8EE),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD8CCD9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Row(
                children: [
                  CircleAvatar(
                    radius: 21,
                    backgroundColor: Color(0xFFF1E8F7),
                    child: Icon(
                      Icons.location_on_outlined,
                      color: Color(0xFF6F4A8E),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Fill City Manually',
                          style: TextStyle(
                            color: Color(0xFF17233C),
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Enter exact birth-place coordinates',
                          style: TextStyle(
                            color: Color(0xFF776F7C),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              _ManualField(
                controller: _cityController,
                label: 'City',
                hint: 'e.g. Samastipur',
                icon: Icons.location_city_outlined,
              ),

              const SizedBox(height: 16),
              const Text(
                'Latitude',
                style: TextStyle(
                  color: Color(0xFF17233C),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: _ManualField(
                      controller: _latitudeDegreeController,
                      label: 'Degree',
                      hint: '25',
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ManualField(
                      controller: _latitudeMinuteController,
                      label: 'Minute',
                      hint: '51',
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 76,
                    child: DropdownButtonFormField<String>(
                      initialValue: _latitudeDirection,
                      decoration: _manualInputDecoration('N/S'),
                      items: const [
                        DropdownMenuItem(value: 'N', child: Text('N')),
                        DropdownMenuItem(value: 'S', child: Text('S')),
                      ],
                      onChanged: (value) {
                        if (value == null) {
                          return;
                        }

                        setState(() {
                          _latitudeDirection = value;
                        });
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),
              const Text(
                'Longitude',
                style: TextStyle(
                  color: Color(0xFF17233C),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: _ManualField(
                      controller: _longitudeDegreeController,
                      label: 'Degree',
                      hint: '85',
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ManualField(
                      controller: _longitudeMinuteController,
                      label: 'Minute',
                      hint: '47',
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 76,
                    child: DropdownButtonFormField<String>(
                      initialValue: _longitudeDirection,
                      decoration: _manualInputDecoration('E/W'),
                      items: const [
                        DropdownMenuItem(value: 'E', child: Text('E')),
                        DropdownMenuItem(value: 'W', child: Text('W')),
                      ],
                      onChanged: (value) {
                        if (value == null) {
                          return;
                        }

                        setState(() {
                          _longitudeDirection = value;
                        });
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              _ManualField(
                controller: _timezoneController,
                label: 'Timezone',
                hint: '5.5',
                icon: Icons.public_rounded,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
              ),

              const SizedBox(height: 8),

              CheckboxListTile(
                value: _makeDefault,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: const Color(0xFF6F4A8E),
                title: const Text(
                  'Make it default city',
                  style: TextStyle(
                    color: Color(0xFF17233C),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'Use this city automatically next time.',
                  style: TextStyle(color: Color(0xFF776F7C), fontSize: 12),
                ),
                onChanged: (value) {
                  setState(() {
                    _makeDefault = value ?? false;
                  });
                },
              ),

              if (_validationError.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  _validationError,
                  style: const TextStyle(
                    color: Color(0xFFB42318),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF6F4A8E),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(fontWeight: FontWeight.w800),
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

class _ManualField extends StatelessWidget {
  const _ManualField({
    required this.controller,
    required this.label,
    required this.hint,
    this.icon,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData? icon;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: TextInputAction.next,
      style: const TextStyle(
        color: Color(0xFF17233C),
        fontWeight: FontWeight.w600,
      ),
      decoration: _manualInputDecoration(label).copyWith(
        hintText: hint,
        prefixIcon: icon == null
            ? null
            : Icon(icon, size: 19, color: const Color(0xFF6F4A8E)),
      ),
    );
  }
}

class _PredictionTile extends StatelessWidget {
  const _PredictionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(17),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(17),
        child: Container(
          height: 105,
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: const Color(0xFFE8DCEC)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: const Color(0xFF6F4A8E), size: 23),
              const Spacer(),
              Text(
                title,
                style: const TextStyle(
                  color: Color(0xFF17233C),
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF817687),
                  fontSize: 11.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8DCEC)),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              color: Color(0xFF6F4A8E),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Color(0xFF17233C),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyProfileCard extends StatelessWidget {
  const _EmptyProfileCard({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8DCEC)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.person_add_alt_1_rounded,
            color: Color(0xFF6F4A8E),
            size: 30,
          ),
          const SizedBox(height: 10),
          const Text(
            'Birth profile not found',
            style: TextStyle(
              color: Color(0xFF17233C),
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Add your birth details in your profile before generating predictions.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF716779), height: 1.4),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({
    required this.message,
    required this.onRetry,
    required this.loginRequired,
    required this.subscriptionRequired,
  });

  final String message;
  final VoidCallback onRetry;
  final bool loginRequired;
  final bool subscriptionRequired;

  @override
  Widget build(BuildContext context) {
    final title = loginRequired
        ? 'Login required'
        : subscriptionRequired
        ? 'Subscription required'
        : 'Unable to load predictions';

    final icon = loginRequired
        ? Icons.login_rounded
        : subscriptionRequired
        ? Icons.workspace_premium_outlined
        : Icons.info_outline_rounded;

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF2F0),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0C9C3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: const Color(0xFF9A4337)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFF74372F),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            message,
            style: const TextStyle(color: Color(0xFF74372F), height: 1.4),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ),
        ],
      ),
    );
  }
}

class _KundliStatusCard extends StatelessWidget {
  const _KundliStatusCard({required this.report});

  final KundliReport report;

  @override
  Widget build(BuildContext context) {
    final complete = report.isComplete;

    final statusText = report.status.trim().isEmpty
        ? 'Available'
        : report.status.trim().toLowerCase().replaceAll('_', ' ');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F2FB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D8EC)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFEDE1F3),
              shape: BoxShape.circle,
            ),
            child: Icon(
              complete ? Icons.verified_rounded : Icons.data_usage_rounded,
              color: const Color(0xFF6F4A8E),
              size: 21,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  complete ? 'Vedic Kundli ready' : 'Vedic Kundli $statusText',
                  style: const TextStyle(
                    color: Color(0xFF17233C),
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PredictionLockedCard extends StatelessWidget {
  const _PredictionLockedCard({required this.loading});

  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8DCEC)),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome_rounded, color: Color(0xFF6F4A8E)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              loading
                  ? 'Reading your real Kundli data...'
                  : 'Tap Show Predictions to read your Kundli-based insights.',
              style: const TextStyle(
                color: Color(0xFF514858),
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
