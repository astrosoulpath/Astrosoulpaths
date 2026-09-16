import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../profile/data/geo_api.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import '../../data/kundli_api.dart';

class AstrologerGenerateKundliScreen extends StatefulWidget {
  const AstrologerGenerateKundliScreen({super.key});

  @override
  State<AstrologerGenerateKundliScreen> createState() =>
      _AstrologerGenerateKundliScreenState();
}

class _AstrologerGenerateKundliScreenState
    extends State<AstrologerGenerateKundliScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  final KundliApi _kundliApi = KundliApi();
  final GeoApi _geoApi = GeoApi();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _tobController = TextEditingController();
  final TextEditingController _placeController = TextEditingController();

  Timer? _placeDebounce;

  String _gender = 'OTHER';
  String _language = 'en';

  bool _isSearchingPlace = false;
  bool _locationResolved = false;
  bool _isGenerating = false;

  double _latitude = 0;
  double _longitude = 0;
  double _timezone = 0;

  String _timezoneName = '';
  String _city = '';
  String _state = '';
  String _country = '';

  List<GeoSuggestion> _geoSuggestions = [];

  KundliGenerationResult? _result;

  @override
  void dispose() {
    _placeDebounce?.cancel();

    _nameController.dispose();
    _dobController.dispose();
    _tobController.dispose();
    _placeController.dispose();

    _geoApi.close();
    _kundliApi.close();

    super.dispose();
  }

  String _formatDate(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  Future<void> _pickDate() async {
    final parsed = DateTime.tryParse(_dobController.text.trim());
    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      initialDate: parsed ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
    );

    if (selected == null || !mounted) {
      return;
    }

    setState(() {
      _dobController.text = _formatDate(selected);
      _result = null;
    });
  }

  Future<void> _pickTime() async {
    final parts = _tobController.text.trim().split(':');

    final initial = TimeOfDay(
      hour: int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 12,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0,
    );

    final selected = await showTimePicker(
      context: context,
      initialTime: initial,
    );

    if (selected == null || !mounted) {
      return;
    }

    final hour = selected.hour.toString().padLeft(2, '0');
    final minute = selected.minute.toString().padLeft(2, '0');

    setState(() {
      _tobController.text = '$hour:$minute';
      _result = null;
    });
  }

  void _onPlaceChanged(String value) {
    _placeDebounce?.cancel();

    final query = value.trim();

    setState(() {
      // Never reuse coordinates belonging to an older text value.
      _locationResolved = false;
      _geoSuggestions = [];
      _timezoneName = '';
      _result = null;
    });

    if (query.length < 2) {
      return;
    }

    _placeDebounce = Timer(
      const Duration(milliseconds: 450),
      () => _searchPlace(query),
    );
  }

  Future<void> _searchPlace(String query) async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isSearchingPlace = true;
    });

    try {
      final suggestions = await _geoApi.searchCity(query);

      if (!mounted) {
        return;
      }

      if (_placeController.text.trim() != query) {
        return;
      }

      setState(() {
        _geoSuggestions = suggestions;
      });
    } on GeoApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _geoSuggestions = [];
      });

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isSearchingPlace = false;
        });
      }
    }
  }

  void _selectPlace(GeoSuggestion suggestion) {
    _placeDebounce?.cancel();

    final displayName = suggestion.fullName.trim().isNotEmpty
        ? suggestion.fullName.trim()
        : [
            suggestion.city.trim(),
            suggestion.state.trim(),
            suggestion.country.trim(),
          ].where((value) => value.isNotEmpty).join(', ');

    setState(() {
      _city = suggestion.city.trim();
      _state = suggestion.state.trim();
      _country = suggestion.country.trim();

      _latitude = suggestion.latitude;
      _longitude = suggestion.longitude;
      _timezone = suggestion.timezone;
      _timezoneName = suggestion.timezoneName.trim();

      _placeController.text = displayName;

      _locationResolved =
          displayName.isNotEmpty &&
          _timezoneName.isNotEmpty &&
          _latitude >= -90 &&
          _latitude <= 90 &&
          _longitude >= -180 &&
          _longitude <= 180 &&
          _timezone >= -12 &&
          _timezone <= 14;

      _geoSuggestions = [];
      _isSearchingPlace = false;
      _result = null;
    });

    FocusScope.of(context).unfocus();
  }

  Future<void> _generate() async {
    FocusScope.of(context).unfocus();

    if (_isGenerating) {
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (!_locationResolved) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Select the birth place from the verified location suggestions.',
            ),
          ),
        );

      return;
    }

    setState(() {
      _isGenerating = true;
      _result = null;
    });

    try {
      final result = await _kundliApi.generateProfessionalKundli(
        name: _nameController.text,
        gender: _gender,
        birthPlace: _placeController.text,
        dob: _dobController.text,
        tob: _tobController.text,
        latitude: _latitude,
        longitude: _longitude,
        timezone: _timezone,
        language: _language,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _result = result;
      });

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Professional Kundli generated and saved successfully.',
            ),
          ),
        );
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      if (error.subscriptionRequired) {
        final openPlan = await showDialog<bool>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Professional Kundli Plan Required'),
              content: Text(error.message),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Not Now'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: const Text('View Plan'),
                ),
              ],
            );
          },
        );

        if (openPlan == true && mounted) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const SubscriptionPlansScreen(
                audience: SubscriptionAudience.astrologer,
              ),
            ),
          );
        }

        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isGenerating = false;
        });
      }
    }
  }

  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: AppColors.gold.withValues(alpha: 0.22)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Generate Client Kundli',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.25),
                  ),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.verified_outlined, color: AppColors.gold),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Enter the client birth details exactly as provided. '
                        'Birth-place coordinates and timezone are resolved from '
                        'the live backend location service.',
                        style: TextStyle(color: AppColors.muted, height: 1.45),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                maxLength: 100,
                decoration: _inputDecoration(
                  label: 'Client Name',
                  icon: Icons.person_outline,
                  hint: 'Enter full name',
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Client name is required';
                  }

                  return null;
                },
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                initialValue: _gender,
                decoration: _inputDecoration(
                  label: 'Gender',
                  icon: Icons.person_search_outlined,
                ),
                items: const [
                  DropdownMenuItem(value: 'MALE', child: Text('Male')),
                  DropdownMenuItem(value: 'FEMALE', child: Text('Female')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                ],
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }

                  setState(() {
                    _gender = value;
                    _result = null;
                  });
                },
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _dobController,
                readOnly: true,
                onTap: _pickDate,
                decoration:
                    _inputDecoration(
                      label: 'Date of Birth',
                      icon: Icons.calendar_month_outlined,
                      hint: 'YYYY-MM-DD',
                    ).copyWith(
                      suffixIcon: IconButton(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.calendar_today_outlined),
                      ),
                    ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Date of birth is required';
                  }

                  return null;
                },
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _tobController,
                readOnly: true,
                onTap: _pickTime,
                decoration:
                    _inputDecoration(
                      label: 'Time of Birth',
                      icon: Icons.schedule_outlined,
                      hint: 'HH:mm',
                    ).copyWith(
                      suffixIcon: IconButton(
                        onPressed: _pickTime,
                        icon: const Icon(Icons.access_time),
                      ),
                    ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Time of birth is required';
                  }

                  return null;
                },
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _placeController,
                textCapitalization: TextCapitalization.words,
                onChanged: _onPlaceChanged,
                decoration:
                    _inputDecoration(
                      label: 'Birth Place',
                      icon: Icons.location_on_outlined,
                      hint: 'Search city',
                    ).copyWith(
                      suffixIcon: _isSearchingPlace
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            )
                          : _locationResolved
                          ? const Icon(Icons.verified, color: AppColors.gold)
                          : null,
                    ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Birth place is required';
                  }

                  return null;
                },
              ),

              if (_geoSuggestions.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.20),
                    ),
                  ),
                  child: Column(
                    children: _geoSuggestions.take(8).map((suggestion) {
                      final subtitle = [
                        suggestion.state.trim(),
                        suggestion.country.trim(),
                      ].where((value) => value.isNotEmpty).join(', ');

                      return ListTile(
                        leading: const Icon(
                          Icons.location_city_outlined,
                          color: AppColors.gold,
                        ),
                        title: Text(
                          suggestion.city,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: Text(
                          subtitle,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                        onTap: () => _selectPlace(suggestion),
                      );
                    }).toList(),
                  ),
                ),
              ],

              if (_locationResolved) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Text(
                    [
                      if (_city.isNotEmpty) _city,
                      if (_state.isNotEmpty) _state,
                      if (_country.isNotEmpty) _country,
                      '${_latitude.toStringAsFixed(4)}, ${_longitude.toStringAsFixed(4)}',
                      '$_timezoneName (UTC ${_timezone >= 0 ? '+' : ''}$_timezone)',
                    ].join('\n'),
                    style: const TextStyle(
                      color: AppColors.muted,
                      height: 1.45,
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                initialValue: _language,
                decoration: _inputDecoration(
                  label: 'Report Language',
                  icon: Icons.translate_outlined,
                ),
                items: const [
                  DropdownMenuItem(value: 'en', child: Text('English')),
                  DropdownMenuItem(value: 'hi', child: Text('Hindi')),
                ],
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }

                  setState(() {
                    _language = value;
                    _result = null;
                  });
                },
              ),
              const SizedBox(height: 22),

              SizedBox(
                height: 52,
                child: FilledButton.icon(
                  onPressed: _isGenerating ? null : _generate,
                  icon: _isGenerating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.auto_awesome),
                  label: Text(
                    _isGenerating
                        ? 'Generating Professional Kundli...'
                        : 'Generate & Save Kundli',
                  ),
                ),
              ),

              if (result != null) ...[
                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.all(17),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.30),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(
                            Icons.check_circle_outline,
                            color: AppColors.gold,
                          ),
                          SizedBox(width: 9),
                          Text(
                            'Kundli Generated & Saved',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _ResultRow(
                        label: 'Client',
                        value: _nameController.text.trim(),
                      ),
                      _ResultRow(label: 'Status', value: result.report.status),
                      _ResultRow(
                        label: 'Provider',
                        value: result.report.provider.isEmpty
                            ? 'Vedic backend'
                            : result.report.provider,
                      ),
                      _ResultRow(
                        label: 'Core Completeness',
                        value: '${result.report.coreCompletenessPercent}%',
                      ),
                      _ResultRow(
                        label: 'Advanced Vargas',
                        value: result.report.advancedVargaCoverageLabel,
                      ),
                      if (result.report.missingAdvancedVargas.isNotEmpty)
                        _ResultRow(
                          label: 'Advanced Pending',
                          value: result.report.missingAdvancedVargas.join(', '),
                        ),
                      _ResultRow(
                        label: 'Saved Record',
                        value: result.savedRecordId,
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
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
}
