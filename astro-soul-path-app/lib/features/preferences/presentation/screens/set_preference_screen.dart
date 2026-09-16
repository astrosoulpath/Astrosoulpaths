import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_theme_controller.dart';
import '../../data/preferences_api.dart';

class SetPreferenceScreen extends StatefulWidget {
  const SetPreferenceScreen({super.key});

  @override
  State<SetPreferenceScreen> createState() => _SetPreferenceScreenState();
}

class _SetPreferenceScreenState extends State<SetPreferenceScreen> {
  final PreferencesApi _preferencesApi = PreferencesApi();

  bool _loading = true;
  bool _saving = false;
  String _error = '';
  String _chartStyle = 'northIndian';
  String _monthType = 'amant';
  bool _darkMode = false;
  bool _hideOuterPlanets = false;
  bool _customCalendar = false;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  @override
  void dispose() {
    _preferencesApi.close();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final preferences = await _preferencesApi.getPreferences();

      await AppThemeController.setDarkMode(preferences.darkMode);

      if (!mounted) {
        return;
      }

      setState(() {
        _chartStyle = preferences.chartStyle == 'SOUTH_INDIAN'
            ? 'southIndian'
            : 'northIndian';

        _monthType = preferences.monthType == 'PURNIMANT'
            ? 'purnimant'
            : 'amant';

        _darkMode = preferences.darkMode;
        _hideOuterPlanets = preferences.hideOuterPlanets;
        _customCalendar = preferences.customCalendar;
      });
    } on PreferencesApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _restoreDefaults() async {
    setState(() {
      _chartStyle = 'northIndian';
      _monthType = 'amant';
      _darkMode = false;
      _hideOuterPlanets = false;
      _customCalendar = false;
    });

    // Preview the default theme immediately across the whole app.
    await AppThemeController.setDarkMode(false);
  }

  Future<void> _savePreferences() async {
    if (_saving) {
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      final saved = await _preferencesApi.updatePreferences(
        chartStyle: _chartStyle == 'southIndian'
            ? 'SOUTH_INDIAN'
            : 'NORTH_INDIAN',
        monthType: _monthType == 'purnimant' ? 'PURNIMANT' : 'AMANT',
        darkMode: _darkMode,
        hideOuterPlanets: _hideOuterPlanets,
        customCalendar: _customCalendar,
      );

      await AppThemeController.setDarkMode(saved.darkMode);
      if (!mounted) {
        return;
      }

      setState(() {
        _chartStyle = saved.chartStyle == 'SOUTH_INDIAN'
            ? 'southIndian'
            : 'northIndian';

        _monthType = saved.monthType == 'PURNIMANT' ? 'purnimant' : 'amant';

        _darkMode = saved.darkMode;
        _hideOuterPlanets = saved.hideOuterPlanets;
        _customCalendar = saved.customCalendar;
      });

      Navigator.of(context).pop();
    } on PreferencesApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.surface,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        title: const Text(
          'Set Preference',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          children: [
            if (_loading) ...[
              const LinearProgressIndicator(),
              const SizedBox(height: 16),
            ],
            if (_error.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.35)),
                ),
                child: Text(
                  _error,
                  style: const TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            const _SectionTitle('Chart Style'),
            const SizedBox(height: 8),

            _PreferenceRadio<String>(
              title: 'North Indian',
              value: 'northIndian',
              groupValue: _chartStyle,
              onChanged: (value) {
                if (value != null) {
                  setState(() => _chartStyle = value);
                }
              },
            ),
            _PreferenceRadio<String>(
              title: 'South Indian',
              value: 'southIndian',
              groupValue: _chartStyle,
              onChanged: (value) {
                if (value != null) {
                  setState(() => _chartStyle = value);
                }
              },
            ),

            const SizedBox(height: 22),

            Row(
              children: [
                if (_loading) ...[
                  const LinearProgressIndicator(),
                  const SizedBox(height: 16),
                ],
                if (_error.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Colors.red.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      _error,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                const Expanded(child: _SectionTitle('Month Type')),
                IconButton(
                  tooltip: 'Month Type information',
                  onPressed: () {
                    showDialog<void>(
                      context: context,
                      builder: (context) {
                        return AlertDialog(
                          title: const Text('Month Type'),
                          content: const Text(
                            'Choose Amant or Purnimant based on the lunar month system you want to use.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('OK'),
                            ),
                          ],
                        );
                      },
                    );
                  },
                  icon: const Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.gold,
                  ),
                ),
              ],
            ),

            _PreferenceRadio<String>(
              title: 'Amant',
              value: 'amant',
              groupValue: _monthType,
              onChanged: (value) {
                if (value != null) {
                  setState(() => _monthType = value);
                }
              },
            ),
            _PreferenceRadio<String>(
              title: 'Purnimant',
              value: 'purnimant',
              groupValue: _monthType,
              onChanged: (value) {
                if (value != null) {
                  setState(() => _monthType = value);
                }
              },
            ),

            const SizedBox(height: 22),
            const _SectionTitle('Dark Mode'),
            const SizedBox(height: 8),

            _PreferenceRadio<bool>(
              title: 'On',
              value: true,
              groupValue: _darkMode,
              onChanged: (value) async {
                if (value != null) {
                  setState(() => _darkMode = value);

                  // Apply the selected theme immediately to the whole app.
                  await AppThemeController.setDarkMode(value);
                }
              },
            ),
            _PreferenceRadio<bool>(
              title: 'Off',
              value: false,
              groupValue: _darkMode,
              onChanged: (value) async {
                if (value != null) {
                  setState(() => _darkMode = value);
                  await AppThemeController.setDarkMode(value);
                }
              },
            ),

            const SizedBox(height: 12),

            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.gold,
              checkColor: Colors.black,
              value: _hideOuterPlanets,
              onChanged: (value) {
                setState(() => _hideOuterPlanets = value ?? false);
              },
              title: Text(
                "Don't Show Ur, Ne and Pl in chart",
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),

            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.gold,
              checkColor: Colors.black,
              value: _customCalendar,
              onChanged: (value) {
                setState(() => _customCalendar = value ?? false);
              },
              title: Text(
                'Custom Calendar (Year 1600 to 2400)',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),

            const SizedBox(height: 24),

            Row(
              children: [
                if (_loading) ...[
                  const LinearProgressIndicator(),
                  const SizedBox(height: 16),
                ],
                if (_error.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Colors.red.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      _error,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                Expanded(
                  child: OutlinedButton(
                    onPressed: _restoreDefaults,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.gold,
                      side: const BorderSide(color: AppColors.gold),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    child: const Text(
                      'DEFAULT',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _loading || _saving ? null : _savePreferences,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            'SAVE',
                            style: TextStyle(fontWeight: FontWeight.w900),
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        fontSize: 20,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _PreferenceRadio<T> extends StatelessWidget {
  const _PreferenceRadio({
    required this.title,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  final String title;
  final T value;
  final T groupValue;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return RadioGroup<T>(
      groupValue: groupValue,
      onChanged: onChanged,
      child: RadioListTile<T>(
        contentPadding: EdgeInsets.zero,
        activeColor: AppColors.gold,
        value: value,
        title: Text(
          title,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
