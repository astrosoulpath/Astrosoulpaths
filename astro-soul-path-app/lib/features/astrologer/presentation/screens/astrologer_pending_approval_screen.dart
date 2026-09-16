import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class AstrologerPendingApprovalScreen extends StatelessWidget {
  const AstrologerPendingApprovalScreen({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(26),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0x44F4C45E)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 76,
                      height: 76,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0x18F4C45E),
                      ),
                      child: const Icon(
                        Icons.hourglass_top_rounded,
                        size: 38,
                        color: AppColors.gold,
                      ),
                    ),
                    const SizedBox(height: 22),
                    const Text(
                      'Application under review',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      message?.trim().isNotEmpty == true
                          ? message!.trim()
                          : 'Your astrologer application has been submitted successfully.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.muted,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Our admin team will verify your profile and documents. '
                      'Your astrologer dashboard will become available only after approval.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.white, height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0x11000000),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.verified_user_outlined,
                            color: AppColors.gold,
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'After approval, use Astrologer Login with the same mobile number.',
                              style: TextStyle(
                                color: AppColors.muted,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          Navigator.of(
                            context,
                          ).popUntil((route) => route.isFirst);
                        },
                        child: const Text('Back to login'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
