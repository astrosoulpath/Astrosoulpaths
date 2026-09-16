import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../consultations/data/consultation_models.dart';
import '../../../consultations/presentation/screens/consultation_confirmation_screen.dart';
import '../../data/astrologer_api.dart';
import '../../data/public_astrologer.dart';
import '../widgets/astrologer_detail_extras.dart';
import '../widgets/customer_wallet_badge.dart';

class AstrologerDetailScreen extends StatefulWidget {
  const AstrologerDetailScreen({
    required this.astrologerId,
    this.astrologyQuestionId,
    this.astrologyQuestionText,
    this.astrologyCategorySlug,
    this.isFreeChatIntent = false,
    this.freeChatMinutes = 0,
    super.key,
  });

  final String astrologerId;
  final String? astrologyQuestionId;
  final String? astrologyQuestionText;
  final String? astrologyCategorySlug;

  /// Free-chat navigation intent only.
  /// Actual eligibility and charging remain backend-authoritative.
  final bool isFreeChatIntent;
  final int freeChatMinutes;

  @override
  State<AstrologerDetailScreen> createState() => _AstrologerDetailScreenState();
}

class _AstrologerDetailScreenState extends State<AstrologerDetailScreen> {
  final _astrologerApi = AstrologerApi();

  PublicAstrologerProfile? _profile;
  String _error = '';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _astrologerApi.close();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final profile = await _astrologerApi.getPublicAstrologerById(
        widget.astrologerId,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _profile = profile;
      });
    } on AstrologerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _profile = null;
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openConfirmation(
    PublicAstrologerProfile profile,
    ConsultationMode mode,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => ConsultationConfirmationScreen(
          profile: profile,
          mode: mode,
          astrologyQuestionId: widget.astrologyQuestionId,
          astrologyQuestionText: widget.astrologyQuestionText,
          astrologyCategorySlug: widget.astrologyCategorySlug,
          isFreeChatIntent:
              widget.isFreeChatIntent && mode == ConsultationMode.chat,
          freeChatMinutes: widget.freeChatMinutes,
        ),
      ),
    );

    if (mounted) {
      await _loadProfile();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Astrologer Profile',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          const CustomerWalletBadge(),
          IconButton(
            onPressed: _loadProfile,
            tooltip: 'Refresh profile',
            icon: const Icon(Icons.refresh_rounded, color: AppColors.gold),
          ),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomConsultationBar(),
    );
  }

  Widget? _buildBottomConsultationBar() {
    final profile = _profile;

    if (_isLoading || profile == null || _error.isNotEmpty) {
      return null;
    }

    final astrologer = profile.astrologer;
    final isOnline = astrologer.isOnline;
    final canChat = isOnline && profile.consultationOptions.chat;
    final canAudio = isOnline && profile.consultationOptions.audioCall;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
        decoration: const BoxDecoration(
          color: AppColors.background,
          border: Border(top: BorderSide(color: Color(0x447A8BB8))),
          boxShadow: [
            BoxShadow(
              color: Color(0x44000000),
              blurRadius: 18,
              offset: Offset(0, -6),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: _BottomConsultationButton(
                icon: Icons.chat_bubble_rounded,
                title: 'Chat',
                subtitle: astrologer.priceLabel,
                primary: true,
                enabled: canChat,
                onTap: canChat
                    ? () => _openConfirmation(profile, ConsultationMode.chat)
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _BottomConsultationButton(
                icon: Icons.call_rounded,
                title: 'Audio',
                subtitle: astrologer.priceLabel,
                primary: false,
                enabled: canAudio,
                onTap: canAudio
                    ? () => _openConfirmation(profile, ConsultationMode.audio)
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error.isNotEmpty) {
      return _ProfileError(message: _error, onRetry: _loadProfile);
    }

    final profile = _profile;

    if (profile == null) {
      return const Center(
        child: Text(
          'Astrologer profile is unavailable.',
          style: TextStyle(color: AppColors.white),
        ),
      );
    }

    final astrologer = profile.astrologer;
    final initial = astrologer.name.isEmpty
        ? 'A'
        : astrologer.name[0].toUpperCase();

    return RefreshIndicator(
      onRefresh: _loadProfile,
      color: AppColors.gold,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 26),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.background,
                  AppColors.surfaceLight,
                  AppColors.surfaceLight,
                ],
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(34),
                bottomRight: Radius.circular(34),
              ),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0x22F4C45E),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0x55F4C45E)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.workspace_premium_rounded,
                            color: AppColors.gold,
                            size: 15,
                          ),
                          SizedBox(width: 5),
                          Text(
                            'VERIFIED ASTROLOGER',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.7,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 126,
                      height: 126,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0x66F4C45E),
                          width: 2,
                        ),
                        boxShadow: const [
                          BoxShadow(
                            blurRadius: 24,
                            spreadRadius: 2,
                            color: Color(0x334F6FAF),
                          ),
                        ],
                      ),
                    ),
                    CircleAvatar(
                      radius: 54,
                      backgroundColor: const Color(0x33F4C45E),
                      backgroundImage: astrologer.avatarUrl == null
                          ? null
                          : NetworkImage(astrologer.avatarUrl!),
                      child: astrologer.avatarUrl == null
                          ? Text(
                              initial,
                              style: const TextStyle(
                                color: AppColors.gold,
                                fontSize: 38,
                                fontWeight: FontWeight.w900,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      right: 5,
                      bottom: 5,
                      child: Container(
                        width: 23,
                        height: 23,
                        decoration: BoxDecoration(
                          color: astrologer.isOnline
                              ? const Color(0xFF42D468)
                              : const Color(0xFF7A849B),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.surfaceLight,
                            width: 3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        astrologer.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 27,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 7),
                    const Icon(
                      Icons.verified_rounded,
                      color: Color(0xFF55A7FF),
                      size: 23,
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                Text(
                  astrologer.primaryExpertise,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 13),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: astrologer.isOnline
                        ? const Color(0x183FD468)
                        : const Color(0x187A849B),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: astrologer.isOnline
                          ? const Color(0x5542D468)
                          : const Color(0x447A849B),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: astrologer.isOnline
                              ? const Color(0xFF42D468)
                              : const Color(0xFF9AA4B8),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        profile.availability,
                        style: TextStyle(
                          color: astrologer.isOnline
                              ? const Color(0xFF8FE6A6)
                              : AppColors.muted,
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
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InformationCard(
                  children: [
                    _DetailRow(
                      icon: Icons.star_rounded,
                      label: 'Rating',
                      value: astrologer.rating > 0
                          ? '${astrologer.ratingLabel} / 5'
                          : 'New astrologer',
                    ),
                    _DetailRow(
                      icon: Icons.workspace_premium_rounded,
                      label: 'Experience',
                      value: astrologer.experienceLabel,
                    ),
                    _DetailRow(
                      icon: Icons.translate_rounded,
                      label: 'Languages',
                      value: astrologer.languageLabel,
                    ),
                    _DetailRow(
                      icon: Icons.currency_rupee_rounded,
                      label: 'Consultation',
                      value: astrologer.priceLabel,
                      isLast: true,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text(
                  'About',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0x667A8BB8)),
                  ),
                  child: Text(
                    astrologer.bio?.isNotEmpty == true
                        ? astrologer.bio!
                        : 'Biography not provided.',
                    style: const TextStyle(
                      color: AppColors.muted,
                      height: 1.55,
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                AstrologerDetailExtras(
                  astrologer: astrologer,
                  onAstrologerTap: (astrologerId) {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            AstrologerDetailScreen(astrologerId: astrologerId),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 26),
                const Text(
                  'Consultation Options',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap:
                      profile.astrologer.isOnline &&
                          profile.consultationOptions.chat
                      ? () => _openConfirmation(profile, ConsultationMode.chat)
                      : null,
                  child: _ConsultationOption(
                    icon: Icons.chat_bubble_rounded,
                    label: 'Chat Consultation',
                    available: profile.consultationOptions.chat,
                  ),
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap:
                      profile.astrologer.isOnline &&
                          profile.consultationOptions.audioCall
                      ? () => _openConfirmation(profile, ConsultationMode.audio)
                      : null,
                  child: _ConsultationOption(
                    icon: Icons.call_rounded,
                    label: 'Audio Consultation',
                    available: profile.consultationOptions.audioCall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomConsultationButton extends StatelessWidget {
  const _BottomConsultationButton({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primary,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool primary;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(17),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            gradient: enabled
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: primary
                        ? const [Color(0xFFF4C45E), Color(0xFFDDA83D)]
                        : const [AppColors.surfaceLight, AppColors.surface],
                  )
                : const LinearGradient(
                    colors: [AppColors.surfaceLight, AppColors.surface],
                  ),
            borderRadius: BorderRadius.circular(17),
            border: Border.all(
              color: enabled
                  ? (primary
                        ? const Color(0xFFF8D982)
                        : const Color(0x557A8BB8))
                  : const Color(0x337A8BB8),
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color: enabled
                    ? (primary ? AppColors.background : AppColors.gold)
                    : AppColors.muted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: enabled
                            ? (primary ? AppColors.background : AppColors.white)
                            : AppColors.muted,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      enabled ? subtitle : 'Unavailable',
                      style: TextStyle(
                        color: enabled
                            ? (primary ? AppColors.border : AppColors.muted)
                            : AppColors.muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 13,
                color: enabled
                    ? (primary ? AppColors.background : AppColors.gold)
                    : AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InformationCard extends StatelessWidget {
  const _InformationCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.background, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x557A8BB8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 15),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: Color(0x337A8BB8))),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0x18F4C45E),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: const Color(0x337A8BB8)),
            ),
            child: Icon(icon, color: AppColors.gold, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsultationOption extends StatelessWidget {
  const _ConsultationOption({
    required this.icon,
    required this.label,
    required this.available,
  });

  final IconData icon;
  final String label;
  final bool available;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: available
              ? const [AppColors.background, AppColors.surfaceLight]
              : const [AppColors.background, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(19),
        border: Border.all(
          color: available ? const Color(0x6652D273) : const Color(0x447A8BB8),
          width: 1.2,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: available
                  ? const Color(0x18F4C45E)
                  : const Color(0x147A8BB8),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              icon,
              color: available ? AppColors.gold : AppColors.muted,
              size: 21,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  available
                      ? 'Ready for consultation'
                      : 'Currently unavailable',
                  style: TextStyle(
                    color: available
                        ? const Color(0xFF8FE6A6)
                        : AppColors.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: available
                  ? const Color(0x183FD468)
                  : const Color(0x147A8BB8),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              available ? 'Available' : 'Unavailable',
              style: TextStyle(
                color: available ? const Color(0xFF7FE39A) : AppColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
      ),
    );
  }
}
