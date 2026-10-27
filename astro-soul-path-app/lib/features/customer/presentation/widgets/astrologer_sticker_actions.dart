import 'package:flutter/material.dart';

/// Opens the existing profile/consultation entry point, never starts charging.
class AstrologerStickerActions extends StatelessWidget {
  const AstrologerStickerActions({
    super.key,
    required this.onChat,
    required this.onCall,
    this.lightSurface = false,
  });
  final VoidCallback? onChat, onCall;
  final bool lightSurface;
  @override
  Widget build(BuildContext context) {
    final chat = Tooltip(
      message: 'Open profile to choose chat consultation',
      child: OutlinedButton(
        onPressed: onChat,
        style: OutlinedButton.styleFrom(
          foregroundColor: lightSurface
              ? const Color(0xFF493052)
              : const Color(0xFFFFF4DC),
          disabledForegroundColor: const Color(0xFFB1A894),
          side: const BorderSide(color: Color(0xFFCAB0E9)),
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          textStyle: const TextStyle(fontSize: 11),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.chat_bubble_outline, size: 13),
            SizedBox(width: 3),
            Flexible(child: Text('Chat')),
          ],
        ),
      ),
    );
    final call = Tooltip(
      message: 'Open profile to choose audio consultation',
      child: FilledButton(
        onPressed: onCall,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFFFD66B),
          foregroundColor: const Color(0xFF26113A),
          disabledBackgroundColor: const Color(0xFF51415C),
          disabledForegroundColor: const Color(0xFFB1A894),
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          textStyle: const TextStyle(fontSize: 11),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.call_outlined, size: 13),
            SizedBox(width: 3),
            Flexible(child: Text('Call')),
          ],
        ),
      ),
    );
    if (MediaQuery.textScalerOf(context).scale(11) > 15) {
      return GestureDetector(
        onTap: () {},
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [chat, const SizedBox(height: 4), call],
        ),
      );
    }
    return GestureDetector(
      onTap: () {},
      child: Row(
        children: [
          Expanded(child: chat),
          const SizedBox(width: 6),
          Expanded(child: call),
        ],
      ),
    );
  }
}
