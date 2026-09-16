import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../profile/data/geo_api.dart';
import '../../../profile/data/profile_api.dart';

class CustomerBirthOnboardingScreen extends StatefulWidget {
  const CustomerBirthOnboardingScreen({this.existingProfile, super.key});

  final CustomerProfile? existingProfile;

  @override
  State<CustomerBirthOnboardingScreen> createState() =>
      _CustomerBirthOnboardingScreenState();
}

class _CustomerBirthOnboardingScreenState
    extends State<CustomerBirthOnboardingScreen> {
  final ProfileApi _profileApi = ProfileApi();
  final GeoApi _geoApi = GeoApi();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();

  Timer? _cityDebounce;

  int _step = 0;

  bool _saving = false;
  bool _searchingCity = false;
  bool _birthTimeKnown = true;

  DateTime? _birthDate;
  TimeOfDay? _birthTime;

  String _gender = 'MALE';
  String _language = 'en';

  List<GeoSuggestion> _suggestions = [];

  String _city = '';
  String _state = '';
  String _country = '';
  String _countryCode = '';
  String _timezoneName = '';

  double _latitude = 0;
  double _longitude = 0;
  double _timezone = 0;

  static const List<String> _languages = <String>[
    'en',
    'hi',
    'bn',
    'ta',
    'te',
    'mr',
    'gu',
    'kn',
    'ml',
    'pa',
  ];

  @override
  void initState() {
    super.initState();

    final profile = widget.existingProfile;

    if (profile != null) {
      _birthTimeKnown = profile.birthTimeKnown;
      _nameController.text = profile.fullName ?? profile.name;

      _birthDate = profile.birthDate;

      final timeParts = profile.birthTime.split(':');

      if (timeParts.length >= 2) {
        final hour = int.tryParse(timeParts[0]);
        final minute = int.tryParse(timeParts[1]);

        if (hour != null && minute != null) {
          _birthTime = TimeOfDay(hour: hour, minute: minute);
        }
      }

      _city = profile.city ?? '';
      _state = profile.state ?? '';
      _country = profile.country ?? '';
      _countryCode = profile.countryCode ?? '';
      _timezoneName = profile.timezoneName ?? '';

      _latitude = profile.latitude;
      _longitude = profile.longitude;
      _timezone = profile.timezone;

      _cityController.text = [
        _city,
        _state,
        _country,
      ].where((item) => item.trim().isNotEmpty).join(', ');

      if (profile.gender.trim().isNotEmpty) {
        _gender = profile.gender.toUpperCase();
      }

      if (profile.language?.trim().isNotEmpty == true) {
        _language = profile.language!.trim().toLowerCase();
      }
    }
  }

  @override
  void dispose() {
    _cityDebounce?.cancel();
    _nameController.dispose();
    _cityController.dispose();

    _profileApi.close();
    _geoApi.close();

    super.dispose();
  }

  String get _birthTimeString {
    final value = _birthTime;

    if (value == null) {
      return '';
    }

    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');

    return '$hour:$minute';
  }

  String get _birthDateString {
    final value = _birthDate;

    if (value == null) {
      return '';
    }

    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  String get _prettyBirthDate {
    final value = _birthDate;

    if (value == null) {
      return 'Select your birth date';
    }

    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');

    return '$day/$month/${value.year}';
  }

  String _languageLabel(String code) {
    return switch (code) {
      'en' => 'English',
      'hi' => 'Hindi',
      'bn' => 'Bengali',
      'ta' => 'Tamil',
      'te' => 'Telugu',
      'mr' => 'Marathi',
      'gu' => 'Gujarati',
      'kn' => 'Kannada',
      'ml' => 'Malayalam',
      'pa' => 'Punjabi',
      _ => code.toUpperCase(),
    };
  }

  Future<void> _selectBirthDate() async {
    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1900, 1, 1),
      lastDate: now,
    );

    if (selected != null && mounted) {
      setState(() {
        _birthDate = selected;
      });
    }
  }

  Future<void> _selectBirthTime() async {
    final selected = await showTimePicker(
      context: context,
      initialTime: _birthTime ?? const TimeOfDay(hour: 12, minute: 0),
    );

    if (selected != null && mounted) {
      setState(() {
        _birthTime = selected;
      });
    }
  }

  void _onCityChanged(String value) {
    _cityDebounce?.cancel();

    final query = value.trim();

    if (query.length < 2) {
      setState(() {
        _suggestions = [];
        _searchingCity = false;
      });

      return;
    }

    _cityDebounce = Timer(
      const Duration(milliseconds: 450),
      () => _searchCity(query),
    );
  }

  Future<void> _searchCity(String query) async {
    if (!mounted) {
      return;
    }

    setState(() {
      _searchingCity = true;
    });

    try {
      final results = await _geoApi.searchCity(query);

      if (!mounted) {
        return;
      }

      if (_cityController.text.trim() != query) {
        return;
      }

      setState(() {
        _suggestions = results;
      });
    } on GeoApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _suggestions = [];
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _searchingCity = false;
        });
      }
    }
  }

  void _selectPlace(GeoSuggestion place) {
    _cityDebounce?.cancel();

    setState(() {
      _city = place.city;
      _state = place.state;
      _country = place.country;
      _countryCode = place.countryCode;

      _latitude = place.latitude;
      _longitude = place.longitude;
      _timezone = place.timezone;
      _timezoneName = place.timezoneName;

      _cityController.text = [
        place.city,
        place.state,
        place.country,
      ].where((item) => item.trim().isNotEmpty).join(', ');

      _suggestions = [];
      _searchingCity = false;
    });

    FocusScope.of(context).unfocus();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  bool _validateStep() {
    switch (_step) {
      case 0:
        if (_nameController.text.trim().length < 2) {
          _showMessage('Please enter your full name.');
          return false;
        }

        return true;

      case 1:
        if (_birthDate == null) {
          _showMessage('Please select your date of birth.');
          return false;
        }

        return true;

      case 2:
        return true;

      case 3:
        if (_birthTimeKnown && _birthTime == null) {
          _showMessage('Please select your birth time.');
          return false;
        }

        return true;

      case 4:
        if (_city.trim().isEmpty ||
            _countryCode.trim().isEmpty ||
            _timezoneName.trim().isEmpty ||
            _latitude < -90 ||
            _latitude > 90 ||
            _longitude < -180 ||
            _longitude > 180) {
          _showMessage('Please select your birth place from the suggestions.');

          return false;
        }

        return true;

      case 5:
        return true;

      default:
        return true;
    }
  }

  Future<void> _next() async {
    FocusScope.of(context).unfocus();

    if (!_validateStep()) {
      return;
    }

    if (_step < 5) {
      setState(() {
        _step += 1;
      });

      return;
    }

    await _save();
  }

  void _back() {
    if (_step == 0) {
      return;
    }

    setState(() {
      _step -= 1;
    });
  }

  Future<void> _save() async {
    if (_saving) {
      return;
    }

    if (_birthDate == null) {
      _showMessage('Date of birth is required.');
      return;
    }

    /*
     * Backend currently treats timeOfBirth as part of complete astrology
     * profile. If user does not know the exact time, 12:00 is persisted as
     * the neutral/unknown-time fallback for this phase.
     *
     * Phase 75% will make the "birth time unknown" state explicit in DB
     * without breaking existing Kundli consumers.
     */
    final String? birthTime = _birthTimeKnown ? _birthTimeString : null;

    if (_birthTimeKnown && (birthTime == null || birthTime.isEmpty)) {
      _showMessage('Birth time is required.');
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final name = _nameController.text.trim();
      final existing = widget.existingProfile;

      if (existing == null) {
        await _profileApi.createProfile(
          name: name,
          fullName: name,
          dob: _birthDateString,
          tob: birthTime,
          birthTimeKnown: _birthTimeKnown,
          city: _city,
          state: _state,
          country: _country,
          countryCode: _countryCode,
          gender: _gender,
          language: _language,
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      } else {
        await _profileApi.updateProfile(
          profileId: existing.id,
          name: name,
          fullName: name,
          dob: _birthDateString,
          tob: birthTime,
          birthTimeKnown: _birthTimeKnown,
          city: _city,
          state: _state,
          country: _country,
          countryCode: _countryCode,
          gender: _gender,
          language: _language,
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      _showMessage(error.message);
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  Widget _progress() {
    return Row(
      children: List.generate(6, (index) {
        final active = index <= _step;

        return Expanded(
          child: Container(
            height: 5,
            margin: EdgeInsets.only(right: index == 5 ? 0 : 7),
            decoration: BoxDecoration(
              color: active
                  ? AppColors.gold
                  : AppColors.muted.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
      }),
    );
  }

  Widget _optionTile({
    required String title,
    required bool selected,
    required VoidCallback onTap,
    IconData? icon,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.gold.withValues(alpha: 0.15)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected
                ? AppColors.gold
                : AppColors.muted.withValues(alpha: 0.18),
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, color: selected ? AppColors.gold : AppColors.muted),
              const SizedBox(width: 13),
            ],
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: selected ? AppColors.gold : AppColors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded, color: AppColors.gold),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_step) {
      case 0:
        return Column(
          key: const ValueKey('name'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('ABOUT YOU'),
            const SizedBox(height: 12),
            const Text('Hey there!\nWhat is your name?', style: _titleStyle),
            const SizedBox(height: 24),
            TextField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.done,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
              decoration: _fieldDecoration(
                hint: 'Enter your full name',
                icon: Icons.person_outline_rounded,
              ),
            ),
          ],
        );

      case 1:
        return Column(
          key: const ValueKey('dob'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('BIRTH DETAILS'),
            const SizedBox(height: 12),
            const Text('When were you born?', style: _titleStyle),
            const SizedBox(height: 10),
            const Text(
              'Your birth date helps us personalize your astrology experience.',
              style: _subtitleStyle,
            ),
            const SizedBox(height: 24),
            InkWell(
              onTap: _selectBirthDate,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: _fieldBoxDecoration,
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_month_rounded,
                      color: AppColors.gold,
                    ),
                    const SizedBox(width: 14),
                    Text(
                      _prettyBirthDate,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );

      case 2:
        return Column(
          key: const ValueKey('know_time'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('BIRTH TIME'),
            const SizedBox(height: 12),
            const Text(
              'Do you know your exact birth time?',
              style: _titleStyle,
            ),
            const SizedBox(height: 26),
            _optionTile(
              title: 'Yes, I know it',
              selected: _birthTimeKnown,
              icon: Icons.verified_outlined,
              onTap: () {
                setState(() {
                  _birthTimeKnown = true;
                });
              },
            ),
            const SizedBox(height: 13),
            _optionTile(
              title: 'No, I am not sure',
              selected: !_birthTimeKnown,
              icon: Icons.help_outline_rounded,
              onTap: () {
                setState(() {
                  _birthTimeKnown = false;
                });
              },
            ),
          ],
        );

      case 3:
        return Column(
          key: const ValueKey('time'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('BIRTH TIME'),
            const SizedBox(height: 12),
            Text(
              _birthTimeKnown ? 'What time were you born?' : 'No problem.',
              style: _titleStyle,
            ),
            const SizedBox(height: 10),
            Text(
              _birthTimeKnown
                  ? 'Choose the closest exact time available.'
                  : 'We will use a neutral birth-time setting for now. You can update it later from My Profile.',
              style: _subtitleStyle,
            ),
            if (_birthTimeKnown) ...[
              const SizedBox(height: 24),
              InkWell(
                onTap: _selectBirthTime,
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: _fieldBoxDecoration,
                  child: Row(
                    children: [
                      const Icon(Icons.schedule_rounded, color: AppColors.gold),
                      const SizedBox(width: 14),
                      Text(
                        _birthTime == null
                            ? 'Select birth time'
                            : _birthTimeString,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        );

      case 4:
        return Column(
          key: const ValueKey('place'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('BIRTH PLACE'),
            const SizedBox(height: 12),
            const Text('Where were you born?', style: _titleStyle),
            const SizedBox(height: 10),
            const Text(
              'Select the correct city so coordinates and timezone are saved automatically.',
              style: _subtitleStyle,
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _cityController,
              onChanged: _onCityChanged,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
              decoration: _fieldDecoration(
                hint: 'Search city',
                icon: Icons.location_on_outlined,
                suffix: _searchingCity
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.gold,
                          ),
                        ),
                      )
                    : const Icon(Icons.search_rounded, color: AppColors.muted),
              ),
            ),
            if (_suggestions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                constraints: const BoxConstraints(maxHeight: 240),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.18),
                  ),
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _suggestions.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: AppColors.muted.withValues(alpha: 0.12),
                  ),
                  itemBuilder: (_, index) {
                    final place = _suggestions[index];

                    return ListTile(
                      onTap: () => _selectPlace(place),
                      leading: const Icon(
                        Icons.location_city_rounded,
                        color: AppColors.gold,
                      ),
                      title: Text(
                        [
                          place.city,
                          place.state,
                          place.country,
                        ].where((item) => item.trim().isNotEmpty).join(', '),
                        style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        );

      case 5:
        return Column(
          key: const ValueKey('personalize'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StepLabel('PERSONALIZE'),
            const SizedBox(height: 12),
            const Text('Make your Astro Soul Path yours.', style: _titleStyle),
            const SizedBox(height: 10),
            const Text(
              'Choose your gender and preferred guidance language.',
              style: _subtitleStyle,
            ),
            const SizedBox(height: 24),
            const Text(
              'Gender',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 10),
            _optionTile(
              title: 'Male',
              selected: _gender == 'MALE',
              onTap: () {
                setState(() {
                  _gender = 'MALE';
                });
              },
            ),
            const SizedBox(height: 10),
            _optionTile(
              title: 'Female',
              selected: _gender == 'FEMALE',
              onTap: () {
                setState(() {
                  _gender = 'FEMALE';
                });
              },
            ),
            const SizedBox(height: 24),
            const Text(
              'Language',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 9,
              runSpacing: 9,
              children: _languages.map((code) {
                final selected = code == _language;

                return ChoiceChip(
                  selected: selected,
                  onSelected: (_) {
                    setState(() {
                      _language = code;
                    });
                  },
                  selectedColor: AppColors.gold,
                  backgroundColor: AppColors.surface,
                  side: BorderSide(
                    color: selected
                        ? AppColors.gold
                        : AppColors.muted.withValues(alpha: 0.18),
                  ),
                  label: Text(
                    _languageLabel(code),
                    style: TextStyle(
                      color: selected ? AppColors.background : AppColors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        );

      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned(
                top: -90,
                right: -80,
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.gold.withValues(alpha: 0.055),
                  ),
                ),
              ),
              Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                    child: Row(
                      children: [
                        if (_step > 0)
                          IconButton(
                            onPressed: _saving ? null : _back,
                            icon: const Icon(
                              Icons.arrow_back_rounded,
                              color: AppColors.gold,
                            ),
                          )
                        else
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.gold),
                            ),
                            child: const Icon(
                              Icons.auto_awesome_rounded,
                              color: AppColors.gold,
                              size: 20,
                            ),
                          ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Astro Soul Path',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Text(
                          '${_step + 1}/6',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
                    child: _progress(),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        24,
                        34,
                        24,
                        30 + bottomInset,
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        transitionBuilder: (child, animation) {
                          final offset = Tween<Offset>(
                            begin: const Offset(0.08, 0),
                            end: Offset.zero,
                          ).animate(animation);

                          return FadeTransition(
                            opacity: animation,
                            child: SlideTransition(
                              position: offset,
                              child: child,
                            ),
                          );
                        },
                        child: _buildCurrentStep(),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 58,
                      child: FilledButton(
                        onPressed: _saving ? null : _next,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.gold,
                          foregroundColor: AppColors.background,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: AppColors.background,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    _step == 5
                                        ? 'Build My Astro Profile'
                                        : 'Continue',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 20,
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

const TextStyle _titleStyle = TextStyle(
  color: AppColors.white,
  fontSize: 31,
  height: 1.12,
  fontWeight: FontWeight.w900,
);

const TextStyle _subtitleStyle = TextStyle(
  color: AppColors.muted,
  fontSize: 14,
  height: 1.55,
);

final BoxDecoration _fieldBoxDecoration = BoxDecoration(
  color: AppColors.surface,
  borderRadius: BorderRadius.circular(18),
  border: Border.all(color: AppColors.gold.withValues(alpha: 0.20)),
);

InputDecoration _fieldDecoration({
  required String hint,
  required IconData icon,
  Widget? suffix,
}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: AppColors.muted),
    prefixIcon: Icon(icon, color: AppColors.gold),
    suffixIcon: suffix,
    filled: true,
    fillColor: AppColors.surface,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: BorderSide(color: AppColors.muted.withValues(alpha: 0.16)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: BorderSide(color: AppColors.muted.withValues(alpha: 0.16)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
  );
}

class _StepLabel extends StatelessWidget {
  const _StepLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.gold,
        fontSize: 12,
        fontWeight: FontWeight.w900,
        letterSpacing: 1.5,
      ),
    );
  }
}
