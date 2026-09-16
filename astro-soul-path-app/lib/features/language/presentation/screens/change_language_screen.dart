import 'package:flutter/material.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/localization/app_locale_controller.dart';

import '../../data/language_api.dart';
import '../../../profile/data/profile_api.dart';

class ChangeLanguageScreen extends StatefulWidget {
  const ChangeLanguageScreen({
    required this.profileId,
    this.initialLanguage = 'en',
    super.key,
  });

  final String profileId;
  final String initialLanguage;

  @override
  State<ChangeLanguageScreen> createState() => _ChangeLanguageScreenState();
}

class _ChangeLanguageScreenState extends State<ChangeLanguageScreen> {
  final LanguageApi _languageApi = LanguageApi();
  final ProfileApi _profileApi = ProfileApi();

  bool _loading = true;
  bool _saving = false;

  String _error = '';
  String _selectedCode = '';

  List<AppLanguage> _languages = const [];

  @override
  void initState() {
    super.initState();

    _selectedCode = widget.initialLanguage.trim().isEmpty
        ? 'en'
        : widget.initialLanguage.trim().toLowerCase();

    _loadLanguages();
  }

  Future<void> _loadLanguages() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final languages = await _languageApi.getLanguages();

      if (!mounted) {
        return;
      }

      setState(() {
        _languages = languages;

        if (!_languages.any(
          (language) => language.code.toLowerCase() == _selectedCode,
        )) {
          _selectedCode = _languages.isEmpty
              ? ''
              : _languages.first.code.toLowerCase();
        }

        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _saveLanguage() async {
    final selectedCode = _selectedCode.trim();

    if (_saving || selectedCode.isEmpty) {
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      final translations = await _languageApi.getTranslations(selectedCode);

      await _profileApi.updateProfile(
        profileId: widget.profileId,
        language: selectedCode,
      );

      // Backend profile is now saved successfully.
      // Apply the same language locally only after backend success.
      await AppStrings.installRemoteTranslations(selectedCode, translations);

      await AppLocaleController.setLanguage(selectedCode);

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(selectedCode);
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.toString();
        _saving = false;
      });
    }
  }

  @override
  void dispose() {
    _languageApi.close();
    _profileApi.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF171717),
        centerTitle: true,
        title: Text(
          AppStrings.text(
            context,
            en: 'Change Language',
            hi: '\u092d\u093e\u0937\u093e \u092c\u0926\u0932\u0947\u0902',
          ),
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadLanguages,
                child: _buildContent(),
              ),
            ),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error.isNotEmpty && _languages.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 100),
          const Icon(
            Icons.language_rounded,
            size: 54,
            color: Color(0xFF777777),
          ),
          const SizedBox(height: 18),
          Text(
            _error,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF666666),
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          Center(
            child: FilledButton(
              onPressed: _loadLanguages,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 30),
      children: [
        Text(
          AppStrings.text(
            context,
            en: 'Choose your preferred language',
            hi: '\u0905\u092a\u0928\u0940 \u092a\u0938\u0902\u0926\u0940\u0926\u093e \u092d\u093e\u0937\u093e \u091a\u0941\u0928\u0947\u0902',
          ),
          style: TextStyle(
            color: Color(0xFF202020),
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Select the language you would like to use.',
          style: TextStyle(color: Color(0xFF777777), fontSize: 14),
        ),
        if (_error.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_error, style: const TextStyle(color: Colors.red, fontSize: 13)),
        ],
        const SizedBox(height: 20),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _languages.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.45,
          ),
          itemBuilder: (context, index) {
            final language = _languages[index];

            return _LanguageCard(
              language: language,
              selected: language.code.toLowerCase() == _selectedCode,
              onTap: () {
                setState(() {
                  _selectedCode = language.code.toLowerCase();
                });
              },
            );
          },
        ),
      ],
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            blurRadius: 14,
            offset: Offset(0, -2),
            color: Color(0x14000000),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton(
          onPressed: _saving || _loading || _selectedCode.isEmpty
              ? null
              : _saveLanguage,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFE84613),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: _saving
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : Text(
                  AppStrings.text(
                    context,
                    en: 'Continue',
                    hi: '\u091c\u093e\u0930\u0940 \u0930\u0916\u0947\u0902',
                  ),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
        ),
      ),
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final AppLanguage language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFFFF0EA) : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? const Color(0xFFE84613)
                  : const Color(0xFFE5E5E5),
              width: selected ? 2 : 1,
            ),
          ),
          padding: const EdgeInsets.all(12),
          child: Stack(
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _LanguageImage(language: language),
                  const SizedBox(height: 8),
                  Text(
                    language.englishName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF202020),
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    language.nativeName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF737373),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              if (selected)
                const Positioned(
                  top: 0,
                  right: 0,
                  child: Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFFE84613),
                    size: 21,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageImage extends StatelessWidget {
  const _LanguageImage({required this.language});

  final AppLanguage language;

  @override
  Widget build(BuildContext context) {
    final imageUrl = language.imageUrl?.trim() ?? '';

    if (imageUrl.isNotEmpty) {
      return ClipOval(
        child: Image.network(
          imageUrl,
          width: 42,
          height: 42,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _fallback(),
        ),
      );
    }

    return _fallback();
  }

  Widget _fallback() {
    final letter = language.englishName.trim().isEmpty
        ? '?'
        : language.englishName.trim()[0].toUpperCase();

    return Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFFFFE5DB),
      ),
      child: Text(
        letter,
        style: const TextStyle(
          color: Color(0xFFE84613),
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
