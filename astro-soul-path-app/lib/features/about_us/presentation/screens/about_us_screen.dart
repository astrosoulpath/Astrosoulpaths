import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/cosmic_ivory.dart';
import '../../../app_config/data/official_app_links.dart';
import '../../../support/presentation/screens/support_home_screen.dart';
import '../../../app_config/data/app_config_api.dart';
import '../../../app_config/data/app_config_model.dart';

class AboutUsScreen extends StatefulWidget {
  const AboutUsScreen({super.key, this.loadConfig});
  final Future<AppConfigModel> Function()? loadConfig;
  @override
  State<AboutUsScreen> createState() => _AboutUsScreenState();
}

class _AboutUsScreenState extends State<AboutUsScreen> {
  bool _loading = true;
  String? _error;
  AppConfigModel? _config;
  int _request = 0;
  Future<void> _legal(String path) async {
    try {
      final links = (_config?.websiteUrl ?? '').isNotEmpty
          ? _config
          : await const AppConfigApi().getPublicConfig();
      final base = OfficialAppLinks.website(links?.websiteUrl ?? '');
      if (base == null ||
          !await launchUrl(
            base.resolve(path),
            mode: LaunchMode.externalApplication,
          )) {
        throw StateError('Link unavailable');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'This official link is not available. Please contact support.',
            ),
          ),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadAboutUs();
  }

  Future<void> _loadAboutUs() async {
    final request = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final config =
          await (widget.loadConfig ?? const AppConfigApi().getAboutConfig)();
      if (!mounted || request != _request) return;
      setState(() {
        _config = config;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = 'Unable to load About Us right now.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Theme.of(context).scaffoldBackgroundColor,
    appBar: AppBar(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      foregroundColor: Theme.of(context).colorScheme.onSurface,
      title: const Text('About Us'),
    ),
    body: SafeArea(
      child: _loading
          ? Center(
              child: CircularProgressIndicator(
                color: Theme.of(context).colorScheme.onSurface,
              ),
            )
          : _error != null ||
                _config!.aboutTitle.isEmpty ||
                _config!.aboutDescription.isEmpty
          ? RefreshIndicator(
              onRefresh: _loadAboutUs,
              child: const _ApprovedAboutFallback(),
            )
          : RefreshIndicator(
              onRefresh: _loadAboutUs,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.auto_awesome_rounded,
                          color: Color(0xFF8B651F),
                          size: 32,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          _config!.aboutTitle,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Your Guide to a Brighter Tomorrow',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 16),
                        SelectableText(
                          _config!.aboutDescription,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 17,
                            height: 1.7,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_config!.aboutSections != null)
                    for (final entry in const {
                      'mission': 'Our Mission',
                      'vision': 'Our Vision',
                      'services': 'Our Services',
                      'why': 'Why Astro Soul Path',
                      'commitment': 'Our Commitment',
                    }.entries)
                      if ((_config!.aboutSections![entry.key] ?? '').isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: CosmicSection(
                            title: entry.value,
                            child: Text(_config!.aboutSections![entry.key]!),
                          ),
                        ),
                  if (_config!.aboutSections == null) ...[
                    const SizedBox(height: 16),
                    const CosmicSection(
                      title: 'Who We Are',
                      child: Text(
                        'Astro Soul Path brings the timeless wisdom of Vedic astrology closer to everyday life through responsible technology and meaningful human connections.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    const CosmicSection(
                      title: 'Our Mission',
                      child: Text(
                        'Make astrological guidance more accessible, transparent and convenient.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    const CosmicSection(
                      title: 'Our Vision',
                      child: Text(
                        'A trusted global platform where traditional astrological knowledge meets innovative digital experiences.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    const CosmicSection(
                      title: 'Our Services',
                      child: Text(
                        'Explore Kundli insights, horoscope guidance and existing astrologer consultation services. Availability and access depend on the relevant service and entitlement.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    const CosmicSection(
                      title: 'Why Astro Soul Path',
                      child: Text(
                        'A thoughtful, user-friendly space for exploring career questions, relationships, personal growth and spiritual interests. Astrology offers interpretive guidance, not guaranteed outcomes or a substitute for professional medical, legal or financial advice.',
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  CosmicSection(
                    title: 'Contact & Support',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const SupportHomeScreen(),
                            ),
                          ),
                          icon: const Icon(Icons.support_agent_outlined),
                          label: const Text('Contact Support'),
                        ),
                        TextButton(
                          onPressed: () => _legal('/privacy-policy'),
                          child: const Text('Privacy Policy'),
                        ),
                        TextButton(
                          onPressed: () => _legal('/terms'),
                          child: const Text('Terms & Conditions'),
                        ),
                        Text(
                          String.fromEnvironment(
                            'APP_VERSION',
                            defaultValue:
                                'App version: not supplied by this build',
                          ),
                          style: TextStyle(
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    ),
  );
}

/// Owner-supplied brand copy, never fabricated company/legal configuration.
class _ApprovedAboutFallback extends StatelessWidget {
  const _ApprovedAboutFallback();
  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.all(20),
    children: [
      CosmicSection(
        title: 'Astro Soul Path',
        child: Text(
          'Your Guide to a Brighter Tomorrow\n\nWelcome to Astro Soul Path.\n\nAstro Soul Path is a modern astrology and spiritual guidance platform designed to bring the timeless wisdom of Vedic astrology closer to everyday life.\n\nWe believe that traditional knowledge and modern technology can work together to create accessible, meaningful and convenient experiences for individuals seeking astrological guidance.\n\nOur platform brings together personalized Kundli insights, horoscope guidance, astrology-based services and opportunities to connect with astrologers.\n\nWhether you are exploring career questions, relationships, personal growth or spiritual interests, Astro Soul Path aims to provide a thoughtful and user-friendly space for discovery.\n\nOur mission is to make astrological guidance more accessible, transparent and convenient through responsible technology and meaningful human connections.\n\nOur vision is to build a trusted global platform where traditional astrological knowledge meets innovative digital experiences.\n\nAstro Soul Path — Your Guide to a Brighter Tomorrow.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            height: 1.6,
          ),
        ),
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const SupportHomeScreen()),
        ),
        icon: const Icon(Icons.support_agent_outlined),
        label: const Text('Contact Support'),
      ),
    ],
  );
}
