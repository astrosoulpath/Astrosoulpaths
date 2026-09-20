import '../../../marketplace/presentation/screens/marketplace_home_screen.dart';
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/localization/app_locale_controller.dart';
import '../../../../core/localization/app_strings.dart';
import 'customer_profile_screen.dart';
import '../../../profile/data/profile_api.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../language/presentation/screens/change_language_screen.dart';
import '../../../preferences/presentation/screens/set_preference_screen.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../auth/presentation/screens/login_screen.dart';
import '../../../auth/presentation/auth_gate.dart';
import '../../../auth/data/auth_portal.dart';
import '../../../astrologers/data/astrologer_api.dart';
import '../../../astrologers/data/public_astrologer.dart';
import '../../../astrologers/presentation/screens/astrologer_detail_screen.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';
import '../../../horoscope/presentation/screens/daily_horoscope_screen.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import '../../../support/presentation/screens/support_home_screen.dart';
import '../../../kundli/presentation/screens/customer_kundli_screen.dart';
import '../../../ai_astro/data/ai_astro_api.dart';
import '../../../ai_astro/data/ai_astro_models.dart';
import '../../../ai_astro/presentation/screens/ai_astro_detail_screen.dart';
import '../../../ai_astro/presentation/screens/ai_astro_home_screen.dart';
import '../../../category_ai/presentation/screens/category_ai_chat_screen.dart';
import '../../../live/data/live_api.dart';
import '../../../live/data/live_models.dart';
import '../../../live/presentation/screens/customer_live_viewer_screen.dart';
import '../../../notifications/data/notifications_api.dart';
import '../../../notifications/presentation/screens/customer_notifications_screen.dart';
import '../../../wallet/data/wallet_api.dart';
import '../../../wallet/presentation/screens/customer_wallet_screen.dart';

import '../../../share_app/services/share_app_service.dart';

import '../../../rate_app/services/rate_app_service.dart';

import '../../../about_us/presentation/screens/about_us_screen.dart';

