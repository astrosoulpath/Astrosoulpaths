import 'package:flutter/material.dart';
import '../../../support/presentation/widgets/home_support_shortcut.dart';
import '../widgets/customer_tab_back_scope.dart';

import '../../../../core/localization/app_strings.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../consultations/presentation/screens/consultation_history_screen.dart';
import 'customer_home_screen.dart';
import 'customer_profile_screen.dart';
import '../../../ai_astro/presentation/screens/ai_astro_home_screen.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';

class CustomerShellScreen extends StatefulWidget {
  const CustomerShellScreen({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<CustomerShellScreen> createState() => _CustomerShellScreenState();
}

class _CustomerShellScreenState extends State<CustomerShellScreen> {
  late int _selectedIndex;

  final GlobalKey<ScaffoldState> _homeScaffoldKey = GlobalKey<ScaffoldState>();

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();

    _screens = <Widget>[
      CustomerHomeScreen(scaffoldKey: _homeScaffoldKey),
      const AiAstroHomeScreen(showBackButton: false),
      const AstrologerSelectionScreen(
        screenTitle: 'Ask',
        showCategoryFilters: true,
      ),
      const ConsultationHistoryScreen(),
      const CustomerProfileScreen(),
    ];

    _selectedIndex = widget.initialIndex.clamp(0, _screens.length - 1);
  }

  void _selectDestination(int index) {
    final homeScaffold = _homeScaffoldKey.currentState;

    // The navigation drawer belongs to CustomerHomeScreen's Scaffold.
    // Always close that exact drawer before changing bottom tabs.
    if (homeScaffold?.isDrawerOpen ?? false) {
      homeScaffold!.closeDrawer();
    }

    if (index == _selectedIndex) {
      return;
    }

    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return CustomerTabBackScope(
      index: _selectedIndex,
      onHome: () => _selectDestination(0),
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: IndexedStack(
          index: _selectedIndex,
          children: [
            for (var i = 0; i < _screens.length; i++)
              TickerMode(enabled: i == _selectedIndex, child: _screens[i]),
          ],
        ),
        floatingActionButton:
            _selectedIndex == 0 && MediaQuery.viewInsetsOf(context).bottom == 0
            ? const HomeSupportShortcut()
            : null,
        bottomNavigationBar: Container(
          // CUSTOMER_PREMIUM_DYNAMIC_NAV_PHASE2
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: Theme.of(context).brightness == Brightness.dark
                  ? const [
                      Color(0xFF151B35),
                      Color(0xFF202747),
                      Color(0xFF151B35),
                    ]
                  : const [
                      Color(0xFFFFFCF7),
                      Color(0xFFF4EDF9),
                      Color(0xFFFFFBF3),
                    ],
            ),
            border: Border(
              top: BorderSide(
                color: AppColors.gold.withValues(alpha: 0.48),
                width: 1.0,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.gold.withValues(alpha: 0.10),
                blurRadius: 24,
                spreadRadius: 1,
                offset: const Offset(0, -6),
              ),
              BoxShadow(
                color: const Color(0xFF7540FF).withValues(alpha: 0.15),
                blurRadius: 28,
                spreadRadius: 1,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              height: 74,

              backgroundColor: Colors.transparent,

              indicatorColor: const Color(0xFFE5CC97),

              indicatorShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(19),
                side: const BorderSide(color: Color(0xFFFFED96), width: 1.15),
              ),

              elevation: 0,

              shadowColor: Colors.transparent,

              surfaceTintColor: Colors.transparent,

              iconTheme: WidgetStateProperty.resolveWith<IconThemeData>((
                states,
              ) {
                final selected = states.contains(WidgetState.selected);

                return IconThemeData(
                  color: selected
                      ? const Color(0xFF40245F)
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  size: selected ? 27 : 24,
                  shadows: selected
                      ? [
                          Shadow(
                            color: AppColors.gold.withValues(alpha: 0.12),
                            blurRadius: 3,
                          ),
                        ]
                      : [
                          Shadow(
                            color: const Color(
                              0xFF9B5CFF,
                            ).withValues(alpha: 0.32),
                            blurRadius: 8,
                          ),
                        ],
                );
              }),

              labelTextStyle: WidgetStateProperty.resolveWith<TextStyle>((
                states,
              ) {
                final selected = states.contains(WidgetState.selected);

                return TextStyle(
                  color: selected
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: selected ? 11.2 : 10.2,
                  height: 1.05,
                  fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
                  letterSpacing: selected ? 0.15 : 0,
                  shadows: selected
                      ? [
                          Shadow(
                            color: AppColors.gold.withValues(alpha: 0.38),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                );
              }),
            ),
            child: NavigationBar(
              selectedIndex: _selectedIndex,
              onDestinationSelected: _selectDestination,
              backgroundColor: Theme.of(
                context,
              ).colorScheme.surfaceContainerLowest,
              indicatorColor: AppColors.gold,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: [
                NavigationDestination(
                  icon: Icon(
                    Icons.home_outlined,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  selectedIcon: Icon(
                    Icons.home_rounded,
                    color: const Color(0xFF40245F),
                  ),
                  label: AppStrings.text(
                    context,
                    en: 'Home',
                    hi: 'ÃƒÂ Ã‚Â¤Ã‚Â¹ÃƒÂ Ã‚Â¥Ã¢â‚¬Â¹ÃƒÂ Ã‚Â¤Ã‚Â®',
                  ),
                ),
                NavigationDestination(
                  icon: Icon(
                    Icons.auto_awesome_outlined,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  selectedIcon: Icon(
                    Icons.auto_awesome_rounded,
                    color: const Color(0xFF40245F),
                  ),
                  label: AppStrings.text(
                    context,
                    en: 'AI Astro',
                    hi: '\u090f\u0906\u0908 \u090f\u0938\u094d\u091f\u094d\u0930\u094b',
                  ),
                ),
                NavigationDestination(
                  icon: Icon(
                    Icons.question_answer_outlined,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  selectedIcon: Icon(
                    Icons.question_answer_rounded,
                    color: const Color(0xFF40245F),
                  ),
                  label: AppStrings.text(
                    context,
                    en: 'Ask',
                    hi: '\u092a\u0942\u091b\u0947\u0902',
                  ),
                ),
                NavigationDestination(
                  icon: Icon(
                    Icons.history_outlined,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  selectedIcon: Icon(
                    Icons.history_rounded,
                    color: const Color(0xFF40245F),
                  ),
                  label: AppStrings.text(
                    context,
                    en: 'Consultations',
                    hi: 'ÃƒÂ Ã‚Â¤Ã‚ÂªÃƒÂ Ã‚Â¤Ã‚Â°ÃƒÂ Ã‚Â¤Ã‚Â¾ÃƒÂ Ã‚Â¤Ã‚Â®ÃƒÂ Ã‚Â¤Ã‚Â°ÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã‚Â¶',
                  ),
                ),
                NavigationDestination(
                  icon: Icon(
                    Icons.person_outline_rounded,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  selectedIcon: Icon(
                    Icons.person_rounded,
                    color: const Color(0xFF40245F),
                  ),
                  label: AppStrings.text(
                    context,
                    en: 'Profile',
                    hi: 'ÃƒÂ Ã‚Â¤Ã‚ÂªÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã‚Â°ÃƒÂ Ã‚Â¥Ã¢â‚¬Â¹ÃƒÂ Ã‚Â¤Ã‚Â«ÃƒÂ Ã‚Â¤Ã‚Â¼ÃƒÂ Ã‚Â¤Ã‚Â¾ÃƒÂ Ã‚Â¤Ã¢â‚¬Â¡ÃƒÂ Ã‚Â¤Ã‚Â²',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
