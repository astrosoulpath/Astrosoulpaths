import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../auth/data/auth_session_store.dart';

/// Presentation only. The session must come from authenticated backend restore.
class CustomerEmailAddress extends StatelessWidget {
  const CustomerEmailAddress({
    super.key,
    required this.session,
    this.asField = false,
    this.style,
    this.decoration,
  });

  final StoredAuthSession? session;
  final bool asField;
  final TextStyle? style;
  final InputDecoration? decoration;

  static String emailOf(StoredAuthSession? session) {
    if (session == null ||
        session.user['id']?.toString().trim().isNotEmpty != true) {
      return 'Email unavailable';
    }
    final email = session.user['email'];
    return email is String && email.trim().isNotEmpty
        ? email.trim()
        : 'Email unavailable';
  }

  static bool isVerified(StoredAuthSession? session) {
    if (session?.authProvider == 'asp-context') {
      return session!.user['isEmailVerified'] == true &&
          emailOf(session) != 'Email unavailable';
    }
    if (session == null || session.authProvider != 'firebase') return false;
    try {
      // Display metadata only; authentication remains enforced by session restore.
      final claims =
          jsonDecode(
                utf8.decode(
                  base64Url.decode(
                    base64Url.normalize(session.accessToken.split('.')[1]),
                  ),
                ),
              )
              as Map<String, dynamic>;
      final email = session.user['email'];
      return email is String &&
          email.trim().isNotEmpty &&
          claims['email_verified'] == true &&
          claims['email'] is String &&
          (claims['email'] as String).trim().toLowerCase() ==
              email.trim().toLowerCase();
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = emailOf(session);
    if (!asField) {
      return Text(
        email,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }
    return TextFormField(
      key: ValueKey('customer-email-$email'),
      initialValue: email,
      readOnly: true,
      decoration: (decoration ?? const InputDecoration()).copyWith(
        labelText: 'Email Address',
        prefixIcon: const Icon(Icons.email_outlined),
        suffixIcon: isVerified(session)
            ? const Tooltip(
                message: 'Verified email',
                child: Icon(Icons.verified_rounded, color: Colors.green),
              )
            : null,
      ),
    );
  }
}
