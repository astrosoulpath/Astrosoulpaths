enum AuthPortal { customer, astrologer, joinAstrologer }

extension AuthPortalDetails on AuthPortal {
  String get eyebrow => switch (this) {
    AuthPortal.customer => 'CUSTOMER ACCESS',
    AuthPortal.astrologer => 'ASTROLOGER PARTNER',
    AuthPortal.joinAstrologer => 'PARTNER ONBOARDING',
  };

  String get title => switch (this) {
    AuthPortal.customer => 'Consult trusted astrologers',
    AuthPortal.astrologer => 'Welcome back, Astrologer',
    AuthPortal.joinAstrologer => 'Build your astrology practice',
  };

  String get subtitle => switch (this) {
    AuthPortal.customer =>
      'Login securely to start chat, call or video consultation.',
    AuthPortal.astrologer =>
      'Manage consultations, availability and your earnings.',
    AuthPortal.joinAstrologer =>
      'Verify your mobile number to begin your application.',
  };

  String get actionLabel => switch (this) {
    AuthPortal.customer => 'Continue as Customer',
    AuthPortal.astrologer => 'Astrologer Login',
    AuthPortal.joinAstrologer => 'Verify & Continue',
  };
}
