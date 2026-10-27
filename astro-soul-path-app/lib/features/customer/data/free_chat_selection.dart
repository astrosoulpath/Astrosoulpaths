import '../../astrologers/data/public_astrologer.dart';

List<PublicAstrologer> selectFreeChatAstrologers(
  List<PublicAstrologer> records,
  int sessionOffset,
) {
  final seen = <String>{};
  final eligible =
      records
          .where(
            (a) =>
                a.id.trim().isNotEmpty &&
                a.isVerified &&
                a.isOnline &&
                !a.isBusy &&
                seen.add(a.id),
          )
          .toList()
        ..sort((a, b) => a.id.compareTo(b.id));
  if (eligible.isEmpty) return const [];
  final offset = sessionOffset % eligible.length;
  return List.generate(
    eligible.length > 5 ? 5 : eligible.length,
    (i) => eligible[(offset + i) % eligible.length],
    growable: false,
  );
}
