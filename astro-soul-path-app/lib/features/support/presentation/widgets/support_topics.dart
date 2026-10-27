import 'package:flutter/material.dart';
import '../../data/support_catalogue.dart';

class SupportTopics extends StatelessWidget {
  const SupportTopics({
    super.key,
    required this.catalogue,
    required this.onQuestion,
    this.busy = false,
  });
  final SupportCatalogue catalogue;
  final bool busy;
  final void Function(String category, SupportQuestion question) onQuestion;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          catalogue.welcome,
          style: const TextStyle(
            fontSize: 17,
            color: Color(0xFF35204F),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      if (!catalogue.visible)
        const Padding(
          padding: EdgeInsets.all(12),
          child: Text(
            'AI Support is unavailable. You can still use Human Support.',
          ),
        ),
      for (final category in catalogue.categories)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: const BorderSide(color: Color(0xFFE4D3AF)),
            ),
            child: ExpansionTile(
              key: PageStorageKey('support-${category.id}'),
              title: Text(
                category.title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF35204F),
                ),
              ),
              leading: Icon(switch (category.id) {
                'payment' => Icons.account_balance_wallet_outlined,
                'consultation' => Icons.headset_mic_outlined,
                _ => Icons.manage_accounts_outlined,
              }, color: const Color(0xFF916F2A)),
              childrenPadding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
              children: [
                for (final q in category.questions)
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        alignment: Alignment.centerLeft,
                        minimumSize: const Size(48, 48),
                      ),
                      onPressed: busy ? null : () => onQuestion(category.id, q),
                      child: Text(q.text),
                    ),
                  ),
              ],
            ),
          ),
        ),
    ],
  );
}
