import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../profile/data/geo_api.dart';
import '../../../profile/data/profile_api.dart';
import '../../data/kundli_api.dart';
import 'kundli_pdf_preview_screen.dart';
import 'customer_astrologer_kundli_reports_screen.dart';

class CustomerKundliScreen extends StatefulWidget {
  const CustomerKundliScreen({super.key});

  @override
  State<CustomerKundliScreen> createState() => _CustomerKundliScreenState();
}

class _CustomerKundliScreenState extends State<CustomerKundliScreen> {
  final ProfileApi _profileApi = ProfileApi();
  final KundliApi _kundliApi = KundliApi();
  final GeoApi _geoApi = GeoApi();

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _tobController = TextEditingController();
  final TextEditingController _placeController = TextEditingController();

  Timer? _placeDebounce;

  bool _isLoading = true;
  bool _isGenerating = false;
  bool _isDownloadingPdf = false;
  bool _isSearchingPlace = false;
  bool _locationResolved = false;

  String _error = '';
  String _gender = 'OTHER';

  String _city = '';
  String _state = '';
  String _country = '';
  String _countryCode = '';
  String _timezoneName = '';

  double _latitude = 0;
  double _longitude = 0;
  double _timezone = 0;

  List<GeoSuggestion> _geoSuggestions = [];

  CustomerProfile? _profile;
  KundliReport? _report;

  @override
  void initState() {
    super.initState();

    // Important:
    // Opening Kundli AI must NOT immediately calculate Kundli.
    // First show verified birth details like AstroSage-style flow.
    _loadProfileForForm();
  }

  @override
  void dispose() {
    _placeDebounce?.cancel();

    _nameController.dispose();
    _dobController.dispose();
    _tobController.dispose();
    _placeController.dispose();

    _profileApi.close();
    _kundliApi.close();
    _geoApi.close();

    super.dispose();
  }

