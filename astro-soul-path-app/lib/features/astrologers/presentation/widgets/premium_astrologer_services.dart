import 'package:flutter/material.dart';
import '../../../../core/branding/premium_customer_surfaces.dart';
import '../../data/public_astrologer.dart';

class PremiumAstrologerServices extends StatelessWidget {
  const PremiumAstrologerServices({super.key, required this.profile});
  final PublicAstrologerProfile profile;

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, String)>[
      (Icons.schedule_rounded, 'Availability', profile.availability),
      (
        Icons.currency_rupee_rounded,
        'Consultation Rate',
        profile.astrologer.pricePerMin > 0
            ? profile.astrologer.priceLabel
            : 'Rate unavailable',
      ),
      (
        Icons.chat_bubble_rounded,
        'Chat Consultation',
        profile.canRequestChat ? 'Available' : 'Unavailable',
      ),
      (
        Icons.call_rounded,
        'Audio Call',
        profile.canRequestAudio ? 'Available' : 'Unavailable',
      ),
    ];
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: premiumIvory,
        border: Border.all(color: premiumBorder),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Consultation Services',
            style: TextStyle(
              color: premiumInk,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Choose how you would like to connect.',
            style: TextStyle(color: premiumMuted, fontSize: 15, height: 1.5),
          ),
          for (var index = 0; index < items.length; index++) ...[
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(items[index].$1, color: premiumGold),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        items[index].$2,
                        style: const TextStyle(
                          color: premiumInk,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        items[index].$3,
                        style: const TextStyle(
                          color: premiumMuted,
                          fontSize: 15,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (index < items.length - 1)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Divider(height: 1, color: premiumBorder),
              ),
          ],
        ],
      ),
    );
  }
}
