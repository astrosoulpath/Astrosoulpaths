import 'package:flutter/material.dart';

import '../../data/marketplace_customer_api.dart';

class MarketplaceAddressScreen extends StatefulWidget {
  const MarketplaceAddressScreen({super.key});

  @override
  State<MarketplaceAddressScreen> createState() =>
      _MarketplaceAddressScreenState();
}

class _MarketplaceAddressScreenState extends State<MarketplaceAddressScreen> {
  static const _background = Color(0xFF090909);
  static const _surface = Color(0xFF151515);
  static const _gold = Color(0xFFF2C94C);
  static const _muted = Color(0xFF9A9A9A);

  final MarketplaceCustomerApi _api = MarketplaceCustomerApi();

  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final addresses = await _api.getAddresses();

      if (!mounted) return;

      setState(() {
        _addresses = addresses;
        _loading = false;
      });
    } on MarketplaceCustomerApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _openForm([Map<String, dynamic>? existing]) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _AddressFormDialog(api: _api, existing: existing),
    );

    if (result == true) {
      await _load();
    }
  }

  Future<void> _setDefault(String id) async {
    try {
      await _api.setDefaultAddress(addressId: id);
      await _load();
    } on MarketplaceCustomerApiException catch (error) {
      _message(error.message);
    }
  }

  Future<void> _delete(String id) async {
    try {
      await _api.deleteAddress(addressId: id);
      await _load();
    } on MarketplaceCustomerApiException catch (error) {
      _message(error.message);
    }
  }

  void _message(String text) {
    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _background,
      appBar: AppBar(
        backgroundColor: _background,
        foregroundColor: Colors.white,
        title: const Text('Delivery Addresses'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: _gold,
        foregroundColor: Colors.black,
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add Address'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: _gold));
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Text(_error, style: const TextStyle(color: Colors.white)),
      );
    }

    if (_addresses.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Text(
            'No delivery address saved yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _muted),
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: _gold,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        itemCount: _addresses.length,
        itemBuilder: (_, index) {
          final address = _addresses[index];
          final id = _text(address['id']);
          final isDefault = address['isDefault'] == true;

          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDefault
                    ? _gold.withValues(alpha: 0.6)
                    : Colors.white.withValues(alpha: 0.07),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _text(address['fullName']),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (isDefault) const Chip(label: Text('Default')),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _addressText(address),
                  style: const TextStyle(color: _muted, height: 1.45),
                ),
                const SizedBox(height: 6),
                Text(
                  _text(address['phone']),
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  children: [
                    TextButton.icon(
                      onPressed: () => _openForm(address),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit'),
                    ),
                    if (!isDefault)
                      TextButton.icon(
                        onPressed: id.isEmpty ? null : () => _setDefault(id),
                        icon: const Icon(Icons.check_circle_outline),
                        label: const Text('Set Default'),
                      ),
                    TextButton.icon(
                      onPressed: id.isEmpty ? null : () => _delete(id),
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Delete'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _addressText(Map<String, dynamic> address) {
    final parts = <String>[
      _text(address['addressLine1']),
      _text(address['addressLine2']),
      _text(address['landmark']),
      _text(address['city']),
      _text(address['state']),
      _text(address['postalCode']),
      _text(address['country']),
    ].where((item) => item.isNotEmpty).toList();

    return parts.join(', ');
  }

  String _text(dynamic value) => value?.toString().trim() ?? '';
}

class _AddressFormDialog extends StatefulWidget {
  const _AddressFormDialog({required this.api, this.existing});

  final MarketplaceCustomerApi api;
  final Map<String, dynamic>? existing;

  @override
  State<_AddressFormDialog> createState() => _AddressFormDialogState();
}

class _AddressFormDialogState extends State<_AddressFormDialog> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _line1;
  late final TextEditingController _line2;
  late final TextEditingController _landmark;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _postal;
  late final TextEditingController _country;

  bool _saving = false;

  @override
  void initState() {
    super.initState();

    final source = widget.existing ?? <String, dynamic>{};

    _name = TextEditingController(text: _text(source['fullName']));
    _phone = TextEditingController(text: _text(source['phone']));
    _line1 = TextEditingController(text: _text(source['addressLine1']));
    _line2 = TextEditingController(text: _text(source['addressLine2']));
    _landmark = TextEditingController(text: _text(source['landmark']));
    _city = TextEditingController(text: _text(source['city']));
    _state = TextEditingController(text: _text(source['state']));
    _postal = TextEditingController(text: _text(source['postalCode']));
    _country = TextEditingController(text: _text(source['country']));
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _phone,
      _line1,
      _line2,
      _landmark,
      _city,
      _state,
      _postal,
      _country,
    ]) {
      controller.dispose();
    }

    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) return;

    setState(() => _saving = true);

    try {
      final existingId = _text(widget.existing?['id']);

      if (existingId.isEmpty) {
        await widget.api.createAddress(
          fullName: _name.text,
          phone: _phone.text,
          addressLine1: _line1.text,
          addressLine2: _line2.text,
          landmark: _landmark.text,
          city: _city.text,
          state: _state.text,
          postalCode: _postal.text,
          country: _country.text,
        );
      } else {
        await widget.api.updateAddress(
          addressId: existingId,
          changes: <String, dynamic>{
            'fullName': _name.text.trim(),
            'phone': _phone.text.trim(),
            'addressLine1': _line1.text.trim(),
            'addressLine2': _line2.text.trim(),
            'landmark': _landmark.text.trim(),
            'city': _city.text.trim(),
            'state': _state.text.trim(),
            'postalCode': _postal.text.trim(),
            'country': _country.text.trim(),
          },
        );
      }

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on MarketplaceCustomerApiException catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null ? 'Add Address' : 'Edit Address'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              children: [
                _field(_name, 'Full name'),
                _field(_phone, 'Phone'),
                _field(_line1, 'Address line 1'),
                _field(_line2, 'Address line 2', required: false),
                _field(_landmark, 'Landmark', required: false),
                _field(_city, 'City'),
                _field(_state, 'State'),
                _field(_postal, 'Postal code'),
                _field(_country, 'Country'),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Saving...' : 'Save'),
        ),
      ],
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label),
        validator: required
            ? (value) {
                if (value == null || value.trim().isEmpty) {
                  return '$label is required';
                }
                return null;
              }
            : null,
      ),
    );
  }

  String _text(dynamic value) => value?.toString().trim() ?? '';
}
