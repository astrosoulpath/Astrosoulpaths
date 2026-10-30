import 'package:flutter/material.dart';
import '../../../../core/theme/cosmic_ivory.dart';
import '../../data/public_astrologer.dart';

class CosmicAstrologerHero extends StatelessWidget {
  const CosmicAstrologerHero({
    required this.astrologer,
    required this.availability,
    required this.follow,
    super.key,
  });
  final PublicAstrologer astrologer;
  final String availability;
  final Widget follow;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
    ),
    child: CustomPaint(
      painter: const _CelestialCorners(),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.auto_awesome_outlined,
                color: Theme.of(context).colorScheme.primary,
                size: 18,
              ),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'ASTRO SOUL PATH',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    letterSpacing: 2,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          CosmicAvatar(astrologer: astrologer, size: 104),
          const SizedBox(height: 18),
          Text(
            astrologer.name,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 27,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (astrologer.isVerified) ...[
            const SizedBox(height: 6),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Icon(
                  Icons.verified_outlined,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                SizedBox(width: 6),
                Text(
                  'Verified astrologer',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          Text(
            astrologer.primaryExpertise,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 15,
              height: 1.5,
            ),
          ),
          follow,
          const SizedBox(height: 12),
          Text(
            availability,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: astrologer.isOnline && !astrologer.isBusy
                  ? CosmicIvory.success
                  : Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

class CosmicAvatar extends StatelessWidget {
  const CosmicAvatar({required this.astrologer, this.size = 60, super.key});
  final PublicAstrologer astrologer;
  final double size;
  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        astrologer.name.isEmpty
            ? 'A'
            : astrologer.name.characters.first.toUpperCase(),
        style: TextStyle(
          color: Theme.of(context).colorScheme.primary,
          fontSize: size * .35,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: CosmicIvory.gold, width: 1.5),
        color: Theme.of(context).colorScheme.surface,
      ),
      child: ClipOval(
        child: astrologer.avatarUrl?.isNotEmpty == true
            ? Image.network(
                astrologer.avatarUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
              )
            : fallback,
      ),
    );
  }
}

class CosmicSimilarAstrologer extends StatelessWidget {
  const CosmicSimilarAstrologer({
    required this.astrologer,
    required this.onTap,
    super.key,
  });
  final PublicAstrologer astrologer;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: Semantics(
      button: true,
      label: 'View ${astrologer.name} profile',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            width: 210,
            padding: const EdgeInsets.all(16),
            decoration: CosmicIvory.card(context: context),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CosmicAvatar(astrologer: astrologer, size: 48),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        astrologer.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  astrologer.primaryExpertise,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  astrologer.experienceLabel,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    if (astrologer.rating > 0)
                      const Icon(
                        Icons.star_rounded,
                        size: 16,
                        color: CosmicIvory.gold,
                      ),
                    Text(
                      astrologer.ratingLabel,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (astrologer.isVerified)
                      Icon(
                        Icons.verified_outlined,
                        size: 16,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  astrologer.priceLabel,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  !astrologer.availabilityKnown
                      ? 'Availability not provided'
                      : astrologer.isOnline
                      ? (astrologer.isBusy ? 'Busy' : 'Online')
                      : 'Offline',
                  style: TextStyle(
                    color: astrologer.isOnline && !astrologer.isBusy
                        ? CosmicIvory.success
                        : Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _CelestialCorners extends CustomPainter {
  const _CelestialCorners();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = CosmicIvory.gold.withValues(alpha: .34)
      ..strokeWidth = 1;
    for (final origin in [Offset(4, 12), Offset(size.width - 28, 12)]) {
      final points = [
        origin,
        origin + const Offset(14, 18),
        origin + const Offset(4, 42),
        origin + const Offset(20, 58),
      ];
      for (var i = 0; i < points.length; i++) {
        canvas.drawCircle(points[i], i.isEven ? 2 : 1.5, paint);
        if (i > 0) canvas.drawLine(points[i - 1], points[i], paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _CelestialCorners oldDelegate) => false;
}
