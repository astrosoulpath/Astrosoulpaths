import 'package:flutter/material.dart';

class BackendAvatar extends StatelessWidget {
  const BackendAvatar({
    super.key,
    required this.name,
    required this.imageUrl,
    required this.size,
    this.fallbackText,
  });

  final String name;
  final String? imageUrl;
  final double size;
  final String? fallbackText;

  String get _fallback {
    final custom = fallbackText?.trim();

    if (custom != null && custom.isNotEmpty) {
      return custom;
    }

    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((e) => e.isNotEmpty)
        .toList();

    if (parts.isEmpty) {
      return 'A';
    }

    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }

    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  bool get _validUrl {
    final value = imageUrl?.trim();

    if (value == null || value.isEmpty) {
      return false;
    }

    final uri = Uri.tryParse(value);

    return uri != null &&
        (uri.scheme == 'http' || uri.scheme == 'https') &&
        uri.host.isNotEmpty;
  }

  Widget _fallbackWidget() {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFF171717),
      ),
      child: Text(
        _fallback,
        style: TextStyle(
          color: const Color(0xFFFFD400),
          fontWeight: FontWeight.w900,
          fontSize: size * 0.30,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_validUrl) {
      return _fallbackWidget();
    }

    return ClipOval(
      child: Image.network(
        imageUrl!.trim(),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _fallbackWidget(),
        loadingBuilder: (context, child, progress) {
          if (progress == null) {
            return child;
          }

          return _fallbackWidget();
        },
      ),
    );
  }
}
