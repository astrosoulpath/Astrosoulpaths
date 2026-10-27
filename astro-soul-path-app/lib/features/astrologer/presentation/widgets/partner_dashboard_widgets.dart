import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

String partnerRatingLabel(dynamic rating) {
  final value = num.tryParse(rating?.toString() ?? '');
  return value == null || !value.isFinite || value <= 0
      ? 'No ratings yet'
      : 'Rating: ${value.toStringAsFixed(1)}';
}

class PartnerIconTile extends StatelessWidget {
  const PartnerIconTile({
    super.key,
    required this.icon,
    this.color = AppColors.purpleSoft,
  });
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(icon, color: AppColors.purple, size: 22),
  );
}

class PartnerQuickActions extends StatelessWidget {
  const PartnerQuickActions({super.key, required this.tools});
  final List<PartnerToolCard> tools;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      const labels = {
        'Consultations': 'Consult',
        'Go Live': 'Go Live',
        'Availability': 'Schedule',
        'Earnings': 'Earnings',
      };
      const colors = [
        AppColors.purpleSoft,
        Color(0xFFFCE8F0),
        Color(0xFFFFEBDC),
        Color(0xFFE3F4ED),
      ];
      final columns =
          constraints.maxWidth >= 340 &&
              MediaQuery.textScalerOf(context).scale(14) <= 21
          ? 4
          : 2;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final entry in labels.entries)
            if (tools.any((tool) => tool.title == entry.key))
              SizedBox(
                width: (constraints.maxWidth - 10 * (columns - 1)) / columns,
                child: Builder(
                  builder: (context) {
                    final tool = tools.firstWhere(
                      (tool) => tool.title == entry.key,
                    );
                    return Material(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        onTap: tool.onTap,
                        borderRadius: BorderRadius.circular(14),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 12,
                            horizontal: 6,
                          ),
                          child: Column(
                            children: [
                              PartnerIconTile(
                                icon: tool.icon,
                                color:
                                    colors[labels.keys.toList().indexOf(
                                      entry.key,
                                    )],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                entry.value,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.navy,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
        ],
      );
    },
  );
}

class PartnerCard extends StatelessWidget {
  const PartnerCard({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.border),
    ),
    child: child,
  );
}

class PartnerGrid extends StatelessWidget {
  const PartnerGrid({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final single =
          constraints.maxWidth < 300 ||
          MediaQuery.textScalerOf(context).scale(14) > 21;
      final width = single
          ? constraints.maxWidth
          : (constraints.maxWidth - 12) / 2;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final child in children) SizedBox(width: width, child: child),
        ],
      );
    },
  );
}

class PartnerMetric extends StatelessWidget {
  const PartnerMetric({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label, value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => PartnerCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PartnerIconTile(icon: icon),
        const SizedBox(height: 10),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.navy,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ],
    ),
  );
}

class PartnerToolCard extends StatelessWidget {
  const PartnerToolCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onTap != null,
    child: Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  PartnerIconTile(icon: icon),
                  const Spacer(),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: onTap == null ? AppColors.border : AppColors.muted,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
