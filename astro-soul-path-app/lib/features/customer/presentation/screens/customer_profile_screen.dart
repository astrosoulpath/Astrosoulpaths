import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../auth/presentation/auth_gate.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../profile/data/profile_api.dart';
import 'edit_customer_profile_screen.dart';
// CUSTOMER_FINAL_PREMIUM_PHASE4

class CustomerProfileScreen extends StatefulWidget {
  const CustomerProfileScreen({super.key});

  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen> {
  final AuthSessionStore _sessionStore = AuthSessionStore();
  final ProfileApi _profileApi = ProfileApi();

  StoredAuthSession? _session;
  CustomerProfile? _profile;

  bool _isLoading = true;
  bool _isLoggingOut = false;
  bool _profileRequestInFlight = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _profileApi.close();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    if (_profileRequestInFlight) {
      return;
    }

    _profileRequestInFlight = true;

    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = '';
      });
    }

    try {
      final session = await _sessionStore.read();

      if (session == null || session.accessToken.trim().isEmpty) {
        await _sessionStore.clear();

        if (!mounted) {
          return;
        }

        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute<void>(builder: (_) => const AuthGate()),
          (route) => false,
        );

        return;
      }

      final profiles = await _profileApi.getProfiles();

      if (!mounted) {
        return;
      }

      setState(() {
        _session = session;
        _profile = profiles.isEmpty ? null : profiles.first;
      });
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      if (error.loginRequired) {
        await _sessionStore.clear();

        if (!mounted) {
          return;
        }

        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute<void>(builder: (_) => const AuthGate()),
          (route) => false,
        );

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
        _error = 'Unable to load your profile.';
      });
    } finally {
      _profileRequestInFlight = false;

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openEditProfile() async {
    if (_isLoading || _profileRequestInFlight) {
      return;
    }

    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => EditCustomerProfileScreen(profile: _profile),
      ),
    );

    if (!mounted) {
      return;
    }

    if (changed == true) {
      await _loadProfile();
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Logout'),
          content: const Text(
            'Are you sure you want to logout from your account?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _isLoggingOut = true;
    });

    await _sessionStore.clear();

    if (!mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const AuthGate()),
      (route) => false,
    );
  }

  String _formatBirthDate(DateTime value) {
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');

    return '$day/$month/${value.year}';
  }

  @override
  Widget build(BuildContext context) {
    final user = _session?.user ?? const <String, dynamic>{};
    final profile = _profile;

    final phone = user['phone']?.toString() ?? 'Phone unavailable';

    final displayName = profile?.fullName?.trim().isNotEmpty == true
        ? profile!.fullName!
        : profile?.name.trim().isNotEmpty == true
        ? profile!.name
        : 'Customer';

    final birthPlace = profile == null
        ? ''
        : [profile.city, profile.state, profile.country]
              .where((value) => value != null && value.trim().isNotEmpty)
              .join(', ');

    return
    // CUSTOMER_SHARED_PREMIUM_BACKGROUND
    Scaffold(
      backgroundColor: const Color(0xFFFFF9F1),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: const Color(0xFFFFF9F1),
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'My Profile',
              style: TextStyle(
                color: Color(0xFF14213D),
                fontSize: 25,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            SizedBox(height: 2),
            Text(
              'Your cosmic identity',
              style: TextStyle(
                color: Color(0xFF7551C9),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        actions: [
          Container(
            width: 42,
            height: 42,
            margin: const EdgeInsets.only(right: 5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                colors: [Color(0xFFFFF3C4), Color(0xFFFFF3C4)],
              ),
              border: Border.all(color: const Color(0xFFF4C542), width: 1.1),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF4C542).withValues(alpha: 0.22),
                  blurRadius: 17,
                ),
              ],
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              onPressed: _openEditProfile,
              tooltip: 'Edit profile',
              icon: const Icon(
                Icons.edit_rounded,
                color: Color(0xFFF4C542),
                size: 21,
              ),
            ),
          ),
          Container(
            width: 42,
            height: 42,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                colors: [Color(0xFFF0E9FF), Color(0xFFFFFFFF)],
              ),
              border: Border.all(
                color: const Color(0xFFF4C542).withValues(alpha: 0.75),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFCAB7F3).withValues(alpha: 0.22),
                  blurRadius: 18,
                ),
              ],
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              onPressed: (_isLoading || _profileRequestInFlight)
                  ? null
                  : _loadProfile,
              tooltip: 'Refresh profile',
              icon: const Icon(
                Icons.refresh_rounded,
                color: Color(0xFFF4C542),
                size: 21,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.gold.withValues(alpha: 0.10),
                        ),
                        child: const Icon(
                          Icons.error_outline_rounded,
                          size: 34,
                          color: AppColors.gold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Profile unavailable',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.muted,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: _profileRequestInFlight
                            ? null
                            : _loadProfile,
                        child: const Text('Try Again'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : RefreshIndicator(
              color: AppColors.gold,
              backgroundColor: const Color(0xFFFFFFFF),
              onRefresh: _loadProfile,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
                children: [
                  // PROFILE_SAFE_COSMIC_ART_INSTANCE
                  const _ProfileCosmicArtwork(),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFFFFF9F1),
                          Color(0xFFF5EEFF),
                          Color(0xFFFFF9F1),
                          Color(0xFFF8F3FF),
                        ],
                        stops: [0.0, 0.34, 0.67, 1.0],
                      ),
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: const Color(0xFFE8BD43),
                        width: 1.25,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(
                            0xFFF4C542,
                          ).withValues(alpha: 0.18),
                          blurRadius: 28,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: const Color(0xFFE8BD43),
                              width: 2.4,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(
                                  0xFFF4C542,
                                ).withValues(alpha: 0.34),
                                blurRadius: 22,
                                spreadRadius: 2,
                              ),
                              BoxShadow(
                                color: const Color(
                                  0xFFCAB7F3,
                                ).withValues(alpha: 0.24),
                                blurRadius: 28,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: CircleAvatar(
                            radius: 43,
                            backgroundColor: AppColors.gold,
                            backgroundImage:
                                profile?.avatarUrl?.trim().isNotEmpty == true
                                ? NetworkImage(profile!.avatarUrl!)
                                : null,
                            child: profile?.avatarUrl?.trim().isNotEmpty == true
                                ? null
                                : const Icon(
                                    Icons.person_rounded,
                                    size: 48,
                                    color: AppColors.background,
                                  ),
                          ),
                        ),
                        const SizedBox(height: 15),
                        Text(
                          displayName,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.phone_rounded,
                              size: 14,
                              color: AppColors.gold,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                phone,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F3FF),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE8BD43)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_awesome_rounded,
                                size: 15,
                                color: AppColors.gold,
                              ),
                              SizedBox(width: 7),
                              Text(
                                'Your Astro Profile',
                                style: TextStyle(
                                  color: AppColors.gold,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (profile == null)
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                          color: AppColors.gold.withValues(alpha: 0.14),
                        ),
                      ),
                      child: const Column(
                        children: [
                          Icon(
                            Icons.person_off_rounded,
                            size: 38,
                            color: AppColors.gold,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'Complete your profile',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Your birth details will be used for personalized astrology experiences.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.muted,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    const _ProfileSectionTitle(
                      icon: Icons.person_outline_rounded,
                      title: 'Personal Details',
                    ),
                    const SizedBox(height: 10),
                    _ProfileInfoCard(
                      children: [
                        _ProfileInfoRow(
                          icon: Icons.badge_outlined,
                          title: 'Full Name',
                          value: profile.fullName ?? profile.name,
                        ),
                        _ProfileInfoRow(
                          icon: Icons.work_outline_rounded,
                          title: 'Occupation',
                          value: profile.occupation ?? 'Not provided',
                          showDivider: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const _ProfileSectionTitle(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Birth Details',
                    ),
                    const SizedBox(height: 10),
                    _ProfileInfoCard(
                      children: [
                        _ProfileInfoRow(
                          icon: Icons.calendar_today_outlined,
                          title: 'Date of Birth',
                          value: _formatBirthDate(profile.birthDate),
                        ),
                        _ProfileInfoRow(
                          icon: Icons.schedule_outlined,
                          title: 'Time of Birth',
                          value: profile.birthTimeKnown
                              ? (profile.birthTime.trim().isEmpty
                                    ? 'Not provided'
                                    : profile.birthTime)
                              : 'Not known',
                          showDivider: true,
                        ),
                        _ProfileInfoRow(
                          icon: Icons.location_on_outlined,
                          title: 'Birth Place',
                          value: birthPlace.isEmpty
                              ? 'Not provided'
                              : birthPlace,
                          showDivider: true,
                        ),
                        _ProfileInfoRow(
                          icon: Icons.public_rounded,
                          title: 'Coordinates',
                          value: '${profile.latitude}, ${profile.longitude}',
                          showDivider: true,
                        ),
                        _ProfileInfoRow(
                          icon: Icons.access_time_rounded,
                          title: 'Timezone',
                          value:
                              profile.timezoneName ??
                              profile.timezone.toString(),
                          showDivider: true,
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 28),
                  OutlinedButton.icon(
                    onPressed: _isLoggingOut ? null : _logout,
                    icon: _isLoggingOut
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.gold,
                            ),
                          )
                        : const Icon(Icons.logout_rounded),
                    label: Text(_isLoggingOut ? 'Logging out...' : 'Logout'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.gold,
                      side: BorderSide(
                        color: AppColors.gold.withValues(alpha: 0.35),
                      ),
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _ProfileCosmicArtwork extends StatelessWidget {
  const _ProfileCosmicArtwork();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 118,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer orbit
          Container(
            width: 230,
            height: 86,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(120),
              border: Border.all(
                color: const Color(0xFFF4C542).withValues(alpha: 0.24),
                width: 1,
              ),
            ),
          ),

          // Inner purple orbit
          Container(
            width: 160,
            height: 58,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(90),
              border: Border.all(
                color: const Color(0xFFB79BEA).withValues(alpha: 0.27),
                width: 1,
              ),
            ),
          ),

          // Golden moon
          Positioned(
            left: 30,
            top: 18,
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [
                    Color(0xFFFFF3A8),
                    Color(0xFFF4C542),
                    Color(0xFF8B4D00),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF4C542).withValues(alpha: 0.42),
                    blurRadius: 24,
                    spreadRadius: 3,
                  ),
                ],
              ),
              child: const Icon(
                Icons.nightlight_round,
                color: Color(0xFF452100),
                size: 29,
              ),
            ),
          ),

          // Dark planet
          Positioned(
            right: 34,
            top: 30,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  center: Alignment(-0.45, -0.55),
                  colors: [
                    Color(0xFFB6793D),
                    Color(0xFF522817),
                    Color(0xFF14090D),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFCAB7F3).withValues(alpha: 0.28),
                    blurRadius: 21,
                  ),
                ],
              ),
            ),
          ),

          // Central zodiac-style glow
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  const Color(0xFF8E3AC8).withValues(alpha: 0.35),
                  const Color(0xFFF5EEFF).withValues(alpha: 0.10),
                  Colors.transparent,
                ],
              ),
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: Color(0xFFF4C542),
              size: 28,
            ),
          ),

          const Positioned(
            left: 96,
            top: 15,
            child: Icon(Icons.star_rounded, color: Color(0xFFF4C542), size: 13),
          ),

          const Positioned(
            right: 104,
            bottom: 13,
            child: Icon(Icons.auto_awesome, color: Color(0xFFC979FF), size: 17),
          ),

          const Positioned(
            right: 82,
            top: 11,
            child: Icon(Icons.star_rounded, color: Color(0xFFFFE889), size: 10),
          ),
        ],
      ),
    );
  }
}

class _ProfileSectionTitle extends StatelessWidget {
  const _ProfileSectionTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: const Color(0xFFF0E9FF),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: const Color(0xFFF4C542)),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _ProfileInfoCard extends StatelessWidget {
  const _ProfileInfoCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFFFF), Color(0xFFFFF9F1), Color(0xFFF8F3FF)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE8BD43), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF4C542).withValues(alpha: 0.10),
            blurRadius: 18,
          ),
          BoxShadow(
            color: const Color(0xFFCAB7F3).withValues(alpha: 0.11),
            blurRadius: 25,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Column(children: children),
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({
    required this.icon,
    required this.title,
    required this.value,
    this.showDivider = false,
  });

  final IconData icon;
  final String title;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF5EEFF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: const Color(0xFFF4C542)),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Padding(
            padding: const EdgeInsets.only(left: 69),
            child: Divider(height: 1, color: const Color(0x33FFC928)),
          ),
      ],
    );
  }
}