  String _formatDate(DateTime date) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  Future<void> _loadProfileForForm() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = '';
      });
    }

    try {
      final profiles = await _profileApi.getProfiles();

      final activeProfiles = profiles
          .where((profile) => !profile.isDeleted)
          .toList(growable: false);

      final profile = activeProfiles.isEmpty ? null : activeProfiles.first;

      if (profile != null) {
        _populateFromProfile(profile);
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _profile = profile;
        _report = null;
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
        _error = 'Unable to load your birth profile right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _populateFromProfile(CustomerProfile profile) {
    _nameController.text = (profile.fullName?.trim().isNotEmpty ?? false)
        ? profile.fullName!.trim()
        : profile.name.trim();

    final birthDate = profile.birthDate;

    if (birthDate.year > 1900) {
      _dobController.text = _formatDate(birthDate);
    }

    _tobController.text = profile.birthTime.trim();

    final normalizedGender = profile.gender.trim().toUpperCase();

    _gender = const {'MALE', 'FEMALE', 'OTHER'}.contains(normalizedGender)
        ? normalizedGender
        : 'OTHER';

    _city = profile.city?.trim() ?? '';
    _state = profile.state?.trim() ?? '';
    _country = profile.country?.trim() ?? '';
    _countryCode = profile.countryCode?.trim().toUpperCase() ?? '';

    _latitude = profile.latitude;
    _longitude = profile.longitude;
    _timezone = profile.timezone;
    _timezoneName = profile.timezoneName?.trim() ?? '';

    _placeController.text = [
      _city,
      _state,
      _country,
    ].where((value) => value.isNotEmpty).join(', ');

    final coordinateValid =
        _latitude >= -90 &&
        _latitude <= 90 &&
        _longitude >= -180 &&
        _longitude <= 180;

    _locationResolved =
        _city.isNotEmpty &&
        coordinateValid &&
        _placeController.text.trim().isNotEmpty;
  }

  Future<void> _pickDate() async {
    final parsed = DateTime.tryParse(_dobController.text.trim());

    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      initialDate: parsed ?? now,
      firstDate: DateTime(1900),
      lastDate: now,
    );

    if (selected == null || !mounted) {
      return;
    }

    setState(() {
      _dobController.text = _formatDate(selected);
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
    });
  }

  void _onPlaceChanged(String value) {
    _placeDebounce?.cancel();

    final query = value.trim();

    // Once user manually changes location text,
    // old coordinates must never silently be reused.
    setState(() {
      _locationResolved = false;
      _geoSuggestions = [];
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

  void _selectGeoSuggestion(GeoSuggestion suggestion) {
    _placeDebounce?.cancel();

    setState(() {
      _city = suggestion.city.trim();
      _state = suggestion.state.trim();
      _country = suggestion.country.trim();
      _countryCode = suggestion.countryCode.trim().toUpperCase();

      _latitude = suggestion.latitude;
      _longitude = suggestion.longitude;
      _timezone = suggestion.timezone;
      _timezoneName = suggestion.timezoneName.trim();

      _placeController.text = suggestion.fullName.trim().isNotEmpty
          ? suggestion.fullName.trim()
          : [
              _city,
              _state,
              _country,
            ].where((value) => value.isNotEmpty).join(', ');

      _locationResolved = true;
      _geoSuggestions = [];
      _isSearchingPlace = false;
    });

    FocusScope.of(context).unfocus();
  }

  bool _birthLocationIsValid() {
    return _locationResolved &&
        _city.isNotEmpty &&
        _country.isNotEmpty &&
        _countryCode.isNotEmpty &&
        _timezoneName.isNotEmpty &&
        _latitude >= -90 &&
        _latitude <= 90 &&
        _longitude >= -180 &&
        _longitude <= 180;
  }

  Future<void> _saveAndShowKundli() async {
    if (_isGenerating) {
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (!_birthLocationIsValid()) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Please select your birth place from the verified suggestions.',
            ),
          ),
        );

      return;
    }

    setState(() {
      _isGenerating = true;
      _error = '';
    });

    try {
      final fullName = _nameController.text.trim();
      final dob = _dobController.text.trim();
      final tob = _tobController.text.trim();

      CustomerProfile savedProfile;

      final existing = _profile;

      if (existing == null) {
        savedProfile = await _profileApi.createProfile(
          name: fullName,
          fullName: fullName,
          dob: dob,
          tob: tob,
          birthTimeKnown: true,
          gender: _gender,
          city: _city,
          state: _state,
          country: _country,
          countryCode: _countryCode,
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      } else {
        savedProfile = await _profileApi.updateProfile(
          profileId: existing.id,
          name: fullName,
          fullName: fullName,
          dob: dob,
          tob: tob,
          birthTimeKnown: true,
          gender: _gender,
          city: _city,
          state: _state,
          country: _country,
          countryCode: _countryCode,
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _profile = savedProfile;
      });

      await _loadKundli();

      if (!mounted) {
        return;
      }

      if (_report == null) {
        setState(() {
          _error = _error.trim().isNotEmpty
              ? _error
              : 'Kundli was generated, but the report could not be loaded. Please try again.';
        });
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Your Vedic Kundli is ready.')),
        );
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Unable to generate Kundli right now.')),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isGenerating = false;
        });
      }
    }
  }

  Future<void> _loadKundli() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = '';
      });
    }

    try {
      final report = await _kundliApi.generateMyKundli();

      if (!mounted) {
        return;
      }

      setState(() {
        _report = report;
      });
    } on KundliApiException catch (error) {
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
        _error = 'Unable to load your Kundli right now. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _downloadAndOpenPdf() async {
    final profile = _profile;

    if (profile == null || _isDownloadingPdf) {
      return;
    }

    setState(() {
      _isDownloadingPdf = true;
    });

    try {
      // Real authenticated backend PDF bytes.
      final bytes = await _kundliApi.downloadMyKundliPdf();

      if (bytes.isEmpty) {
        throw const KundliApiException('The generated Kundli PDF is empty.');
      }

      final rawName = (profile.fullName?.trim().isNotEmpty ?? false)
          ? profile.fullName!.trim()
          : profile.name.trim();

      final safeName = rawName
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '_')
          .replaceAll(RegExp(r'_+'), '_')
          .replaceAll(RegExp(r'^_+|_+$'), '');

      final now = DateTime.now();

      final datePart =
          '${now.year}'
          '${now.month.toString().padLeft(2, '0')}'
          '${now.day.toString().padLeft(2, '0')}';

      final fileName =
          'AstroSoulPath_Kundli_'
          '${safeName.isEmpty ? "Report" : safeName}_'
          '$datePart.pdf';

      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              KundliPdfPreviewScreen(bytes: bytes, fileName: fileName),
        ),
      );
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Unable to open the Kundli PDF. Please try again.'),
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isDownloadingPdf = false;
        });
      }
    }
  }

  void _backToKundliForm() {
    setState(() {
      _report = null;
      _error = '';
    });
  }

  InputDecoration _kundliFieldDecoration({
    required String label,
    required IconData icon,
    String? hint,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      labelStyle: const TextStyle(color: AppColors.muted),
      hintStyle: const TextStyle(color: AppColors.muted),
      prefixIcon: Icon(icon, color: AppColors.gold),
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x33F4C45E)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x33F4C45E)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
      ),
    );
  }

  Widget _buildKundliEntryForm() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 36),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.background, AppColors.surfaceLight],
              ),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x55F4C45E)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.gold,
                  size: 34,
                ),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kundli AI',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 23,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Enter accurate birth details to generate your Vedic Kundli and AI-guided interpretation.',
                        style: TextStyle(
                          color: AppColors.muted,
                          height: 1.45,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          TextFormField(
            controller: _nameController,
            textCapitalization: TextCapitalization.words,
            decoration: _kundliFieldDecoration(
              label: 'Name',
              icon: Icons.person_outline_rounded,
              hint: 'Enter your full name',
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Name is required';
              }

              return null;
            },
          ),

          const SizedBox(height: 14),

          DropdownButtonFormField<String>(
            initialValue: _gender,
            dropdownColor: AppColors.surface,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w700,
            ),
            decoration: _kundliFieldDecoration(
              label: 'Gender',
              icon: Icons.wc_rounded,
            ),
            items: const [
              DropdownMenuItem(value: 'MALE', child: Text('Male')),
              DropdownMenuItem(value: 'FEMALE', child: Text('Female')),
              DropdownMenuItem(value: 'OTHER', child: Text('Other')),
            ],
            onChanged: _isGenerating
                ? null
                : (value) {
                    if (value == null) {
                      return;
                    }

                    setState(() {
                      _gender = value;
                    });
                  },
          ),

          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _dobController,
                  readOnly: true,
                  onTap: _isGenerating ? null : _pickDate,
                  decoration: _kundliFieldDecoration(
                    label: 'Date of Birth',
                    icon: Icons.calendar_today_outlined,
                    hint: 'YYYY-MM-DD',
                  ),
                  validator: (value) {
                    if (value == null ||
                        DateTime.tryParse(value.trim()) == null) {
                      return 'DOB required';
                    }

                    return null;
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _tobController,
                  readOnly: true,
                  onTap: _isGenerating ? null : _pickTime,
                  decoration: _kundliFieldDecoration(
                    label: 'Time of Birth',
                    icon: Icons.schedule_outlined,
                    hint: 'HH:mm',
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'TOB required';
                    }

                    return null;
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          TextFormField(
            controller: _placeController,
            enabled: !_isGenerating,
            onChanged: _onPlaceChanged,
            decoration: _kundliFieldDecoration(
              label: 'Place of Birth',
              icon: Icons.location_on_outlined,
              hint: 'Type your birth city',
              suffixIcon: _isSearchingPlace
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
                  : _locationResolved
                  ? const Icon(Icons.verified_rounded, color: AppColors.gold)
                  : const Icon(Icons.search_rounded, color: AppColors.muted),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Birth place is required';
              }

              return null;
            },
          ),

          if (_geoSuggestions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.18),
                ),
              ),
              child: Column(
                children: _geoSuggestions.map((suggestion) {
                  return InkWell(
                    onTap: () => _selectGeoSuggestion(suggestion),
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.location_on_rounded,
                            color: AppColors.gold,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  suggestion.fullName,
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${suggestion.countryCode}  |  '
                                  '${suggestion.timezoneName}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.muted,
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],

          if (_locationResolved) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.15),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.verified_user_outlined,
                    color: AppColors.gold,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Verified location  |  '
                      '$_timezoneName  |  '
                      '${_latitude.toStringAsFixed(4)}, '
                      '${_longitude.toStringAsFixed(4)}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11.5,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 14),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.15)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lock_outline_rounded, color: AppColors.gold),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Verified birth details are saved to your profile before calculation so your Vedic Kundli, AI interpretation and PDF always use the same accurate data.',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 11.5,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          SizedBox(
            height: 54,
            child: FilledButton(
              onPressed: _isGenerating ? null : _saveAndShowKundli,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _isGenerating
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: AppColors.background,
                      ),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.auto_awesome_rounded),
                        SizedBox(width: 9),
                        Text(
                          'SHOW KUNDLI',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ],
                    ),
            ),
          ),

          const SizedBox(height: 12),

          const Text(
            'Planetary calculations are generated by the configured Vedic astrology provider. AI is used for grounded interpretation, not for inventing planetary positions.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.muted,
              height: 1.45,
              fontSize: 10.8,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final showingReport = _report != null;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: Text(
          showingReport ? 'My Kundli' : 'Kundli AI',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            tooltip: 'Astrologer Reports',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const CustomerAstrologerKundliReportsScreen(),
                ),
              );
            },
            icon: const Icon(
              Icons.assignment_turned_in_outlined,
              color: AppColors.gold,
            ),
          ),
          if (showingReport)
            IconButton(
              onPressed: _isLoading ? null : _backToKundliForm,
              tooltip: 'Edit birth details',
              icon: const Icon(Icons.edit_outlined, color: AppColors.gold),
            ),

          if (showingReport)
            if (_isDownloadingPdf)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: AppColors.gold,
                    ),
                  ),
                ),
              )
            else
              IconButton(
                onPressed: _profile == null ? null : _downloadAndOpenPdf,
                tooltip: 'Download Kundli PDF',
                icon: const Icon(
                  Icons.picture_as_pdf_rounded,
                  color: AppColors.gold,
                ),
              ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty && !showingReport
          ? _KundliErrorState(
              message: _error,
              onRetry: _profile == null ? _loadProfileForForm : _loadKundli,
            )
          : showingReport
          ? _buildReport()
          : _buildKundliEntryForm(),
    );
  }

  bool _isOuterPlanetName(dynamic rawName) {
    final name = rawName?.toString().trim().toLowerCase() ?? '';

    return name == 'uranus' ||
        name == 'ur' ||
        name == 'neptune' ||
        name == 'ne' ||
        name == 'pluto' ||
        name == 'pl';
  }

  bool _shouldHidePlanet(Map<String, dynamic> planet) {
    if (!(_report?.hideOuterPlanets ?? false)) {
      return false;
    }

    final name =
        planet['full_name'] ??
        planet['planet_name'] ??
        planet['name'] ??
        planet['planet'];

    return _isOuterPlanetName(name);
  }

  String get _selectedMonthTypeLabel {
    return _report?.monthType == 'PURNIMANT' ? 'Purnimant' : 'Amant';
  }

  String get _selectedChartStyleLabel {
    return _report?.chartStyle == 'SOUTH_INDIAN'
        ? 'South Indian'
        : 'North Indian';
  }

  Widget _buildReport() {
    final profile = _profile;
    final report = _report;

    if (profile == null || report == null) {
      return _KundliErrorState(
        message: 'Kundli data is unavailable.',
        onRetry: _loadKundli,
      );
    }

    return DefaultTabController(
      length: 4,
      child: Column(
        children: [
          Container(
            color: AppColors.background,
            child: const TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              indicatorColor: AppColors.gold,
              labelColor: AppColors.gold,
              unselectedLabelColor: AppColors.muted,
              labelStyle: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
              tabs: [
                Tab(text: 'BASICS'),
                Tab(text: 'CHARTS'),
                Tab(text: 'DASHAS & YOGAS'),
                Tab(text: 'PREDICTIONS'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildBasicsTab(profile, report),
                _buildChartsTab(report),
                _buildDashasAndYogasTab(report),
                _buildPredictionsTab(report),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBasicsTab(CustomerProfile profile, KundliReport report) {
    return RefreshIndicator(
      onRefresh: _loadKundli,
      color: AppColors.gold,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          _buildProfileHeader(profile),
          const SizedBox(height: 18),
          _buildStatusCard(report),
          const SizedBox(height: 18),
          _buildPanchangCard(report.panchang),
          const SizedBox(height: 14),
          _buildPlanetaryPositionsCard(report.planetaryPositions),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  List<String> _splitVerifiedExplanation(String value) {
    final normalized = value
        .replaceAll('\r\n', '\n')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    if (normalized.isEmpty) {
      return const <String>[];
    }

    final sentences = normalized
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((sentence) => sentence.trim())
        .where((sentence) => sentence.isNotEmpty)
        .toList();

    if (sentences.length <= 2) {
      return <String>[normalized];
    }

    const targetLength = 270;

    final blocks = <String>[];
    final current = StringBuffer();

    for (final sentence in sentences) {
      final candidateLength =
          current.length + (current.isEmpty ? 0 : 1) + sentence.length;

      if (current.isNotEmpty && candidateLength > targetLength) {
        blocks.add(current.toString().trim());
        current.clear();
      }

      if (current.isNotEmpty) {
        current.write(' ');
      }

      current.write(sentence);
    }

    if (current.isNotEmpty) {
      blocks.add(current.toString().trim());
    }

    if (blocks.length <= 4) {
      return blocks;
    }

    return <String>[
      blocks[0],
      blocks[1],
      blocks[2],
      blocks.sublist(3).join(' '),
    ];
  }

  String _verifiedExplanationBlockTitle(int index, int total) {
    if (index == 0) {
      return 'Chart Overview';
    }

    if (index == total - 1 && total > 2) {
      return 'Overall Interpretation';
    }

    return 'Key Chart Insight ${index + 1}';
  }

  Widget _buildVerifiedChartExplanation({
    required String title,
    required String subtitle,
    required String? explanation,
  }) {
    final text = explanation?.trim() ?? '';
    final available = text.isNotEmpty;

    final blocks = available
        ? _splitVerifiedExplanation(text)
        : const <String>[];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x445D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0x22D7B56D),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x55D7B56D)),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.auto_stories_rounded,
                  color: AppColors.gold,
                  size: 23,
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),

                    const SizedBox(height: 5),

                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          if (!available)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: const Color(0xFF171717),
                borderRadius: BorderRadius.circular(17),
                border: Border.all(color: const Color(0x332D3748)),
              ),
              child: const Text(
                'Detailed interpretation is currently unavailable because the verified Kundli analysis did not return enough supported chart evidence.',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 13,
                  height: 1.55,
                ),
              ),
            )
          else
            ...List.generate(blocks.length, (index) {
              final block = blocks[index];

              return Padding(
                padding: EdgeInsets.only(
                  bottom: index == blocks.length - 1 ? 0 : 12,
                ),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF171717),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: index == 0
                          ? const Color(0x556B571A)
                          : const Color(0x332D3748),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 21,
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),

                          const SizedBox(width: 9),

                          Expanded(
                            child: Text(
                              _verifiedExplanationBlockTitle(
                                index,
                                blocks.length,
                              ),
                              style: const TextStyle(
                                color: AppColors.gold,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 11),

                      Text(
                        block,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                          height: 1.62,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

          const SizedBox(height: 15),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0x171E8E6E),
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: const Color(0x4469D39E)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.verified_rounded,
                  size: 17,
                  color: Color(0xFF69D39E),
                ),

                const SizedBox(width: 9),

                Expanded(
                  child: Text(
                    available
                        ? 'Interpretation is grounded in verified Kundli chart data returned by the backend.'
                        : 'No unsupported chart interpretation has been generated.',
                    style: const TextStyle(
                      color: Color(0xFF9BDDBD),
                      fontSize: 11,
                      height: 1.45,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChartsTab(KundliReport report) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildChartCard(
          title: 'Rasi Chart (D1)',
          icon: Icons.grid_view_rounded,
          value: report.birthChart,
          unavailableText:
              'Rasi chart will appear when verified astrology data is available.',
        ),

        const SizedBox(height: 12),

        _buildVerifiedChartExplanation(
          title: 'D1 Rasi Explanation',
          subtitle:
              'Birth-chart foundation based only on verified backend chart fields.',
          explanation: report.d1Explanation,
        ),

        const SizedBox(height: 18),

        _buildChartCard(
          title: 'Navamsa Chart (D9)',
          icon: Icons.auto_awesome_rounded,
          value: report.navamsaChart,
          unavailableText:
              'Navamsa chart will appear when verified astrology data is available.',
        ),

        const SizedBox(height: 12),

        _buildVerifiedChartExplanation(
          title: 'D9 Navamsa Explanation',
          subtitle:
              'Navamsa summary based only on verified backend chart fields.',
          explanation: report.d9Explanation,
        ),

        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildDashasAndYogasTab(KundliReport report) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildDashaCard(report.dasha),
        const SizedBox(height: 14),
        _buildImportantYogasCard(report.yogas),
        const SizedBox(height: 14),
        _buildDoshaCard(report.dosha),
        const SizedBox(height: 14),
        _buildSadeSatiCard(report.sadeSati),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildPredictionsTab(KundliReport report) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildPredictionCard(
          title: 'Character',
          icon: Icons.person_outline_rounded,
          value: report.character,
          unavailableText: 'Character prediction is currently unavailable.',
        ),
        const SizedBox(height: 14),
        _buildPredictionCard(
          title: 'Career',
          icon: Icons.work_outline_rounded,
          value: report.career,
          unavailableText: 'Career prediction is currently unavailable.',
        ),
        const SizedBox(height: 14),
        _buildPredictionCard(
          title: 'Finance',
          icon: Icons.account_balance_wallet_outlined,
          value: report.finance,
          unavailableText: 'Finance prediction is currently unavailable.',
        ),
        const SizedBox(height: 14),
        _buildPredictionCard(
          title: 'Health',
          icon: Icons.favorite_border_rounded,
          value: report.health,
          unavailableText: 'Health prediction is currently unavailable.',
        ),
        const SizedBox(height: 14),
        _buildPredictionCard(
          title: 'Marriage',
          icon: Icons.favorite_outline_rounded,
          value: report.marriage,
          unavailableText: 'Marriage prediction is currently unavailable.',
        ),
        const SizedBox(height: 14),
        _buildPredictionCard(
          title: 'Suggested Remedies',
          icon: Icons.auto_awesome_rounded,
          value: report.remedies,
          unavailableText: 'Suggested remedies are currently unavailable.',
        ),
        _buildPredictionCard(
          title: 'Transit Overview',
          icon: Icons.route_outlined,
          value: report.transit,
          unavailableText: 'Transit analysis is currently unavailable.',
        ),
        const SizedBox(height: 14),

        _buildPredictionCard(
          title: 'Gemstone Suggestions',
          icon: Icons.diamond_outlined,
          value: report.gemSuggestion,
          unavailableText: 'Gemstone suggestions are currently unavailable.',
        ),
        const SizedBox(height: 14),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildProfileHeader(CustomerProfile profile) {
    final locationParts = [
      profile.city,
      profile.state,
      profile.country,
    ].whereType<String>().where((value) => value.trim().isNotEmpty);

    final location = locationParts.join(', ');

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.background, AppColors.surfaceLight],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x55F4C45E)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.auto_awesome_rounded,
            color: AppColors.gold,
            size: 42,
          ),
          const SizedBox(height: 14),
          Text(
            profile.fullName ?? profile.name,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          _DetailRow(
            label: 'Date of Birth',
            value:
                '${profile.birthDate.day.toString().padLeft(2, '0')}/'
                '${profile.birthDate.month.toString().padLeft(2, '0')}/'
                '${profile.birthDate.year}',
          ),
          _DetailRow(label: 'Time of Birth', value: profile.birthTime),
          _DetailRow(
            label: 'Birth Place',
            value: location.isEmpty ? 'Unavailable' : location,
          ),
          _DetailRow(
            label: 'Timezone',
            value:
                profile.timezoneName ??
                'UTC ${profile.timezone >= 0 ? '+' : ''}${profile.timezone}',
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard(KundliReport report) {
    final percent = report.coreCompletenessPercent.clamp(0, 100);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_rounded, color: AppColors.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  report.status == 'COMPLETE'
                      ? 'Kundli Ready'
                      : 'Kundli Partially Available',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          LinearProgressIndicator(
            value: percent / 100,
            color: AppColors.gold,
            backgroundColor: AppColors.surfaceLight,
          ),
          const SizedBox(height: 9),
          Text(
            '$percent% core Kundli data available',
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          if (!report.isComplete) ...[
            const SizedBox(height: 12),
            const Text(
              'Some sections require an active production astrology API subscription.',
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChartCard({
    required String title,
    required IconData icon,
    required dynamic value,
    required String unavailableText,
  }) {
    final chart = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    if (chart.isEmpty) {
      return _buildSection(
        title: title,
        icon: icon,
        value: null,
        unavailableText: unavailableText,
      );
    }

    // ------------------------------------------------------
    /*
     * Prokerala production SVG chart.
     *
     * Calculation is provided by the deterministic astrology provider.
     * OpenAI only interprets factual report data.
     */
    final svg = chart['svg']?.toString().trim() ?? '';

    if (svg.isNotEmpty && svg.toLowerCase().contains('<svg')) {
      final providerChartName = _kundliText(chart['chart_name']);

      final chartName = providerChartName != '-' ? providerChartName : title;

      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0x335D79B5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppColors.gold),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    chartName,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 6),

            const Text(
              'Calculated from your birth details using the Vedic astrology provider',
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 12,
                height: 1.4,
              ),
            ),

            const SizedBox(height: 16),

            Container(
              width: double.infinity,
              constraints: const BoxConstraints(minHeight: 280, maxHeight: 430),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: SvgPicture.string(
                  svg,
                  width: double.infinity,
                  fit: BoxFit.contain,
                  placeholderBuilder: (context) => const SizedBox(
                    height: 280,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
    // Old/alternate structure:
    // { houses: [...], planets: [...] }
    // ------------------------------------------------------
    final rawHouses = chart['houses'];
    final rawPlanets = chart['planets'];

    final explicitHouses = rawHouses is List
        ? rawHouses
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
        : const <Map<String, dynamic>>[];

    final explicitPlanets = rawPlanets is List
        ? rawPlanets
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
        : const <Map<String, dynamic>>[];

    // ------------------------------------------------------
    // Real Vedic response:
    // {
    //   "0": {...},
    //   "1": {...},
    //   ...
    //   "chart": "...",
    //   "chart_name": "..."
    // }
    // ------------------------------------------------------
    final vedicPlacements = <Map<String, dynamic>>[];

    for (final entry in chart.entries) {
      if (int.tryParse(entry.key.toString()) == null) {
        continue;
      }

      if (entry.value is Map) {
        vedicPlacements.add(Map<String, dynamic>.from(entry.value as Map));
      }
    }

    final placements = explicitPlanets.isNotEmpty
        ? explicitPlanets
        : vedicPlacements;

    final visiblePlacements = placements
        .where((planet) => !_shouldHidePlanet(planet))
        .toList(growable: false);

    if (explicitHouses.isEmpty && visiblePlacements.isEmpty) {
      return _buildSection(
        title: title,
        icon: icon,
        value: chart,
        unavailableText: unavailableText,
      );
    }

    const rasiNames = <int, String>{
      1: 'Aries',
      2: 'Taurus',
      3: 'Gemini',
      4: 'Cancer',
      5: 'Leo',
      6: 'Virgo',
      7: 'Libra',
      8: 'Scorpio',
      9: 'Sagittarius',
      10: 'Capricorn',
      11: 'Aquarius',
      12: 'Pisces',
    };

    final chartName = _kundliText(chart['chart_name']) != '-'
        ? _kundliText(chart['chart_name'])
        : title;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),

          if (chartName != title) ...[
            const SizedBox(height: 6),
            Text(
              chartName,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],

          const SizedBox(height: 16),

          if (explicitHouses.isNotEmpty)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: explicitHouses.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.65,
              ),
              itemBuilder: (context, index) {
                final house = explicitHouses[index];

                final houseNumber = house['house'] ?? house['house_no'];

                final rasiNoRaw = house['rasi_no'] ?? house['sign_no'];

                final rasiNo = rasiNoRaw is num
                    ? rasiNoRaw.toInt()
                    : int.tryParse(rasiNoRaw?.toString() ?? '');

                final sign = _kundliText(house['sign']) != '-'
                    ? _kundliText(house['sign'])
                    : (rasiNo == null ? '-' : (rasiNames[rasiNo] ?? '-'));

                final housePlanets = visiblePlacements
                    .where((planet) => planet['house'] == houseNumber)
                    .map(
                      (planet) =>
                          _kundliText(planet['full_name'] ?? planet['name']),
                    )
                    .where((name) => name != '-')
                    .join(', ');

                return _buildKundliPlacementTile(
                  heading: 'House ${_kundliText(houseNumber)}',
                  sign: sign,
                  planets: housePlanets,
                );
              },
            )
          else
            ...visiblePlacements.map((planet) {
              final planetName = _kundliText(
                planet['full_name'] ?? planet['planet_name'] ?? planet['name'],
              );

              final house = _kundliText(planet['house']);

              final rasiRaw = planet['rasi_no'] ?? planet['sign_no'];

              final rasiNo = rasiRaw is num
                  ? rasiRaw.toInt()
                  : int.tryParse(rasiRaw?.toString() ?? '');

              final signName =
                  _kundliText(planet['rasi'] ?? planet['sign']) != '-'
                  ? _kundliText(planet['rasi'] ?? planet['sign'])
                  : (rasiNo == null ? '-' : (rasiNames[rasiNo] ?? '-'));

              final nakshatra = _kundliText(planet['nakshatra']);

              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x334F6FA8)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      planetName,
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'House: $house',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Sign: $signName',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                      ),
                    ),
                    if (nakshatra != '-') ...[
                      const SizedBox(height: 3),
                      Text(
                        'Nakshatra: $nakshatra',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildKundliPlacementTile({
    required String heading,
    required String sign,
    required String planets,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x334F6FA8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            heading,
            style: const TextStyle(
              color: AppColors.gold,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'Sign: $sign',
            style: const TextStyle(color: AppColors.white, fontSize: 12),
          ),
          const SizedBox(height: 5),
          Text(
            planets.isEmpty ? 'Planets: None' : 'Planets: $planets',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 11,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHouseAnalysisCard(dynamic value) {
    final houses = value is List
        ? value
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
        : const <Map<String, dynamic>>[];

    if (houses.isEmpty) {
      return _buildSection(
        title: 'House Analysis',
        icon: Icons.home_work_outlined,
        value: null,
        unavailableText: 'House analysis is currently unavailable.',
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.home_work_outlined, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'House Analysis',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          ...houses.map((house) {
            final number = _kundliText(house['house']);

            final startRasi = _kundliText(house['start_rasi']);

            final endRasi = _kundliText(house['end_rasi']);

            final subLord = _kundliText(house['cusp_sub_lord']);

            final startNakshatra = _kundliText(house['start_nakshatra']);

            final endNakshatra = _kundliText(house['end_nakshatra']);

            final rawPlanets = house['planets'];

            final planetNames = <String>[];

            if (rawPlanets is List) {
              for (final planet in rawPlanets) {
                if (planet is Map) {
                  final mapped = Map<String, dynamic>.from(planet);

                  final name = _kundliText(
                    mapped['full_name'] ?? mapped['name'],
                  );

                  if (name != '-') {
                    planetNames.add(name);
                  }
                } else {
                  final text = planet?.toString().trim() ?? '';

                  if (text.isNotEmpty) {
                    final fullNameMatch = RegExp(
                      r'full_name=([^;}\]]+)',
                    ).firstMatch(text);

                    if (fullNameMatch != null) {
                      planetNames.add(fullNameMatch.group(1)!.trim());
                    }
                  }
                }
              }
            }

            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0x334F6FA8)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'House $number',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 7),

                  if (startRasi != '-' || endRasi != '-')
                    Text(
                      'Signs: $startRasi -> $endRasi',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),

                  if (startNakshatra != '-' || endNakshatra != '-') ...[
                    const SizedBox(height: 4),
                    Text(
                      'Nakshatra: $startNakshatra -> $endNakshatra',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],

                  if (subLord != '-') ...[
                    const SizedBox(height: 4),
                    Text(
                      'Sub Lord: $subLord',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],

                  const SizedBox(height: 4),

                  Text(
                    planetNames.isEmpty
                        ? 'Planets: None'
                        : 'Planets: ${planetNames.join(', ')}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSadeSatiCard(dynamic value) {
    if (value is! Map) {
      return _buildSection(
        title: 'Sade Sati Analysis',
        icon: Icons.insights_rounded,
        value: null,
        unavailableText: 'Sade Sati analysis is currently unavailable.',
      );
    }

    final data = Map<String, dynamic>.from(value);

    final rawStatus = data['is_in_sade_sati'] ?? data['isInSadeSati'];

    final bool? isInSadeSati = rawStatus is bool
        ? rawStatus
        : rawStatus?.toString().toLowerCase() == 'true'
        ? true
        : rawStatus?.toString().toLowerCase() == 'false'
        ? false
        : null;

    final phase =
        data['transit_phase']?.toString().trim() ??
        data['transitPhase']?.toString().trim() ??
        '';

    final description = data['description']?.toString().trim() ?? '';

    final rawTransits = data['transits'];

    final transits = rawTransits is List
        ? rawTransits
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
        : <Map<String, dynamic>>[];

    final statusText = isInSadeSati == null
        ? 'Status unavailable'
        : isInSadeSati
        ? 'Currently in Sade Sati'
        : 'Not currently in Sade Sati';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.insights_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Sade Sati Analysis',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x334F6FA8)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statusText,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),

                if (phase.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Phase: $phase',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],

                if (description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                      height: 1.45,
                    ),
                  ),
                ],
              ],
            ),
          ),

          if (transits.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'Transit Timeline',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),

            ...transits.map((transit) {
              final saturnSign =
                  transit['saturn_sign']?.toString().trim() ?? '';

              final transitPhase = transit['phase']?.toString().trim() ?? '';

              final start = transit['start']?.toString().trim() ?? '';

              final end = transit['end']?.toString().trim() ?? '';

              final transitDescription =
                  transit['description']?.toString().trim() ?? '';

              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x224F6FA8)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      [
                        if (transitPhase.isNotEmpty) transitPhase,
                        if (saturnSign.isNotEmpty) saturnSign,
                      ].join(' • '),
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),

                    if (start.isNotEmpty || end.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        '$start${start.isNotEmpty && end.isNotEmpty ? '  →  ' : ''}$end',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],

                    if (transitDescription.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        transitDescription,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildImportantYogasCard(dynamic value) {
    final groups = <Map<String, dynamic>>[];

    if (value is List) {
      groups.addAll(
        value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)),
      );
    } else if (value is Map) {
      final data = Map<String, dynamic>.from(value);

      final nested =
          data['yoga_details'] ??
          data['yogaDetails'] ??
          data['yogas'] ??
          data['yogas_list'] ??
          data['yoga_list'];

      if (nested is List) {
        groups.addAll(
          nested.whereType<Map>().map(
            (item) => Map<String, dynamic>.from(item),
          ),
        );
      }
    }

    if (groups.isEmpty) {
      return _buildSection(
        title: 'Important Yogas',
        icon: Icons.auto_awesome_rounded,
        value: null,
        unavailableText: 'Important Yogas are currently unavailable.',
      );
    }

    final presentYogas = <Map<String, dynamic>>[];

    for (final group in groups) {
      final category =
          group['name']?.toString().trim() ??
          group['category']?.toString().trim() ??
          '';

      final rawYogaList = group['yoga_list'] ?? group['yogaList'];

      if (rawYogaList is! List) {
        continue;
      }

      for (final rawYoga in rawYogaList.whereType<Map>()) {
        final yoga = Map<String, dynamic>.from(rawYoga);

        final rawHasYoga = yoga['has_yoga'] ?? yoga['hasYoga'];

        final hasYoga =
            rawHasYoga == true ||
            rawHasYoga == 1 ||
            rawHasYoga?.toString().trim().toLowerCase() == 'true';

        if (!hasYoga) {
          continue;
        }

        final name = yoga['name']?.toString().trim() ?? '';

        if (name.isEmpty) {
          continue;
        }

        final description = yoga['description']?.toString().trim() ?? '';

        presentYogas.add({
          'name': name,
          'description': description,
          'category': category,
        });
      }
    }

    if (presentYogas.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0x335D79B5)),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome_rounded, color: AppColors.gold),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Important Yogas',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 10),
            Text(
              'No active important Yoga was reported in your Prokerala Kundli result.',
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                height: 1.45,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Important Yogas',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          const Text(
            'Verified Yogas present in your birth chart',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),

          const SizedBox(height: 14),

          _YogaSummaryChip(label: 'Present', value: '${presentYogas.length}'),

          const SizedBox(height: 16),

          ...presentYogas.map((yoga) {
            final name = yoga['name']?.toString().trim() ?? '';

            final description = yoga['description']?.toString().trim() ?? '';

            final category = yoga['category']?.toString().trim() ?? '';

            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0x334F6FA8)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),

                  if (category.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      category,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],

                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      description,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildShadbalaCard(dynamic value) {
    final data = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    if (data.isEmpty) {
      return _buildSection(
        title: 'Planetary Strengths (Shadbala)',
        icon: Icons.insights_rounded,
        value: null,
        unavailableText: 'Shadbala analysis is currently unavailable.',
      );
    }

    Map<String, dynamic> mapOf(String key) {
      final raw = data[key];

      if (raw is Map) {
        return Map<String, dynamic>.from(raw);
      }

      return const <String, dynamic>{};
    }

    final totalBalas = mapOf('total_balas');
    final ratio = mapOf('ratio');
    final sthana = mapOf('total_sthana_bala');
    final dig = mapOf('dig_bala');
    final chesta = mapOf('chesta_Bala');

    final planets = <String>[
      'Sun',
      'Moon',
      'Mars',
      'Mercury',
      'Jupiter',
      'Venus',
      'Saturn',
    ];

    String numberText(dynamic input, {int decimals = 2}) {
      if (input is num) {
        return input.toStringAsFixed(decimals);
      }

      final parsed = num.tryParse(input?.toString() ?? '');

      if (parsed != null) {
        return parsed.toStringAsFixed(decimals);
      }

      return '-';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.insights_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Planetary Strengths (Shadbala)',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          const Text(
            'Real provider-calculated planetary strength values',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),

          const SizedBox(height: 16),

          ...planets.map((planet) {
            final total = totalBalas[planet];
            final ratioValue = ratio[planet];
            final sthanaValue = sthana[planet];
            final digValue = dig[planet];
            final chestaValue = chesta[planet];

            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0x334F6FA8)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    planet,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),

                  Text(
                    'Total Bala: ${numberText(total)}',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 12,
                    ),
                  ),

                  const SizedBox(height: 4),

                  Text(
                    'Strength Ratio: ${numberText(ratioValue)}',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 12,
                    ),
                  ),

                  const SizedBox(height: 4),

                  Text(
                    'Sthana Bala: ${numberText(sthanaValue)}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),

                  const SizedBox(height: 3),

                  Text(
                    'Dig Bala: ${numberText(digValue)}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),

                  const SizedBox(height: 3),

                  Text(
                    'Chesta Bala: ${numberText(chestaValue)}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildAshtakavargaCard(dynamic value) {
    final data = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    if (data.isEmpty) {
      return _buildSection(
        title: 'Ashtakavarga',
        icon: Icons.grid_view_rounded,
        value: null,
        unavailableText: 'Ashtakavarga data is currently unavailable.',
      );
    }

    final order = data['ashtakvarga_order'] is List
        ? List<dynamic>.from(data['ashtakvarga_order'] as List)
        : const <dynamic>[];

    final points = data['ashtakvarga_points'] is List
        ? List<dynamic>.from(data['ashtakvarga_points'] as List)
        : const <dynamic>[];

    final totals = data['ashtakvarga_total'] is List
        ? List<dynamic>.from(data['ashtakvarga_total'] as List)
        : const <dynamic>[];

    if (order.isEmpty || points.isEmpty || totals.isEmpty) {
      return _buildSection(
        title: 'Ashtakavarga',
        icon: Icons.grid_view_rounded,
        value: data,
        unavailableText: 'Ashtakavarga data is currently unavailable.',
      );
    }

    const signs = <String>[
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.grid_view_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Ashtakavarga',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Sarvashtakavarga totals and planetary bindu distribution',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 16),

          // Totals
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(totals.length < 12 ? totals.length : 12, (
              index,
            ) {
              final label = index < signs.length
                  ? signs[index]
                  : 'Sign ${index + 1}';

              return Container(
                width: 96,
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x334F6FA8)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 10,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      totals[index].toString(),
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),

          const SizedBox(height: 18),

          // Planet rows
          ...List.generate(
            order.length < points.length ? order.length : points.length,
            (rowIndex) {
              final row = points[rowIndex] is List
                  ? List<dynamic>.from(points[rowIndex] as List)
                  : const <dynamic>[];

              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x334F6FA8)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order[rowIndex].toString(),
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: List.generate(
                        row.length < 12 ? row.length : 12,
                        (index) {
                          final sign = index < signs.length
                              ? signs[index]
                              : '${index + 1}';

                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              color: AppColors.surfaceLight,
                            ),
                            child: Text(
                              '$sign: ${row[index]}',
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 10,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  List<String> _splitPredictionExplanation(String value) {
    final normalized = value.replaceAll('\r\n', '\n').trim();

    if (normalized.isEmpty) {
      return const <String>[];
    }

    final lines = normalized
        .split(RegExp(r'\n+'))
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();

    if (lines.length >= 2) {
      return lines.length <= 5
          ? lines
          : <String>[
              lines[0],
              lines[1],
              lines[2],
              lines[3],
              lines.sublist(4).join(' '),
            ];
    }

    final sentences = normalized
        .replaceAll(RegExp(r'\s+'), ' ')
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((sentence) => sentence.trim())
        .where((sentence) => sentence.isNotEmpty)
        .toList();

    if (sentences.length <= 2) {
      return <String>[normalized];
    }

    const targetLength = 260;

    final blocks = <String>[];
    final current = StringBuffer();

    for (final sentence in sentences) {
      final candidateLength =
          current.length + (current.isEmpty ? 0 : 1) + sentence.length;

      if (current.isNotEmpty && candidateLength > targetLength) {
        blocks.add(current.toString().trim());
        current.clear();
      }

      if (current.isNotEmpty) {
        current.write(' ');
      }

      current.write(sentence);
    }

    if (current.isNotEmpty) {
      blocks.add(current.toString().trim());
    }

    if (blocks.length <= 4) {
      return blocks;
    }

    return <String>[
      blocks[0],
      blocks[1],
      blocks[2],
      blocks.sublist(3).join(' '),
    ];
  }

  String _predictionBlockTitle({
    required String sectionTitle,
    required int index,
    required int total,
  }) {
    if (sectionTitle == 'Suggested Remedies') {
      return 'Remedy ${index + 1}';
    }

    if (index == 0) {
      return 'Overview';
    }

    if (index == total - 1 && total > 2) {
      return 'Overall Guidance';
    }

    return 'Key Insight ${index + 1}';
  }

  Widget _buildPredictionCard({
    required String title,
    required IconData icon,
    required dynamic value,
    required String unavailableText,
  }) {
    if (!_hasValue(value) || _isProviderError(value)) {
      return _buildSection(
        title: title,
        icon: icon,
        value: null,
        unavailableText: unavailableText,
      );
    }

    final text = _readableKundliValue(value).trim();

    if (text.isEmpty || text == '-') {
      return _buildSection(
        title: title,
        icon: icon,
        value: null,
        unavailableText: unavailableText,
      );
    }

    final blocks = _splitPredictionExplanation(text);
    final isRemedies = title == 'Suggested Remedies';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x445D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0x22D7B56D),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x55D7B56D)),
                ),
                alignment: Alignment.center,
                child: Icon(icon, color: AppColors.gold, size: 23),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isRemedies
                          ? 'Personalized spiritual guidance from your Kundli report.'
                          : 'Personalized interpretation based on verified Kundli report data.',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          ...List.generate(blocks.length, (index) {
            final block = blocks[index];

            return Padding(
              padding: EdgeInsets.only(
                bottom: index == blocks.length - 1 ? 0 : 11,
              ),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: const Color(0xFF171717),
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(
                    color: isRemedies
                        ? const Color(0x445F8E72)
                        : index == 0
                        ? const Color(0x556B571A)
                        : const Color(0x332D3748),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (isRemedies)
                          const Icon(
                            Icons.check_circle_outline_rounded,
                            size: 17,
                            color: Color(0xFF69D39E),
                          )
                        else
                          Container(
                            width: 4,
                            height: 20,
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),

                        const SizedBox(width: 9),

                        Expanded(
                          child: Text(
                            _predictionBlockTitle(
                              sectionTitle: title,
                              index: index,
                              total: blocks.length,
                            ),
                            style: TextStyle(
                              color: isRemedies
                                  ? const Color(0xFF9BDDBD)
                                  : AppColors.gold,
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    Text(
                      block,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        height: 1.6,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 14),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(
              color: const Color(0x171E8E6E),
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: const Color(0x4469D39E)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.verified_rounded,
                  size: 16,
                  color: Color(0xFF69D39E),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isRemedies
                        ? 'These remedies come from the existing Kundli interpretation and are optional spiritual guidance.'
                        : 'This interpretation uses the existing Kundli analysis returned by the backend.',
                    style: const TextStyle(
                      color: Color(0xFF9BDDBD),
                      fontSize: 11,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDoshaCard(dynamic value) {
    final dosha = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    final entries = dosha.entries
        .where((entry) => _hasValue(entry.value))
        .toList(growable: false);

    if (entries.isEmpty) {
      return _buildSection(
        title: 'Dosha Analysis',
        icon: Icons.warning_amber_rounded,
        value: null,
        unavailableText: 'Dosha analysis is currently unavailable.',
      );
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Dosha Analysis',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...entries.map((entry) {
            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _prettyKundliKey(entry.key),
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _readableKundliValue(entry.value),
                    style: const TextStyle(color: AppColors.white, height: 1.4),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _prettyKundliKey(String key) {
    final spaced = key
        .replaceAll('_', ' ')
        .replaceAllMapped(
          RegExp(r'([a-z])([A-Z])'),
          (match) => '${match.group(1)} ${match.group(2)}',
        )
        .trim();

    if (spaced.isEmpty) {
      return '-';
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

  String _readableKundliValue(dynamic value) {
    if (value == null) {
      return '-';
    }

    if (value is String || value is num || value is bool) {
      return value.toString();
    }

    if (value is List) {
      return value
          .where((item) => _hasValue(item))
          .map(_readableKundliValue)
          .join('\n');
    }

    if (value is Map) {
      final map = Map<String, dynamic>.from(value);

      return map.entries
          .where((entry) => _hasValue(entry.value))
          .map(
            (entry) =>
                '${_prettyKundliKey(entry.key.toString())}: '
                '${_readableKundliValue(entry.value)}',
          )
          .join('\n');
    }

    return value.toString();
  }

  Widget _buildDashaCard(dynamic value) {
    final dasha = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    if (dasha.isEmpty) {
      return _buildSection(
        title: 'Vimshottari Dasha',
        icon: Icons.timeline_rounded,
        value: null,
        unavailableText: 'Dasha information is currently unavailable.',
      );
    }

    Map<String, dynamic>? mapOf(dynamic input) {
      if (input is Map<String, dynamic>) {
        return input;
      }

      if (input is Map) {
        return Map<String, dynamic>.from(input);
      }

      return null;
    }

    List<Map<String, dynamic>> listOfMaps(dynamic input) {
      if (input is! List) {
        return const <Map<String, dynamic>>[];
      }

      return input
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    }

    String textOf(dynamic input) {
      final text = input?.toString().trim() ?? '';

      return text.isEmpty ? '-' : text;
    }

    String periodText(Map<String, dynamic>? period) {
      if (period == null) {
        return 'Unavailable';
      }

      final start = textOf(period['start']);
      final end = textOf(period['end']);

      if (start == '-' && end == '-') {
        return 'Dates unavailable';
      }

      return '$start - $end';
    }

    final current = mapOf(dasha['current']);

    final currentMaha = mapOf(current?['mahaDasha']);

    final currentAntar = mapOf(current?['antarDasha']);

    final timeline = listOfMaps(dasha['timeline']);

    Widget currentPeriodCard({
      required String label,
      required Map<String, dynamic>? period,
      required IconData icon,
    }) {
      final lord = period == null ? 'Unavailable' : textOf(period['lord']);

      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x335D79B5)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0x2239A0FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.gold, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    lord,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    periodText(period),
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 12,
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.timeline_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Vimshottari Dasha',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          const Text(
            'Current planetary periods and complete Mahadasha and Antardasha timeline.',
            style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.4),
          ),

          const SizedBox(height: 16),

          currentPeriodCard(
            label: 'CURRENT MAHADASHA',
            period: currentMaha,
            icon: Icons.public_rounded,
          ),

          const SizedBox(height: 10),

          currentPeriodCard(
            label: 'CURRENT ANTARDASHA',
            period: currentAntar,
            icon: Icons.auto_awesome_rounded,
          ),

          const SizedBox(height: 20),

          const Text(
            'Mahadasha Timeline',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),

          const SizedBox(height: 10),

          if (timeline.isEmpty)
            const Text(
              'Mahadasha timeline is unavailable.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            )
          else
            ...timeline.map((maha) {
              final lord = textOf(maha['lord']);

              final children = listOfMaps(
                maha['children'] ?? maha['subPeriods'],
              );

              final isCurrent =
                  currentMaha != null &&
                  textOf(currentMaha['lord']).toLowerCase() ==
                      lord.toLowerCase() &&
                  textOf(currentMaha['start']) == textOf(maha['start']);

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: isCurrent
                      ? const Color(0x221E88E5)
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isCurrent ? AppColors.gold : const Color(0x334F6FA8),
                  ),
                ),
                child: ExpansionTile(
                  iconColor: AppColors.gold,
                  collapsedIconColor: AppColors.muted,
                  tilePadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '$lord Mahadasha',
                          style: TextStyle(
                            color: isCurrent ? AppColors.gold : AppColors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      if (isCurrent)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0x2239A0FF),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'CURRENT',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      periodText(maha),
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  children: [
                    if (children.isEmpty)
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Antardasha periods unavailable.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      )
                    else
                      ...children.map((antar) {
                        final antarLord = textOf(antar['lord']);

                        final antarIsCurrent =
                            currentAntar != null &&
                            textOf(currentAntar['lord']).toLowerCase() ==
                                antarLord.toLowerCase() &&
                            textOf(currentAntar['start']) ==
                                textOf(antar['start']);

                        return Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(11),
                          decoration: BoxDecoration(
                            color: antarIsCurrent
                                ? const Color(0x2239A0FF)
                                : AppColors.background,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: antarIsCurrent
                                      ? AppColors.gold
                                      : AppColors.muted,
                                ),
                              ),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$antarLord Antardasha',
                                      style: TextStyle(
                                        color: antarIsCurrent
                                            ? AppColors.gold
                                            : AppColors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      periodText(antar),
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (antarIsCurrent)
                                const Text(
                                  'NOW',
                                  style: TextStyle(
                                    color: AppColors.gold,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildPanchangCard(dynamic value) {
    final panchang = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};

    if (panchang.isEmpty) {
      return _buildSection(
        title: 'Panchang Details',
        icon: Icons.wb_sunny_outlined,
        value: null,
        unavailableText: 'Panchang details are currently unavailable.',
      );
    }

    dynamic firstValue(List<String> keys) {
      for (final key in keys) {
        final candidate = panchang[key];

        if (candidate != null && candidate.toString().trim().isNotEmpty) {
          return candidate;
        }
      }

      return null;
    }

    final rows =
        <MapEntry<String, dynamic>>[
              MapEntry(
                'Tithi',
                firstValue(['tithi', 'tithi_name', 'tithiName']),
              ),
              MapEntry(
                'Nakshatra',
                firstValue(['nakshatra', 'nakshatra_name', 'nakshatraName']),
              ),
              MapEntry('Yoga', firstValue(['yoga', 'yoga_name', 'yogaName'])),
              MapEntry(
                'Karana',
                firstValue(['karana', 'karana_name', 'karanaName']),
              ),
              MapEntry(
                'Ayanamsa',
                firstValue([
                  'ayanamsa',
                  'ayanamsha',
                  'ayanamsa_name',
                  'ayanamsha_name',
                ]),
              ),
              MapEntry('Month Type', _selectedMonthTypeLabel),
              MapEntry('Chart Style', _selectedChartStyleLabel),
            ]
            .where((entry) {
              final text = entry.value?.toString().trim() ?? '';
              return text.isNotEmpty;
            })
            .toList(growable: false);

    if (rows.isEmpty) {
      return _buildSection(
        title: 'Panchang Details',
        icon: Icons.wb_sunny_outlined,
        value: panchang,
        unavailableText: 'Panchang details are currently unavailable.',
      );
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.wb_sunny_outlined, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Panchang Details',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...rows.map(
            (entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 105,
                    child: Text(
                      entry.key,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      _kundliText(entry.value),
                      style: const TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanetaryPositionsCard(dynamic value) {
    final planets = value is List
        ? value
              .whereType<Map>()
              .map((item) {
                return Map<String, dynamic>.from(item);
              })
              .where((planet) => !_shouldHidePlanet(planet))
              .toList(growable: false)
        : const <Map<String, dynamic>>[];

    if (planets.isEmpty) {
      return _buildSection(
        title: 'Planetary Positions',
        icon: Icons.public_rounded,
        value: null,
        unavailableText: 'Planetary positions are currently unavailable.',
      );
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.public_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Planetary Positions',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowHeight: 40,
              dataRowMinHeight: 42,
              dataRowMaxHeight: 54,
              columnSpacing: 22,
              columns: const [
                DataColumn(label: Text('Planet')),
                DataColumn(label: Text('Sign')),
                DataColumn(label: Text('Degree')),
                DataColumn(label: Text('House')),
                DataColumn(label: Text('Nakshatra')),
                DataColumn(label: Text('Motion')),
              ],
              rows: planets
                  .map((planet) {
                    final degree =
                        planet['degree_in_sign'] ??
                        planet['degree'] ??
                        planet['absolute_degree'];

                    final retrograde =
                        planet['is_retrograde'] == true ||
                        planet['retrograde'] == true;

                    return DataRow(
                      cells: [
                        DataCell(Text(_kundliText(planet['name']))),
                        DataCell(Text(_kundliText(planet['sign']))),
                        DataCell(Text(_kundliDegree(degree))),
                        DataCell(Text(_kundliText(planet['house']))),
                        DataCell(Text(_kundliText(planet['nakshatra']))),
                        DataCell(Text(retrograde ? 'Retrograde' : 'Direct')),
                      ],
                    );
                  })
                  .toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }

  String _kundliText(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? '-' : text;
  }

  String _kundliDegree(dynamic value) {
    if (value is num) {
      return '${value.toStringAsFixed(2)} deg';
    }

    final parsed = double.tryParse(value?.toString() ?? '');

    if (parsed != null) {
      return '${parsed.toStringAsFixed(2)} deg';
    }

    return '-';
  }

  Widget _buildSection({
    required String title,
    required IconData icon,
    required dynamic value,
    required String unavailableText,
  }) {
    final providerError = _isProviderError(value);
    final hasValue = _hasValue(value) && !providerError;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x335D79B5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.gold),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (!hasValue)
            Text(
              providerError
                  ? 'This section is temporarily unavailable. Please try again later.'
                  : unavailableText,
              style: const TextStyle(color: AppColors.muted, height: 1.45),
            )
          else
            SelectableText(
              _prettyValue(value),
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                height: 1.5,
              ),
            ),
        ],
      ),
    );
  }

  bool _isProviderError(dynamic value) {
    if (value is Map) {
      final status = value['status'];

      if (status is num && status >= 400) {
        return true;
      }

      for (final nestedValue in value.values) {
        if (_isProviderError(nestedValue)) {
          return true;
        }
      }
    }

    if (value is List) {
      return value.any(_isProviderError);
    }

    return false;
  }

  bool _hasValue(dynamic value) {
    if (value == null) {
      return false;
    }

    if (value is List) {
      return value.isNotEmpty;
    }

    if (value is Map) {
      return value.isNotEmpty;
    }

    return value.toString().trim().isNotEmpty;
  }

  String _prettyValue(dynamic value) {
    if (value is Map) {
      return value.entries
          .map((entry) => '${entry.key}: ${entry.value}')
          .join('\n');
    }

    if (value is List) {
      return value.map((item) => item.toString()).join('\n');
    }

    return value.toString();
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(
              label,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _KundliErrorState extends StatelessWidget {
  const _KundliErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.gold,
              size: 54,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white, fontSize: 15),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _YogaSummaryChip extends StatelessWidget {
  const _YogaSummaryChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x334F6FA8)),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
