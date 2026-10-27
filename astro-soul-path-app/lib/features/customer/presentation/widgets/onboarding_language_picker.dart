import 'package:flutter/material.dart';

import '../../../../core/localization/app_locale_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../language/data/language_api.dart';

/// Uses the same active catalogue that profile persistence validates.
class OnboardingLanguagePicker extends StatefulWidget {
  const OnboardingLanguagePicker({
    required this.value,
    required this.onChanged,
    required this.onAvailableCodes,
    this.enabled = true,
    this.loadLanguages,
    super.key,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final ValueChanged<Set<String>> onAvailableCodes;
  final bool enabled;
  final Future<List<AppLanguage>> Function()? loadLanguages;

  @override
  State<OnboardingLanguagePicker> createState() => _PickerState();
}

class _PickerState extends State<OnboardingLanguagePicker> {
  final _api = LanguageApi();
  List<AppLanguage>? _languages;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _languages = null;
      _failed = false;
    });
    try {
      final response = await (widget.loadLanguages ?? _api.getLanguages)();
      if (!mounted) return;
      final unique = <String, AppLanguage>{};
      for (final language in response) {
        final code = language.code.trim().toLowerCase();
        if (language.isActive &&
            AppLocaleController.supportedLanguageCodes.contains(code)) {
          unique.putIfAbsent(code, () => language);
        }
      }
      setState(() => _languages = unique.values.toList());
      widget.onAvailableCodes(unique.keys.toSet());
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = true);
      widget.onAvailableCodes({});
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Unable to load available languages.'),
          TextButton(
            onPressed: widget.enabled ? _load : null,
            child: const Text('Retry languages'),
          ),
        ],
      );
    }
    final languages = _languages;
    if (languages == null) return const Text('Loading languages…');
    if (languages.isEmpty) {
      return const Text(
        'No supported language is available. Please retry later.',
      );
    }
    return Wrap(
      spacing: 9,
      runSpacing: 9,
      children: languages.map((language) {
        final code = language.code.trim().toLowerCase();
        final selected = widget.value.trim().toLowerCase() == code;
        return ChoiceChip(
          key: ValueKey('onboarding-language-$code'),
          selected: selected,
          onSelected: widget.enabled ? (_) => widget.onChanged(code) : null,
          selectedColor: AppColors.gold,
          backgroundColor: AppColors.surface,
          side: BorderSide(
            color: selected ? AppColors.goldDark : AppColors.border,
          ),
          label: Text(
            language.englishName,
            style: const TextStyle(
              color: AppColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          tooltip: language.nativeName.isEmpty
              ? language.englishName
              : language.nativeName,
          materialTapTargetSize: MaterialTapTargetSize.padded,
        );
      }).toList(),
    );
  }
}