import '../../../feedback/presentation/screens/feedback_screen.dart';
// CUSTOMER_FINAL_PREMIUM_PHASE4

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({
    this.astrologyQuestionId,
    this.astrologyQuestionText,
    this.astrologyCategorySlug,
    this.scaffoldKey,
    super.key,
  });

  final String? astrologyQuestionId;
  final String? astrologyQuestionText;
  final String? astrologyCategorySlug;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final GlobalKey _exploreAstrologyKey = GlobalKey();
  final _astrologerApi = AstrologerApi();
  final LiveApi _liveApi = LiveApi();
  final WalletApi _walletApi = WalletApi();
  final NotificationsApi _notificationsApi = NotificationsApi();
  final ProfileApi _drawerProfileApi = ProfileApi();
  final AuthSessionStore _drawerSessionStore = AuthSessionStore();

  StoredAuthSession? _drawerSession;

  Map<String, dynamic> get _backendFreeChatState {
    final session = _drawerSession;
    if (session == null) return const <String, dynamic>{};

    final raw = session.user['freeChat'];

    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);

    return const <String, dynamic>{};
  }

  int get _backendFreeChatMinutes {
    final value = int.tryParse(
      _backendFreeChatState['minutes']?.toString() ?? '',
    );
    return value != null && value > 0 ? value : 0;
  }

  bool get _canShowFirstFreeChat {
    final session = _drawerSession;

    if (session == null ||
        session.role != 'CUSTOMER' ||
        session.portal != 'customer') {
      return false;
    }

    final freeChat = _backendFreeChatState;

    return freeChat['eligible'] == true &&
        freeChat['used'] != true &&
        _backendFreeChatMinutes > 0;
  }

  CustomerProfile? _drawerProfile;
  bool _drawerProfileLoading = false;

  String _walletBalanceLabel = '\u20B90';
  Timer? _walletHeaderRefreshTimer;
  int _notificationUnreadCount = 0;

  List<LiveSession> _liveSessions = const <LiveSession>[];
  bool _liveLoading = false;
  final _searchController = TextEditingController();
  final _featureScrollController = ScrollController();
  final _callChatScrollController = ScrollController();

  bool _featureHasScrolled = false;
  bool _featureCanScrollRight = true;
  bool _callChatHasScrolled = false;

  List<PublicAstrologer> _astrologers = const [];
  bool _isLoading = true;
  String _error = '';
  String _search = '';

  Timer? _searchHintTimer;
  Timer? _liveRefreshTimer;
  int _searchHintIndex = 0;

  @override
  void initState() {
    super.initState();
    // Keep the home wallet header synchronized with the authoritative backend
    // while consultations/recharges update the wallet.
    _walletHeaderRefreshTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) {
        unawaited(_loadWalletHeader());
      }
    });

    _featureScrollController.addListener(_syncCarouselArrowState);
    _callChatScrollController.addListener(_syncCarouselArrowState);

    _loadAstrologers();

    _loadLiveSessions();

    _liveRefreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        _loadLiveSessions();
      }
    });

    debugPrint('CUSTOMER_LIVE_AUTO_REFRESH_STARTED');

    _loadHomeHeaderData();

    _loadDrawerProfileData();

    _startSearchHintRotation();
  }

  @override
  void dispose() {
    _liveRefreshTimer?.cancel();
    _searchHintTimer?.cancel();
    _searchController.dispose();

    _featureScrollController.removeListener(_syncCarouselArrowState);
    _callChatScrollController.removeListener(_syncCarouselArrowState);

    _featureScrollController.dispose();
    _callChatScrollController.dispose();

    _astrologerApi.close();

    _liveApi.close();
    _walletHeaderRefreshTimer?.cancel();
    _walletHeaderRefreshTimer = null;
    _walletApi.close();
    _notificationsApi.close();
    _drawerProfileApi.close();
    super.dispose();
  }

  Future<void> _loadDrawerProfileData() async {
    if (_drawerProfileLoading) {
      return;
    }

    _drawerProfileLoading = true;

    try {
      final results = await Future.wait<dynamic>([
        _drawerSessionStore.read(),
        _drawerProfileApi.getProfiles(),
      ]);

      if (!mounted) {
        return;
      }

      final session = results[0] as StoredAuthSession?;
      final profiles = results[1] as List<CustomerProfile>;

      setState(() {
        _drawerSession = session;
        _drawerProfile = profiles.isEmpty ? null : profiles.first;
      });
    } catch (_) {
      // Drawer profile failure must never block Home.
    } finally {
      _drawerProfileLoading = false;
    }
  }

  void _closeDrawerThenPush(Widget screen) {
    Navigator.of(context).pop();

    Future<void>.delayed(Duration.zero, () {
      if (!mounted) {
        return;
      }

      Navigator.of(
        context,
      ).push(MaterialPageRoute<void>(builder: (_) => screen));
    });
  }

  void _openDrawerKundli() {
    _closeDrawerThenPush(const CustomerKundliScreen());
  }

  void _openDrawerHoroscope() {
    _closeDrawerThenPush(const DailyHoroscopeScreen());
  }

  void _openDrawerSetPreference() {
    _closeDrawerThenPush(const SetPreferenceScreen());
  }

  void _openDrawerSubscription() {
    _closeDrawerThenPush(
      const SubscriptionPlansScreen(audience: SubscriptionAudience.customer),
    );
  }

  void _openDrawerJoinAstrologer() {
    _closeDrawerThenPush(const LoginScreen(portal: AuthPortal.joinAstrologer));
  }

  Future<void> _rateAppFromDrawer() async {
    Navigator.of(context).pop();

    try {
      final result = await const RateAppService().openStoreListing();

      if (!mounted) return;

      if (result == RateAppResult.storeNotConfigured) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Rate App will be available once the official store listing is live.',
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Unable to open the app store right now. Please try again.',
          ),
        ),
      );
    }
  }

  Future<void> _shareAppFromDrawer() async {
    final shareContext = context;

    Navigator.of(shareContext).pop();

    try {
      await const ShareAppService().shareApp(shareContext);
    } catch (_) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to share the app right now. Please try again.'),
        ),
      );
    }
  }

  void _openFeedback() {
    Navigator.of(context).pop();

    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const FeedbackScreen()));
  }

  void _openAboutUs() {
    Navigator.of(context).pop();

    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const AboutUsScreen()));
  }

  Future<void> _logoutFromDrawer() async {
    Navigator.of(context).pop();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceLight,
          title: const Text(
            'Logout?',
            style: TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          content: const Text(
            'Are you sure you want to logout from Astro Soul Path?',
            style: TextStyle(color: AppColors.muted),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop(false);
              },
              child: const Text(
                'Cancel',
                style: TextStyle(color: AppColors.muted),
              ),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop(true);
              },
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    await _drawerSessionStore.clear();

    if (!mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const AuthGate()),
      (route) => false,
    );
  }

  void _openDrawerProfile() {
    _closeDrawerThenPush(const CustomerProfileScreen());
  }

  Future<void> _openDrawerChangeLanguage() async {
    final profile = _drawerProfile;

    if (profile == null || profile.id.trim().isEmpty) {
      Navigator.of(context).pop();
      await _loadDrawerProfileData();
      return;
    }

    Navigator.of(context).pop();

    final selectedLanguage = await Navigator.of(context).push<String>(
      MaterialPageRoute<String>(
        builder: (_) => ChangeLanguageScreen(
          profileId: profile.id,
          initialLanguage: profile.language?.trim().isNotEmpty == true
              ? profile.language!
              : 'en',
        ),
      ),
    );

    if (!mounted || selectedLanguage == null) {
      return;
    }

    await AppLocaleController.setLanguage(selectedLanguage);

    if (!mounted) {
      return;
    }

    await _loadDrawerProfileData();
  }

  Future<void> _loadHomeHeaderData() async {
    await Future.wait([_loadWalletHeader(), _loadNotificationCount()]);
  }

  Future<void> _loadWalletHeader() async {
    try {
      final wallet = await _walletApi.getWallet();

      if (!mounted) {
        return;
      }

      final balance = wallet.availableBalance;

      setState(() {
        _walletBalanceLabel = balance == balance.roundToDouble()
            ? '\u20B9${balance.toInt()}'
            : '\u20B9${balance.toStringAsFixed(2)}';
      });
    } catch (_) {
      // Header should never block the home screen.
    }
  }

  Future<void> _loadNotificationCount() async {
    try {
      final count = await _notificationsApi.getUnreadCount();

      if (!mounted) {
        return;
      }

      setState(() {
        _notificationUnreadCount = count;
      });
    } catch (_) {
      // Notification count failure should not block home.
    }
  }

  Future<void> _openWallet() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const CustomerWalletScreen()),
    );

    if (mounted) {
      await _loadWalletHeader();
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const CustomerNotificationsScreen(),
      ),
    );

    if (mounted) {
      await _loadNotificationCount();
    }
  }

  List<String> get _smartSearchHints {
    if (_astrologers.isEmpty) {
      return const [
        'Search trusted astrologers',
        'Explore astrology expertise',
        'Find astrologers by language',
      ];
    }
    final expertise = _astrologers
        .map((astrologer) => astrologer.primaryExpertise.trim())
        .where((value) => value.isNotEmpty)
        .firstOrNull;

    final language = _astrologers
        .map((astrologer) => astrologer.languageLabel.trim())
        .where((value) => value.isNotEmpty)
        .firstOrNull;

    return [
      'Ask about love, career or marriage',
      expertise == null
          ? 'Explore trusted Vedic experts'
          : 'Explore $expertise experts',
      language == null
          ? 'Find astrologers by language'
          : 'Find astrologers in $language',
    ];
  }

  String get _currentSearchHint {
    final hints = _smartSearchHints;

    if (hints.isEmpty) {
      return 'Search astrologer, expertise or language';
    }

    return hints[_searchHintIndex % hints.length];
  }

  void _startSearchHintRotation() {
    _searchHintTimer?.cancel();

    _searchHintTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) {
      if (!mounted || _search.isNotEmpty) {
        return;
      }

      setState(() {
        _searchHintIndex = (_searchHintIndex + 1) % _smartSearchHints.length;
      });
    });
  }

  List<PublicAstrologer> get _visibleAstrologers {
    final query = _search.trim().toLowerCase();

    if (query.isEmpty) {
      return _astrologers;
    }

    return _astrologers
        .where((astrologer) {
          final searchableText = [
            astrologer.name,
            astrologer.primaryExpertise,
            astrologer.languageLabel,
          ].join(' ').toLowerCase();

          return searchableText.contains(query);
        })
        .toList(growable: false);
  }

  List<PublicAstrologer> _expertSection(
    List<PublicAstrologer> source, {
    String? expertiseKeyword,
    int limit = 8,
  }) {
    Iterable<PublicAstrologer> result = source;

    if (expertiseKeyword != null && expertiseKeyword.trim().isNotEmpty) {
      final keyword = expertiseKeyword.trim().toLowerCase();

      result = result.where(
        (astrologer) =>
            astrologer.primaryExpertise.toLowerCase().contains(keyword),
      );
    }

    final sorted = result.toList(growable: false)
      ..sort((first, second) {
        if (first.isOnline != second.isOnline) {
          return first.isOnline ? -1 : 1;
        }

        return second.rating.compareTo(first.rating);
      });

    return sorted.take(limit).toList(growable: false);
  }

  List<PublicAstrologer> get _recommendedAstrologers {
    return _expertSection(_visibleAstrologers, limit: 8);
  }

  List<PublicAstrologer> get _vedicAstrologers {
    return _expertSection(
      _visibleAstrologers,
      expertiseKeyword: 'vedic',
      limit: 8,
    );
  }

  List<PublicAstrologer> get _tarotAstrologers {
    return _expertSection(
      _visibleAstrologers,
      expertiseKeyword: 'tarot',
      limit: 8,
    );
  }

  List<PublicAstrologer> get _trendingAstrologers {
    final result = [..._visibleAstrologers]
      ..sort((first, second) {
        final ratingResult = second.rating.compareTo(first.rating);

        if (ratingResult != 0) {
          return ratingResult;
        }

        if (first.isOnline != second.isOnline) {
          return first.isOnline ? -1 : 1;
        }

        return 0;
      });

    return result.take(8).toList(growable: false);
  }

  Future<void> _loadAstrologers() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final result = await _astrologerApi.getPublicAstrologers();

      final sorted = [...result.astrologers]
        ..sort((first, second) {
          if (first.isOnline != second.isOnline) {
            return first.isOnline ? -1 : 1;
          }

          return second.rating.compareTo(first.rating);
        });

      if (!mounted) {
        return;
      }

      setState(() {
        _astrologers = List.unmodifiable(sorted);
      });
    } on AstrologerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _astrologers = const [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _syncCarouselArrowState() {
    if (!mounted) {
      return;
    }

    final featureHasScrolled =
        _featureScrollController.hasClients &&
        _featureScrollController.offset > 2;

    final featureCanScrollRight =
        !_featureScrollController.hasClients ||
        _featureScrollController.offset <
            _featureScrollController.position.maxScrollExtent - 2;

    final callChatHasScrolled =
        _callChatScrollController.hasClients &&
        _callChatScrollController.offset > 2;

    if (featureHasScrolled != _featureHasScrolled ||
        featureCanScrollRight != _featureCanScrollRight ||
        callChatHasScrolled != _callChatHasScrolled) {
      setState(() {
        _featureHasScrolled = featureHasScrolled;
        _featureCanScrollRight = featureCanScrollRight;
        _callChatHasScrolled = callChatHasScrolled;
      });
    }
  }

  Future<void> _loadLiveSessions() async {
    if (_liveLoading) {
      return;
    }

    _liveLoading = true;

    try {
      final sessions = await _liveApi.getLiveSessions();

      if (!mounted) {
        return;
      }

      setState(() {
        _liveSessions = List<LiveSession>.unmodifiable(sessions);

        debugPrint('CUSTOMER_LIVE_SESSIONS_LOADED count=${sessions.length}');
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _liveSessions = const <LiveSession>[];
      });
    } finally {
      _liveLoading = false;
    }
  }

  Widget _expertSectionWidget({
    required String title,
    required List<PublicAstrologer> astrologers,
    required void Function(PublicAstrologer) onTap,
    required VoidCallback onViewAll,
  }) {
    if (astrologers.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Semantics(
                button: true,
                label: 'View all $title',
                child: InkWell(
                  onTap: onViewAll,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x151F365F),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFFFD84A)),
                    ),
                    child: const Text(
                      'VIEW ALL',
                      style: TextStyle(
                        color: AppColors.gold,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 218,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 2, 16, 12),
            itemCount: astrologers.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final astrologer = astrologers[index];

              return SizedBox(
                width: 158,
                child: Semantics(
                  button: true,
                  label: 'View ${astrologer.name} profile',
                  child: GestureDetector(
                    onTap: () => onTap(astrologer),
                    child: _CompactAstrologerCard(astrologer: astrologer),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final visibleAstrologers = _visibleAstrologers;
    final onlineCount = _astrologers
        .where((astrologer) => astrologer.isOnline)
        .length;

    void openAstrologer(PublicAstrologer astrologer) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => AstrologerDetailScreen(astrologerId: astrologer.id),
        ),
      );
    }

    void openAllAstrologers({
      required String title,
      String? expertiseKeyword,
      bool trendingOnly = false,
    }) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => AstrologerSelectionScreen(
            screenTitle: title,
            expertiseKeyword: expertiseKeyword,
            trendingOnly: trendingOnly,
          ),
        ),
      );
    }

    return Scaffold(
      key: widget.scaffoldKey,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        leading: Builder(
          builder: (context) {
            return IconButton(
              tooltip: 'Menu',
              onPressed: () {
                Scaffold.of(context).openDrawer();
              },
              icon: const Icon(
                Icons.menu_rounded,
                color: AppColors.gold,
                size: 28,
              ),
            );
          },
        ),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
        titleSpacing: 18,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Astro Soul Path',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(height: 1),
            Text(
              AppStrings.text(
                context,
                en: 'Trusted Vedic guidance',
                hi: '\u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0935\u0948\u0926\u093f\u0915 \u092e\u093e\u0930\u094d\u0917\u0926\u0930\u094d\u0936\u0928',
              ),
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Material(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(13),
              child: InkWell(
                onTap: _openWallet,
                borderRadius: BorderRadius.circular(13),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.account_balance_wallet_rounded,
                        color: AppColors.gold,
                        size: 19,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _walletBalanceLabel,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                onPressed: _openNotifications,
                tooltip: 'Notifications',
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: AppColors.gold,
                  size: 25,
                ),
              ),
              if (_notificationUnreadCount > 0)
                Positioned(
                  right: 3,
                  top: 3,
                  child: Container(
                    constraints: const BoxConstraints(
                      minWidth: 17,
                      minHeight: 17,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD64545),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.background,
                        width: 1.5,
                      ),
                    ),
                    child: Text(
                      _notificationUnreadCount > 99
                          ? '99+'
                          : '$_notificationUnreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 3),
        ],
      ),
      onDrawerChanged: (isOpened) {
        if (isOpened) {
          _loadDrawerProfileData();
        }
      },
      drawer: Drawer(
        width: MediaQuery.sizeOf(context).width * 0.84,
        backgroundColor: const Color(0xFF08070D),
        child: SafeArea(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.surfaceLight, AppColors.background],
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.gold, width: 2),
                      ),
                      child: ClipOval(
                        child:
                            _drawerProfile?.avatarUrl?.trim().isNotEmpty == true
                            ? Image.network(
                                _drawerProfile!.avatarUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) {
                                  return const _DrawerAvatarFallback();
                                },
                              )
                            : const _DrawerAvatarFallback(),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _drawerProfile?.fullName?.trim().isNotEmpty == true
                                ? _drawerProfile!.fullName!
                                : _drawerProfile?.name.trim().isNotEmpty == true
                                ? _drawerProfile!.name
                                : 'Customer',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            _drawerSession?.user['phone']
                                        ?.toString()
                                        .trim()
                                        .isNotEmpty ==
                                    true
                                ? _drawerSession!.user['phone'].toString()
                                : 'Phone unavailable',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 5),
                          const Text(
                            'Astro Soul Path',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      tooltip: 'Close menu',
                      onPressed: () => Navigator.of(context).pop(),
                      style: IconButton.styleFrom(
                        foregroundColor: AppColors.white,
                        backgroundColor: const Color(0x1AFFFFFF),
                        minimumSize: const Size(40, 40),
                        padding: EdgeInsets.zero,
                        shape: const CircleBorder(),
                      ),
                      icon: Icon(Icons.close_rounded, size: 22),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: [
                    _DrawerMenuTile(
                      icon: Icons.home_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Home',
                        hi: '\u0939\u094b\u092e',
                      ),
                      onTap: () => Navigator.of(context).pop(),
                    ),
                    _DrawerMenuTile(
                      icon: Icons.auto_awesome_rounded,
                      title: 'New Chart / Kundli',
                      onTap: _openDrawerKundli,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.wb_sunny_outlined,
                      title: AppStrings.text(context, en: 'Horoscope'),
                      onTap: _openDrawerHoroscope,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.tune_rounded,
                      title: AppStrings.text(context, en: 'Set Preference'),
                      onTap: _openDrawerSetPreference,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.workspace_premium_rounded,
                      title: 'Upgrade / Manage Plan',
                      onTap: _openDrawerSubscription,
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                      child: Material(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(18),
                          onTap: () {
                            Navigator.of(context).pop();

                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => const SupportHomeScreen(),
                              ),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  AppColors.surfaceLight,
                                  AppColors.surfaceLight,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: AppColors.gold.withValues(alpha: 0.42),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.16),
                                  blurRadius: 14,
                                  offset: const Offset(0, 5),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    color: AppColors.gold.withValues(
                                      alpha: 0.14,
                                    ),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: AppColors.gold.withValues(
                                        alpha: 0.55,
                                      ),
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.headset_mic_rounded,
                                    color: AppColors.gold,
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            '24\u00D77 Support',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                          SizedBox(width: 7),
                                          DecoratedBox(
                                            decoration: BoxDecoration(
                                              color: Color(0x3327C38A),
                                              borderRadius: BorderRadius.all(
                                                Radius.circular(20),
                                              ),
                                            ),
                                            child: Padding(
                                              padding: EdgeInsets.symmetric(
                                                horizontal: 7,
                                                vertical: 3,
                                              ),
                                              child: Text(
                                                'ONLINE',
                                                style: TextStyle(
                                                  color: Color(0xFFFFC857),
                                                  fontSize: 8,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      SizedBox(height: 5),
                                      Text(
                                        'AI Assistant & Human Support',
                                        style: TextStyle(
                                          color: Color(0xFF9FB1CA),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Icon(
                                  Icons.chevron_right_rounded,
                                  color: AppColors.gold,
                                  size: 26,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    Divider(color: Color(0x224D6682), height: 20),
                    _DrawerMenuTile(
                      icon: Icons.person_outline_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'My Account',
                        hi: '\u092e\u0947\u0930\u093e \u0916\u093e\u0924\u093e',
                      ),
                      onTap: _openDrawerProfile,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.language_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Change Language',
                        hi: '\u092d\u093e\u0937\u093e \u092c\u0926\u0932\u0947\u0902',
                      ),
                      onTap: _openDrawerChangeLanguage,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.person_add_alt_1_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Join as Astrologer',
                        hi: '\u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940 \u0915\u0947 \u0930\u0942\u092a \u092e\u0947\u0902 \u091c\u0941\u0921\u093c\u0947\u0902',
                      ),
                      onTap: _openDrawerJoinAstrologer,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.refresh_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Refresh Profile',
                        hi: '\u092a\u094d\u0930\u094b\u092b\u093c\u093e\u0907\u0932 \u0930\u0940\u092b\u094d\u0930\u0947\u0936 \u0915\u0930\u0947\u0902',
                      ),
                      onTap: () async {
                        Navigator.of(context).pop();
                        await _loadDrawerProfileData();
                      },
                    ),
                    Divider(color: Color(0x224D6682), height: 20),
                    _DrawerMenuTile(
                      icon: Icons.share_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Share App',
                        hi: '\u0910\u092a \u0938\u093e\u091d\u093e \u0915\u0930\u0947\u0902',
                      ),
                      onTap: _shareAppFromDrawer,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.star_rate_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Rate App',
                        hi: '\u0910\u092a \u0915\u094b \u0930\u0947\u091f \u0915\u0930\u0947\u0902',
                      ),
                      onTap: _rateAppFromDrawer,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.info_outline_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'About Us',
                        hi: '\u0939\u092e\u093e\u0930\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902',
                      ),
                      onTap: _openAboutUs,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.rate_review_outlined,
                      title: AppStrings.text(
                        context,
                        en: 'Feedback',
                        hi: '\u092a\u094d\u0930\u0924\u093f\u0915\u094d\u0930\u093f\u092f\u093e',
                      ),
                      onTap: _openFeedback,
                    ),
                    _DrawerMenuTile(
                      icon: Icons.logout_rounded,
                      title: AppStrings.text(
                        context,
                        en: 'Logout',
                        hi: '\u0932\u0949\u0917\u0906\u0909\u091f',
                      ),
                      onTap: _logoutFromDrawer,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 18),
                child: Text(
                  AppStrings.text(
                    context,
                    en: 'Trusted Vedic guidance',
                    hi: '\u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0935\u0948\u0926\u093f\u0915 \u092e\u093e\u0930\u094d\u0917\u0926\u0930\u094d\u0936\u0928',
                  ),
                  style: TextStyle(
                    color: AppColors.muted.withValues(alpha: 0.75),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([_loadAstrologers(), _loadLiveSessions()]);
        },
        color: AppColors.gold,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ==================================================
            // SOUL BAZAAR / MARKETPLACE ENTRY
            // UI only. Product content will come from backend.
            // ==================================================
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(22),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const MarketplaceHomeScreen(),
                        ),
                      );
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF29230F), Color(0xFF17140C)],
                        ),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: const Color(0x66F2C94C)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              color: const Color(0x1FF2C94C),
                              borderRadius: BorderRadius.circular(17),
                              border: Border.all(
                                color: const Color(0x55F2C94C),
                              ),
                            ),
                            child: const Icon(
                              Icons.shopping_bag_outlined,
                              color: Color(0xFFF2C94C),
                              size: 27,
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        'Soul Bazaar',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 17,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                    SizedBox(width: 7),
                                    DecoratedBox(
                                      decoration: BoxDecoration(
                                        color: Color(0x1FF2C94C),
                                        borderRadius: BorderRadius.all(
                                          Radius.circular(20),
                                        ),
                                      ),
                                      child: Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 7,
                                          vertical: 3,
                                        ),
                                        child: Text(
                                          'NEW',
                                          style: TextStyle(
                                            color: Color(0xFFF2C94C),
                                            fontSize: 9,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                SizedBox(height: 5),
                                Text(
                                  'Explore spiritual products from verified sellers',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Color(0xFFB7B1A4),
                                    fontSize: 12,
                                    height: 1.35,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            width: 34,
                            height: 34,
                            decoration: const BoxDecoration(
                              color: Color(0x16F2C94C),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.arrow_forward_ios_rounded,
                              color: Color(0xFFF2C94C),
                              size: 15,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.background,
                      AppColors.surfaceLight,
                      AppColors.surfaceLight,
                    ],
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(28),
                    bottomRight: Radius.circular(28),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: // CUSTOMER_PREMIUM_PHASE2
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // CUSTOMER_PREMIUM_HERO_PHASE1
                              Container(
                                // CUSTOMER_PREMIUM_STICKER_PHASE1
                                width: double.infinity,
                                constraints: const BoxConstraints(
                                  minHeight: 218,
                                ),
                                padding: const EdgeInsets.fromLTRB(
                                  20,
                                  20,
                                  18,
                                  19,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(28),
                                  gradient: const LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Color(0xFF3B2100),
                                      Color(0xFF17122F),
                                      Color(0xFF080A14),
                                      Color(0xFF1C0B2F),
                                      Color(0xFF3B2500),
                                    ],
                                    stops: [0.0, 0.25, 0.52, 0.78, 1.0],
                                  ),
                                  border: Border.all(
                                    color: Color(0xFFFFD33D),
                                    width: 1.55,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.gold.withValues(
                                        alpha: 0.34,
                                      ),
                                      blurRadius: 30,
                                      spreadRadius: 1.0,
                                      offset: const Offset(0, 9),
                                    ),
                                    BoxShadow(
                                      color: const Color(
                                        0xFF702CFF,
                                      ).withValues(alpha: 0.18),
                                      blurRadius: 32,
                                      spreadRadius: 1.0,
                                      offset: const Offset(0, 4),
                                    ),
                                    const BoxShadow(
                                      color: Color(0xB0000000),
                                      blurRadius: 22,
                                      offset: Offset(0, 13),
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    // ---------------------------------------
                                    // PURPLE NEBULA GLOW
                                    // ---------------------------------------
                                    Positioned(
                                      right: -25,
                                      bottom: -34,
                                      child: Container(
                                        width: 190,
                                        height: 190,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          gradient: RadialGradient(
                                            colors: [
                                              const Color(
                                                0xFF803CFF,
                                              ).withValues(alpha: 0.28),
                                              const Color(
                                                0xFF481B89,
                                              ).withValues(alpha: 0.12),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),

                                    // ---------------------------------------
                                    // GOLD NEBULA GLOW
                                    // ---------------------------------------
                                    Positioned(
                                      left: -55,
                                      top: -58,
                                      child: Container(
                                        width: 170,
                                        height: 170,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          gradient: RadialGradient(
                                            colors: [
                                              AppColors.gold.withValues(
                                                alpha: 0.30,
                                              ),
                                              AppColors.gold.withValues(
                                                alpha: 0.08,
                                              ),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),

                                    // ---------------------------------------
                                    // LARGE ORBIT
                                    // ---------------------------------------
                                    Positioned(
                                      right: -18,
                                      top: -15,
                                      child: Container(
                                        width: 180,
                                        height: 180,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: AppColors.gold.withValues(
                                              alpha: 0.36,
                                            ),
                                            width: 1.3,
                                          ),
                                        ),
                                      ),
                                    ),

                                    Positioned(
                                      right: 5,
                                      top: 8,
                                      child: Container(
                                        width: 134,
                                        height: 134,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: const Color(
                                              0xFFC897FF,
                                            ).withValues(alpha: 0.30),
                                            width: 1.2,
                                          ),
                                        ),
                                      ),
                                    ),

                                    Positioned(
                                      right: 35,
                                      top: 38,
                                      child: Container(
                                        width: 75,
                                        height: 75,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: AppColors.gold.withValues(
                                              alpha: 0.48,
                                            ),
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: AppColors.gold.withValues(
                                                alpha: 0.10,
                                              ),
                                              blurRadius: 12,
                                            ),
                                          ],
                                        ),
                                        alignment: Alignment.center,
                                        child: Icon(
                                          Icons.wb_sunny_rounded,
                                          color: AppColors.gold.withValues(
                                            alpha: 0.70,
                                          ),
                                          size: 37,
                                        ),
                                      ),
                                    ),

                                    // ---------------------------------------
                                    // MOON
                                    // ---------------------------------------
                                    Positioned(
                                      right: 24,
                                      top: 5,
                                      child: Icon(
                                        Icons.nightlight_round,
                                        color: const Color(0xFFFFE061),
                                        size: 38,
                                        shadows: [
                                          Shadow(
                                            color: AppColors.gold,
                                            blurRadius: 13,
                                          ),
                                        ],
                                      ),
                                    ),

                                    // ---------------------------------------
                                    // STARS
                                    // ---------------------------------------
                                    Positioned(
                                      right: 128,
                                      top: 15,
                                      child: const Icon(
                                        Icons.auto_awesome_rounded,
                                        color: Color(0xFFFFE88B),
                                        size: 18,
                                      ),
                                    ),

                                    Positioned(
                                      right: 10,
                                      bottom: 15,
                                      child: const Icon(
                                        Icons.auto_awesome_rounded,
                                        color: Color(0xFFFFD133),
                                        size: 22,
                                      ),
                                    ),

                                    Positioned(
                                      right: 75,
                                      bottom: 16,
                                      child: Icon(
                                        Icons.star_rounded,
                                        color: AppColors.gold.withValues(
                                          alpha: 0.70,
                                        ),
                                        size: 13,
                                      ),
                                    ),

                                    // ---------------------------------------
                                    // LEFT CONTENT
                                    // ---------------------------------------
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 11,
                                            vertical: 7,
                                          ),
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                AppColors.gold.withValues(
                                                  alpha: 0.26,
                                                ),
                                                const Color(
                                                  0xFF6D4500,
                                                ).withValues(alpha: 0.50),
                                                const Color(0xFF231800),
                                              ],
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              22,
                                            ),
                                            border: Border.all(
                                              color: AppColors.gold.withValues(
                                                alpha: 0.78,
                                              ),
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: AppColors.gold
                                                    .withValues(alpha: 0.18),
                                                blurRadius: 10,
                                              ),
                                            ],
                                          ),
                                          child: const Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(
                                                Icons.auto_awesome_rounded,
                                                color: AppColors.gold,
                                                size: 14,
                                              ),
                                              SizedBox(width: 7),
                                              Text(
                                                'YOUR COSMIC GUIDANCE',
                                                style: TextStyle(
                                                  color: Color(0xFFFFDF55),
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.w900,
                                                  letterSpacing: 0.9,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),

                                        const SizedBox(height: 17),

                                        const Text(
                                          'Find Clarity',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 29,
                                            height: 0.98,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: -0.75,
                                            shadows: [
                                              Shadow(
                                                color: Color(0x66000000),
                                                blurRadius: 8,
                                              ),
                                            ],
                                          ),
                                        ),

                                        const SizedBox(height: 7),

                                        const Text(
                                          'Live a Better Tomorrow',
                                          style: TextStyle(
                                            color: Color(0xFFFFDD55),
                                            fontSize: 18,
                                            height: 1.05,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: -0.2,
                                          ),
                                        ),

                                        const SizedBox(height: 10),

                                        SizedBox(
                                          width: 225,
                                          child: Text(
                                            'Explore astrology, trusted guidance and personalized insights in one place.',
                                            style: TextStyle(
                                              color: Colors.white.withValues(
                                                alpha: 0.82,
                                              ),
                                              fontSize: 11.2,
                                              height: 1.42,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),

                                        const SizedBox(height: 17),

                                        Material(
                                          color: Colors.transparent,
                                          borderRadius: BorderRadius.circular(
                                            22,
                                          ),
                                          child: InkWell(
                                            borderRadius: BorderRadius.circular(
                                              22,
                                            ),
                                            onTap: () {
                                              Scrollable.ensureVisible(
                                                _exploreAstrologyKey
                                                    .currentContext!,
                                                duration: const Duration(
                                                  milliseconds: 550,
                                                ),
                                                curve: Curves.easeInOutCubic,
                                                alignment: 0.08,
                                              );
                                            },
                                            child: Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 17,
                                                    vertical: 11,
                                                  ),
                                              decoration: BoxDecoration(
                                                gradient: const LinearGradient(
                                                  begin: Alignment.topLeft,
                                                  end: Alignment.bottomRight,
                                                  colors: [
                                                    Color(0xFFFFEB82),
                                                    Color(0xFFFFD232),
                                                    Color(0xFFFFB300),
                                                  ],
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(22),
                                                border: Border.all(
                                                  color: const Color(
                                                    0xFFFFF0AA,
                                                  ),
                                                  width: 0.8,
                                                ),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: AppColors.gold
                                                        .withValues(
                                                          alpha: 0.48,
                                                        ),
                                                    blurRadius: 18,
                                                    spreadRadius: 0.5,
                                                    offset: const Offset(0, 6),
                                                  ),
                                                ],
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Text(
                                                    'Explore Your Path',
                                                    style: TextStyle(
                                                      color: Color(0xFF171000),
                                                      fontSize: 11.5,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                    ),
                                                  ),
                                                  SizedBox(width: 9),
                                                  Icon(
                                                    Icons.arrow_forward_rounded,
                                                    color: Color(0xFF171000),
                                                    size: 17,
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

                              const SizedBox(height: 20),

                              Row(
                                children: [
                                  Container(
                                    width: 39,
                                    height: 39,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: LinearGradient(
                                        colors: [
                                          AppColors.gold.withValues(
                                            alpha: 0.36,
                                          ),
                                          const Color(0xFF3A2A00),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: AppColors.gold.withValues(
                                          alpha: 0.76,
                                        ),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.gold.withValues(
                                            alpha: 0.18,
                                          ),
                                          blurRadius: 10,
                                        ),
                                      ],
                                    ),
                                    alignment: Alignment.center,
                                    child: const Icon(
                                      Icons.explore_rounded,
                                      color: AppColors.gold,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Text(
                                      'Explore astrology',
                                      style: TextStyle(
                                        color: AppColors.white,
                                        fontSize: 25,
                                        height: 1,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: -0.45,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const RadialGradient(
                                  colors: [
                                    Color(0xFF3B3214),
                                    Color(0xFF19170F),
                                  ],
                                  stops: [0.0, 1.0],
                                ),
                                border: Border.all(
                                  color: const Color(0xFFFFD84D),
                                  width: 1.15,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(
                                      0xFFFFD84D,
                                    ).withValues(alpha: 0.20),
                                    blurRadius: 14,
                                    spreadRadius: 1,
                                  ),
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.32),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Text(
                                '$onlineCount',
                                style: const TextStyle(
                                  color: Color(0xFFFFE77A),
                                  fontSize: 19,
                                  height: 1,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.25,
                                ),
                              ),
                            ),

                            // Live status indicator
                            Positioned(
                              right: 1,
                              top: 1,
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFF48E59B),
                                  border: Border.all(
                                    color: const Color(0xFF171710),
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(
                                        0xFF48E59B,
                                      ).withValues(alpha: 0.55),
                                      blurRadius: 6,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    Row(
                      key: _exploreAstrologyKey,
                      children: [
                        Expanded(
                          child: _HomeAstrologyAction(
                            icon: Icons.auto_awesome_rounded,
                            label: 'Kundli AI',
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const CustomerKundliScreen(),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _HomeAstrologyAction(
                            icon: Icons.wb_sunny_rounded,
                            label: AppStrings.text(context, en: 'Horoscope'),
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const DailyHoroscopeScreen(),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _HomeAstrologyAction(
                            icon: Icons.auto_fix_high_rounded,
                            label: 'AI Astro',
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const AiAstroHomeScreen(),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    TextField(
                      controller: _searchController,
                      onChanged: (value) {
                        setState(() {
                          _search = value;
                        });
                      },
                      textInputAction: TextInputAction.search,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        hintText: _currentSearchHint,
                        hintStyle: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                        prefixIcon: const Icon(
                          Icons.search_rounded,
                          color: AppColors.gold,
                          size: 21,
                        ),
                        suffixIcon: _search.isEmpty
                            ? null
                            : IconButton(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _search = '';
                                  });
                                },
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: AppColors.muted,
                                ),
                              ),
                        filled: true,
                        fillColor: AppColors.surfaceLight,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 13,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: Color(0x665D79B5),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: Color(0x665D79B5),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: AppColors.gold,
                            width: 1.3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // =================================================
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 5),
                child: SizedBox(
                  height: 78,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    children: [
                      _HomeAstrologyTopic(
                        icon: Icons.work_rounded,
                        label: AppStrings.text(context, en: 'Career'),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CategoryAiChatScreen(
                                category: AspAiCategory.career,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 10),

                      _HomeAstrologyTopic(
                        icon: Icons.favorite_rounded,
                        label: AppStrings.text(context, en: 'Marriage'),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CategoryAiChatScreen(
                                category: AspAiCategory.marriage,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 10),

                      _HomeAstrologyTopic(
                        icon: Icons.candlestick_chart_rounded,
                        label: AppStrings.text(context, en: 'Stock Market'),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CategoryAiChatScreen(
                                category: AspAiCategory.stockMarket,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 10),

                      _HomeAstrologyTopic(
                        icon: Icons.event_available_rounded,
                        label: AppStrings.text(context, en: 'Today'),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CategoryAiChatScreen(
                                category: AspAiCategory.today,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 10),

                      _HomeAstrologyTopic(
                        icon: Icons.business_center_rounded,
                        label: AppStrings.text(context, en: 'Business'),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CategoryAiChatScreen(
                                category: AspAiCategory.business,
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // FIRST CHAT FREE - PREMIUM VEDIC / BACKEND-AUTHORITATIVE
            // =========================================================
            if (_canShowFirstFreeChat)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(22),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(22),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const AstrologerSelectionScreen(
                              screenTitle: 'Choose Your Vedic Astrologer',
                            ),
                          ),
                        );
                      },
                      child: Ink(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFF17090D),
                              Color(0xFF421014),
                              Color(0xFF761A16),
                            ],
                          ),
                          border: Border.all(
                            color: const Color(0xB3FFD166),
                            width: 1.15,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x407A1515),
                              blurRadius: 18,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Stack(
                          children: [
                            Positioned(
                              right: -30,
                              top: -45,
                              child: Container(
                                width: 145,
                                height: 145,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    colors: [
                                      Color(0x40FFD166),
                                      Color(0x00FFD166),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 18,
                              bottom: -17,
                              child: Icon(
                                Icons.auto_awesome_rounded,
                                size: 82,
                                color: const Color(
                                  0xFFFFD166,
                                ).withValues(alpha: 0.07),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                17,
                                15,
                                14,
                                15,
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 58,
                                    height: 58,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: const LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          Color(0xFFFFE49A),
                                          Color(0xFFD99B25),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: const Color(0xFFFFE9A9),
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x55FFD166),
                                          blurRadius: 13,
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      Icons.temple_hindu_rounded,
                                      color: Color(0xFF50120F),
                                      size: 30,
                                    ),
                                  ),
                                  const SizedBox(width: 13),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(0x24FFD166),
                                            borderRadius: BorderRadius.circular(
                                              20,
                                            ),
                                            border: Border.all(
                                              color: const Color(0x66FFD166),
                                            ),
                                          ),
                                          child: const Text(
                                            'EXCLUSIVE WELCOME OFFER',
                                            style: TextStyle(
                                              color: Color(0xFFFFD978),
                                              fontSize: 8.5,
                                              letterSpacing: .7,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Your First $_backendFreeChatMinutes Min Chat is FREE',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 16.5,
                                            height: 1.05,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        const Text(
                                          'Connect with a verified Vedic astrologer',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: Color(0xFFE4CBC3),
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 9),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 9,
                                    ),
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [
                                          Color(0xFFFFE08A),
                                          Color(0xFFFFBC42),
                                        ],
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x44FFD166),
                                          blurRadius: 9,
                                        ),
                                      ],
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'START',
                                          style: TextStyle(
                                            color: Color(0xFF3A0D0B),
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                        SizedBox(width: 3),
                                        Icon(
                                          Icons.arrow_forward_rounded,
                                          color: Color(0xFF3A0D0B),
                                          size: 14,
                                        ),
                                      ],
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
              ),
            // =========================================================
            // AI ASTROLOGERS - BACKEND CATALOG
            // =================================================
            const SliverToBoxAdapter(child: _AiAstrologersHomeSection()),
            // ORGANIZED ASTROLOGER EXPERT SECTIONS
            // =================================================
            if (_isLoading)
              const SliverToBoxAdapter(
                child: SizedBox(
                  height: 220,
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.gold),
                  ),
                ),
              )
            else if (_error.isNotEmpty)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 240,
                  child: _ErrorState(
                    message: _error,
                    onRetry: _loadAstrologers,
                  ),
                ),
              )
            else if (visibleAstrologers.isEmpty)
              SliverToBoxAdapter(
                child: SizedBox(height: 230, child: _EmptyState()),
              )
            else ...[
              SliverToBoxAdapter(
                child: _expertSectionWidget(
                  title: AppStrings.text(
                    context,
                    en: 'Recommended for you',
                    hi: '\u0906\u092a\u0915\u0947 \u0932\u093f\u090f \u0938\u0941\u091d\u093e\u0935',
                  ),
                  astrologers: _recommendedAstrologers,
                  onTap: openAstrologer,
                  onViewAll: () =>
                      openAllAstrologers(title: 'Recommended Astrologers'),
                ),
              ),
              if (_vedicAstrologers.isNotEmpty)
                SliverToBoxAdapter(
                  child: _expertSectionWidget(
                    title: AppStrings.text(
                      context,
                      en: 'Vedic Astrologers',
                      hi: '\u0935\u0948\u0926\u093f\u0915 \u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940',
                    ),
                    astrologers: _vedicAstrologers,
                    onTap: openAstrologer,
                    onViewAll: () => openAllAstrologers(
                      title: AppStrings.text(
                        context,
                        en: 'Vedic Astrologers',
                        hi: '\u0935\u0948\u0926\u093f\u0915 \u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940',
                      ),
                      expertiseKeyword: 'vedic',
                    ),
                  ),
                ),
              if (_tarotAstrologers.isNotEmpty)
                SliverToBoxAdapter(
                  child: _expertSectionWidget(
                    title: 'Tarot Readers',
                    astrologers: _tarotAstrologers,
                    onTap: openAstrologer,
                    onViewAll: () => openAllAstrologers(
                      title: 'Tarot Readers',
                      expertiseKeyword: 'tarot',
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: _expertSectionWidget(
                  title: 'Trending Now',
                  astrologers: _trendingAstrologers,
                  onTap: openAstrologer,
                  onViewAll: () => openAllAstrologers(
                    title: 'Trending Astrologers',
                    trendingOnly: true,
                  ),
                ),
              ),
            ],

            // =================================================
            // LIVE ASTROLOGERS SECTION
            // =================================================
            if (_liveSessions.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                  child: Row(
                    children: [
                      Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Live',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 176,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                    itemCount: _liveSessions.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final session = _liveSessions[index];
                      final astrologer = session.astrologer;
                      final avatar = astrologer.avatarUrl?.trim() ?? '';

                      return GestureDetector(
                        onTap: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => CustomerLiveViewerScreen(
                                liveSession: session,
                              ),
                            ),
                          );

                          if (context.mounted) {
                            await _loadLiveSessions();
                          }
                        },
                        child: SizedBox(
                          width: 112,
                          child: Column(
                            children: [
                              Stack(
                                clipBehavior: Clip.none,
                                alignment: Alignment.bottomCenter,
                                children: [
                                  Container(
                                    width: 96,
                                    height: 96,
                                    padding: const EdgeInsets.all(3),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: Colors.red,
                                        width: 2.5,
                                      ),
                                    ),
                                    child: ClipOval(
                                      child: avatar.isNotEmpty
                                          ? Image.network(
                                              avatar,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, _, _) =>
                                                  const _LiveAvatarFallback(),
                                            )
                                          : const _LiveAvatarFallback(),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: -6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 9,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.red,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Text(
                                        'LIVE',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                astrologer.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${session.viewerCount} watching',
                                style: const TextStyle(
                                  color: Colors.white60,
                                  fontSize: 10,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 18)),
          ],
        ),
      ),
    );
  }
}

// CUSTOMER_STICKER_PHASE2_COMPLETE
class _HomeAstrologyAction extends StatelessWidget {
  // CUSTOMER_STICKER_ACTION_PHASE2

  const _HomeAstrologyAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  Color get _accent {
    switch (label) {
      case 'Kundli AI':
        return const Color(0xFFC877FF);
      case 'Horoscope':
        return const Color(0xFFFFD748);
      case 'AI Astro':
        return const Color(0xFFB969FF);
      default:
        return AppColors.gold;
    }
  }

  Color get _deep {
    switch (label) {
      case 'Kundli AI':
        return const Color(0xFF211044);
      case 'Horoscope':
        return const Color(0xFF332300);
      case 'AI Astro':
        return const Color(0xFF25103A);
      default:
        return const Color(0xFF141414);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = _accent;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          constraints: const BoxConstraints(minHeight: 118),
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _deep,
                accent.withValues(alpha: 0.18),
                const Color(0xFF080A11),
              ],
              stops: const [0.0, 0.52, 1.0],
            ),
            border: Border.all(
              color: accent.withValues(alpha: 0.86),
              width: 1.15,
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.24),
                blurRadius: 18,
                spreadRadius: 0.4,
                offset: const Offset(0, 7),
              ),
              BoxShadow(
                color: AppColors.gold.withValues(alpha: 0.08),
                blurRadius: 14,
              ),
              const BoxShadow(
                color: Color(0x66000000),
                blurRadius: 12,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Positioned(
                right: -7,
                top: -8,
                child: Icon(
                  Icons.auto_awesome_rounded,
                  size: 42,
                  color: accent.withValues(alpha: 0.09),
                ),
              ),

              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(19),
                      gradient: RadialGradient(
                        colors: [accent.withValues(alpha: 0.50), _deep],
                      ),
                      border: Border.all(color: accent.withValues(alpha: 0.84)),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.35),
                          blurRadius: 14,
                          spreadRadius: 0.3,
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, color: accent, size: 28),
                  ),

                  const SizedBox(height: 6),

                  Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11.2,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.1,
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

// CUSTOMER_STICKER_PHASE3_COMPLETE
class _HomeAstrologyTopic extends StatelessWidget {
  // CUSTOMER_STICKER_TOPIC_PHASE3

  const _HomeAstrologyTopic({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  Color get _accent {
    switch (label) {
      case 'Career':
        return const Color(0xFFFFD84D);

      case 'Marriage':
        return const Color(0xFFFF76C8);

      case 'Stock Market':
        return const Color(0xFF8DB5FF);

      case 'Today':
        return const Color(0xFFFFD347);

      case 'Business':
        return const Color(0xFFC783FF);

      default:
        return AppColors.gold;
    }
  }

  Color get _deep {
    switch (label) {
      case 'Career':
        return const Color(0xFF3A2700);

      case 'Marriage':
        return const Color(0xFF401331);

      case 'Stock Market':
        return const Color(0xFF132C4A);

      case 'Today':
        return const Color(0xFF352600);

      case 'Business':
        return const Color(0xFF2B1742);

      default:
        return const Color(0xFF1A150B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = _accent;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          constraints: const BoxConstraints(minHeight: 82, maxHeight: 88),
          width: 68,
          padding: const EdgeInsets.fromLTRB(7, 10, 7, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _deep,
                accent.withValues(alpha: 0.16),
                const Color(0xFF080A10),
              ],
              stops: const [0.0, 0.52, 1.0],
            ),
            border: Border.all(
              color: accent.withValues(alpha: 0.84),
              width: 1.05,
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.22),
                blurRadius: 15,
                spreadRadius: 0.2,
                offset: const Offset(0, 6),
              ),
              const BoxShadow(
                color: Color(0x55000000),
                blurRadius: 11,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                right: -4,
                top: -4,
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: accent.withValues(alpha: 0.10),
                  size: 22,
                ),
              ),

              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [accent.withValues(alpha: 0.48), _deep],
                      ),
                      border: Border.all(color: accent.withValues(alpha: 0.88)),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.32),
                          blurRadius: 13,
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, color: accent, size: 23),
                  ),

                  const SizedBox(height: 3),

                  Text(
                    label,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 8.8,
                      height: 1.0,
                      fontWeight: FontWeight.w800,
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

class _AiAstrologersHomeSection extends StatefulWidget {
  const _AiAstrologersHomeSection();

  @override
  State<_AiAstrologersHomeSection> createState() =>
      _AiAstrologersHomeSectionState();
}

class _AiAstrologersHomeSectionState extends State<_AiAstrologersHomeSection> {
  final AiAstroApi _api = AiAstroApi();

  List<AiAstroPersona> _personas = const [];
  List<AiConsultantType> _consultantTypes = const [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final catalog = await _api.getCatalog();

      final sorted = [...catalog.personas]
        ..sort((first, second) {
          if (first.available != second.available) {
            return first.available ? -1 : 1;
          }

          return second.rating.compareTo(first.rating);
        });

      if (!mounted) {
        return;
      }

      setState(() {
        _personas = List.unmodifiable(sorted);
        _consultantTypes = List.unmodifiable(catalog.consultantTypes);
      });
    } on AiAstroApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _personas = const [];
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to load AI astrologers right now.';
        _personas = const [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _openPersona(AiAstroPersona persona) {
    if (_consultantTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('AI consultant types are unavailable right now.'),
        ),
      );
      return;
    }

    final selectedConsultantType = _consultantTypes.first;

    final category = persona.categories.isNotEmpty
        ? persona.categories.first
        : 'GENERAL';

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AiAstroDetailScreen(
          persona: persona,
          category: category,
          consultantType: selectedConsultantType,
        ),
      ),
    );
  }

  void _openAll() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const AiAstroHomeScreen()));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 220,
        child: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      );
    }

    if (_error.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0x334D6682)),
          ),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'AI Astrologers are temporarily unavailable.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              TextButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    if (_personas.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.30),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.45),
                  ),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.gold,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // CUSTOMER_PHASE2_DIVIDER
                        Container(
                          height: 1,
                          width: double.infinity,
                          margin: const EdgeInsets.only(top: 4, bottom: 14),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                AppColors.gold.withValues(alpha: 0.78),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                        Text(
                          AppStrings.text(
                            context,
                            en: 'AI Astrologers',
                            hi: '\u090f\u0906\u0908 \u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940',
                          ),
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Personalized AI guidance with your Kundli',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: _openAll,
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x55230E42),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFFFD84A)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppStrings.text(
                          context,
                          en: 'View All',
                          hi: '\u0938\u092d\u0940 \u0926\u0947\u0916\u0947\u0902',
                        ),
                        style: TextStyle(
                          color: AppColors.gold,
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.gold,
                        size: 17,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 202,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 2, 16, 14),
            itemCount: _personas.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final persona = _personas[index];

              return SizedBox(
                width: 128,
                child: GestureDetector(
                  onTap: () => _openPersona(persona),
                  child: _AiDashboardPersonaCard(persona: persona),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// CUSTOMER_ASTRO_SECTIONS_FINAL_PREMIUM
// CUSTOMER_ACTUAL_CARD_REBUILD
// CUSTOMER_REFERENCE_PREMIUM_PHASE1
class _AiDashboardPersonaCard extends StatelessWidget {
  // CUSTOMER_PREMIUM_PHASE4_COMPLETE
  // CUSTOMER_PHASE3_AI_CARD
  const _AiDashboardPersonaCard({required this.persona});

  final AiAstroPersona persona;

  @override
  Widget build(BuildContext context) {
    final avatar = persona.avatarUrl?.trim() ?? '';

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 11, 8, 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF36175A),
            Color(0xFF151D3C),
            Color(0xFF080B16),
            Color(0xFF25113C),
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: persona.available
              ? const Color(0xFF31F59B)
              : const Color(0xFFB88CFF),
        ),
        boxShadow: [
          // ACTUAL_AI_CARD_GLOW
          BoxShadow(
            color: const Color(0xFF9F63FF).withValues(alpha: 0.38),
            blurRadius: 24,
            spreadRadius: 0.5,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.30),
            blurRadius: 18,
            spreadRadius: 0.2,
          ),
          const BoxShadow(
            color: Color(0x88000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 72,
                height: 72,
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFFFD83D),
                    width: 2.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFB56CFF).withValues(alpha: 0.42),
                      blurRadius: 26,
                    ),
                  ],
                ),
                child: ClipOval(
                  child: avatar.isNotEmpty
                      ? Image.network(
                          avatar,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) {
                            return _AiDashboardAvatarFallback(
                              initials: persona.initials,
                            );
                          },
                        )
                      : _AiDashboardAvatarFallback(initials: persona.initials),
                ),
              ),
              Positioned(
                right: 0,
                bottom: 4,
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: persona.available
                        ? const Color(0xFF28D982)
                        : const Color(0xFF718096),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF111722),
                      width: 2,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            persona.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            persona.subtitle.isEmpty ? 'AI Astrologer' : persona.subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          Row(
            children: [
              const Icon(Icons.star_rounded, size: 14, color: AppColors.gold),
              const SizedBox(width: 2),
              Text(
                persona.rating.toStringAsFixed(1),
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  persona.aiPricing.displayLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: persona.aiPricing.isFree
                        ? const Color(0xFF40D98A)
                        : AppColors.gold,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AiDashboardAvatarFallback extends StatelessWidget {
  const _AiDashboardAvatarFallback({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceLight,
      alignment: Alignment.center,
      child: Text(
        initials.trim().isEmpty ? 'AI' : initials,
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 22,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _CompactAstrologerCard extends StatelessWidget {
  // CUSTOMER_PHASE3_REAL_CARD
  const _CompactAstrologerCard({required this.astrologer});

  final PublicAstrologer astrologer;

  @override
  Widget build(BuildContext context) {
    final avatar = astrologer.avatarUrl?.trim() ?? '';
    final initial = astrologer.name.trim().isEmpty
        ? 'A'
        : astrologer.name.trim()[0].toUpperCase();

    return Container(
      padding: const EdgeInsets.fromLTRB(10, 11, 10, 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF132A3B),
            Color(0xFF11162D),
            Color(0xFF160D26),
            Color(0xFF080A0F),
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: astrologer.isOnline
              ? const Color(0xFF35F58A)
              : const Color(0xFFFFB83D),
          width: 1.15,
        ),
        boxShadow: [
          // ACTUAL_REAL_CARD_GLOW
          BoxShadow(
            color: astrologer.isOnline
                ? const Color(0xFF35F58A).withValues(alpha: 0.22)
                : AppColors.gold.withValues(alpha: 0.24),
            blurRadius: 24,
            spreadRadius: 0.5,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: const Color(0xFF8D52FF).withValues(alpha: 0.22),
            blurRadius: 18,
          ),
          const BoxShadow(
            color: Color(0x88000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 72,
                height: 72,
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFFFD83D),
                    width: 2.2,
                  ),
                ),
                child: ClipOval(
                  child: avatar.isNotEmpty
                      ? Image.network(
                          avatar,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) {
                            return _CompactAvatarFallback(initial: initial);
                          },
                        )
                      : _CompactAvatarFallback(initial: initial),
                ),
              ),
              Positioned(
                right: 1,
                bottom: 3,
                child: Container(
                  width: 13,
                  height: 13,
                  decoration: BoxDecoration(
                    color: astrologer.isOnline
                        ? const Color(0xFF35F58A)
                        : const Color(0xFF9A8A68),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF10131F),
                      width: 2.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            astrologer.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            astrologer.primaryExpertise,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            astrologer.experienceLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          Row(
            children: [
              const Icon(Icons.star_rounded, size: 14, color: AppColors.gold),
              const SizedBox(width: 2),
              Text(
                astrologer.rating.toStringAsFixed(1),
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  astrologer.priceLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CompactAvatarFallback extends StatelessWidget {
  const _CompactAvatarFallback({required this.initial});

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      color: AppColors.surfaceLight,
      child: Text(
        initial,
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 24,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: Colors.redAccent,
            size: 54,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white),
          ),
          const SizedBox(height: 18),
          FilledButton(onPressed: onRetry, child: const Text('Try Again')),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.auto_awesome_rounded, color: AppColors.gold, size: 54),
          SizedBox(height: 16),
          Text(
            'No astrologers match your search.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveAvatarFallback extends StatelessWidget {
  const _LiveAvatarFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceLight,
      alignment: Alignment.center,
      child: const Icon(Icons.person_rounded, color: AppColors.gold, size: 46),
    );
  }
}

class _DrawerMenuTile extends StatelessWidget {
  const _DrawerMenuTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 3),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: AppColors.gold, size: 21),
      ),
      title: Text(
        title,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: AppColors.muted,
        size: 20,
      ),
    );
  }
}

class _DrawerAvatarFallback extends StatelessWidget {
  const _DrawerAvatarFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceLight,
      alignment: Alignment.center,
      child: const Icon(Icons.person_rounded, color: AppColors.gold, size: 38),
    );
  }
}
