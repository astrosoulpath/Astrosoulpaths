/// Presentation portal/role must never disguise a canonical Admin identity.
bool isAdminInCustomerPortal(String portal, Map<String, dynamic> user) =>
    portal == 'customer' &&
    (user['accountRole'] ?? user['role'])?.toString().trim().toUpperCase() ==
        'ADMIN' &&
    user['authContext'] != 'customer';
