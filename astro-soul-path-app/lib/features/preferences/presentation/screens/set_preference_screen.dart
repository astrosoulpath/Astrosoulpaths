import 'package:flutter/material.dart';
import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_theme_controller.dart';
import '../../data/preferences_api.dart';

class SetPreferenceScreen extends StatefulWidget {
  const SetPreferenceScreen({super.key, this.api});
  final PreferencesApi? api;
  @override
  State<SetPreferenceScreen> createState() => _SetPreferenceScreenState();
}

class _SetPreferenceScreenState extends State<SetPreferenceScreen> {
  late final PreferencesApi _api = widget.api ?? PreferencesApi();
  bool _loading = true,
      _saving = false,
      _hideOuterPlanets = false,
      _customCalendar = false;
  String _chartStyle = 'NORTH_INDIAN', _monthType = 'AMANT', _error = '';
  String t(String value) => AppStrings.text(context, en: value);
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final p = await _api.getPreferences();
      await AppThemeController.adoptServerDefault(p.darkMode);
      if (!mounted) return;
      setState(() {
        _chartStyle = p.chartStyle;
        _monthType = p.monthType;
        _hideOuterPlanets = p.hideOuterPlanets;
        _customCalendar = p.customCalendar;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = t('Preferences could not be loaded.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _appearance(ThemeMode mode) async {
    try {
      await AppThemeController.setThemeMode(mode);
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Preferences could not be saved.'))),
        );
      }
    }
  }

  Future<void> _reset() async {
    setState(() {
      _chartStyle = 'NORTH_INDIAN';
      _monthType = 'AMANT';
      _hideOuterPlanets = false;
      _customCalendar = false;
    });
    await _appearance(ThemeMode.light);
  }

  Future<void> _save() async {
    if (_saving || _loading || _error.isNotEmpty) return;
    setState(() => _saving = true);
    try {
      await _api.updatePreferences(
        chartStyle: _chartStyle,
        monthType: _monthType,
        darkMode: AppThemeController.isDarkMode,
        hideOuterPlanets: _hideOuterPlanets,
        customCalendar: _customCalendar,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(t('Preferences saved.'))));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Preferences could not be saved.'))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _section(String title, List<Widget> children) => Card(
    margin: const EdgeInsets.only(bottom: 16),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t(title),
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    ),
  );
  Widget _choice<T>(
    String title,
    String? subtitle,
    T value,
    T selected,
    ValueChanged<T> change,
  ) => RadioGroup<T>(
    groupValue: selected,
    onChanged: (v) {
      if (v != null && !_saving && !_loading) change(v);
    },
    child: RadioListTile<T>(
      value: value,
      title: Text(t(title)),
      subtitle: subtitle == null ? null : Text(t(subtitle)),
      contentPadding: EdgeInsets.zero,
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(t('Set Preference'))),
    body: SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            if (_loading) const LinearProgressIndicator(),
            if (_error.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(_error),
                      TextButton(onPressed: _load, child: Text(t('Try again'))),
                    ],
                  ),
                ),
              ),
            _section('Chart Style', [
              _choice(
                'Diamond Chart',
                'Traditional North Indian Vedic layout',
                'NORTH_INDIAN',
                _chartStyle,
                (v) => setState(() => _chartStyle = v),
              ),
              _choice(
                'Square Chart',
                'Traditional South Indian Vedic layout',
                'SOUTH_INDIAN',
                _chartStyle,
                (v) => setState(() => _chartStyle = v),
              ),
            ]),
            _section('Month Type', [
              _choice(
                'Amanta',
                'Lunar month ends at the new moon.',
                'AMANT',
                _monthType,
                (v) => setState(() => _monthType = v),
              ),
              _choice(
                'Purnimanta',
                'Lunar month ends at the full moon.',
                'PURNIMANT',
                _monthType,
                (v) => setState(() => _monthType = v),
              ),
            ]),
            ValueListenableBuilder<ThemeMode>(
              valueListenable: AppThemeController.themeMode,
              builder: (context, mode, _) => _section('Appearance', [
                _choice('Light', null, ThemeMode.light, mode, _appearance),
                _choice('Dark', null, ThemeMode.dark, mode, _appearance),
                _choice(
                  'System Default',
                  null,
                  ThemeMode.system,
                  mode,
                  _appearance,
                ),
              ]),
            ),
            _section('Chart options', [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(t('Hide Uranus, Neptune and Pluto')),
                value: _hideOuterPlanets,
                onChanged: _loading || _saving
                    ? null
                    : (v) => setState(() => _hideOuterPlanets = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(t('Custom Calendar')),
                subtitle: const Text('1600–2400'),
                value: _customCalendar,
                onChanged: _loading || _saving
                    ? null
                    : (v) => setState(() => _customCalendar = v),
              ),
            ]),
            OutlinedButton(
              onPressed: _loading || _saving ? null : _reset,
              child: Text(t('Reset to Defaults')),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loading || _saving || _error.isNotEmpty
                  ? null
                  : _save,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(t('Save Preferences')),
            ),
          ],
        ),
      ),
    ),
  );
}
