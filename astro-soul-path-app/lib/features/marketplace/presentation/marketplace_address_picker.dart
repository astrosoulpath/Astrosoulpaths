import 'package:flutter/material.dart';

/// Only selects an existing backend-owned address. Eligibility and final totals
/// remain server-authoritative; dismissal never starts checkout.
class MarketplaceAddressPicker extends StatelessWidget {
  const MarketplaceAddressPicker({super.key, required this.addresses});
  final List<Map<String, dynamic>> addresses;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .75,
      ),
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Choose delivery address',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          for (final address in addresses)
            ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: Text(address['fullName']?.toString() ?? ''),
              subtitle: Text(
                ['addressLine1', 'city', 'state', 'postalCode', 'country']
                    .map((key) => address[key]?.toString() ?? '')
                    .where((s) => s.isNotEmpty)
                    .join(', '),
              ),
              trailing: address['isDefault'] == true
                  ? const Text('Default')
                  : null,
              onTap: (address['id']?.toString().trim() ?? '').isEmpty
                  ? null
                  : () => Navigator.of(context).pop(address),
            ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ],
      ),
    ),
  );
}
