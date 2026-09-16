import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/marketplace_seller_api.dart';

class MarketplaceProductFormScreen extends StatefulWidget {
  const MarketplaceProductFormScreen({super.key, this.product});

  final Map<String, dynamic>? product;

  bool get isEditing => product != null;

  @override
  State<MarketplaceProductFormScreen> createState() =>
      _MarketplaceProductFormScreenState();
}

class _MarketplaceProductFormScreenState
    extends State<MarketplaceProductFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final MarketplaceSellerApi _api = MarketplaceSellerApi();
  final ImagePicker _imagePicker = ImagePicker();

  final List<XFile> _selectedImages = <XFile>[];

  late final TextEditingController _nameController;
  late final TextEditingController _skuController;
  late final TextEditingController _shortDescriptionController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _mrpController;
  late final TextEditingController _sellingPriceController;
  late final TextEditingController _stockController;
  late final TextEditingController _lowStockController;
  late final TextEditingController _shippingController;
  late final TextEditingController _weightController;

  List<Map<String, dynamic>> _categories = const <Map<String, dynamic>>[];
  String? _selectedCategoryId;

  bool _loadingCategories = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();

    final product = widget.product;

    _nameController = TextEditingController(text: _text(product?['name']));

    _skuController = TextEditingController(text: _text(product?['sku']));

    _shortDescriptionController = TextEditingController(
      text: _text(product?['shortDescription']),
    );

    _descriptionController = TextEditingController(
      text: _text(product?['description']),
    );

    _mrpController = TextEditingController(text: _text(product?['mrp']));

    _sellingPriceController = TextEditingController(
      text: _text(product?['sellingPrice']),
    );

    _stockController = TextEditingController(text: _text(product?['stock']));

    _lowStockController = TextEditingController(
      text: _text(product?['lowStockThreshold']),
    );

    _shippingController = TextEditingController(
      text: _text(product?['shippingCharge']),
    );

    _weightController = TextEditingController(
      text: _text(product?['weightGrams']),
    );

    _selectedCategoryId = _text(product?['categoryId']);

    if (_selectedCategoryId!.isEmpty) {
      final category = product?['category'];

      if (category is Map) {
        _selectedCategoryId = _text(category['id']);
      }
    }

    _loadCategories();
  }

  String _text(dynamic value) {
    return value?.toString().trim() ?? '';
  }

  @override
  void dispose() {
    _api.dispose();
    _nameController.dispose();
    _skuController.dispose();
    _shortDescriptionController.dispose();
    _descriptionController.dispose();
    _mrpController.dispose();
    _sellingPriceController.dispose();
    _stockController.dispose();
    _lowStockController.dispose();
    _shippingController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await _api.getCategories();

      if (!mounted) {
        return;
      }

      setState(() {
        _categories = categories;
        _loadingCategories = false;
      });
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loadingCategories = false;
        _error = error.message;
      });
    }
  }

  String? _requiredText(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Required';
    }

    return null;
  }

  double? _parseDouble(String value) {
    return double.tryParse(value.trim());
  }

  int? _parseInt(String value) {
    return int.tryParse(value.trim());
  }

  int get _existingImageCount {
    final images = widget.product?['images'];

    if (images is List) {
      return images.length;
    }

    return 0;
  }

  int get _remainingImageSlots {
    final remaining = 8 - _existingImageCount - _selectedImages.length;

    return remaining < 0 ? 0 : remaining;
  }

  Future<void> _pickGalleryImages() async {
    if (_saving) {
      return;
    }

    if (_remainingImageSlots <= 0) {
      setState(() {
        _error = 'Maximum 8 product images are allowed.';
      });
      return;
    }

    try {
      final images = await _imagePicker.pickMultiImage(
        imageQuality: 88,
        maxWidth: 1800,
        maxHeight: 1800,
      );

      if (images.isEmpty || !mounted) {
        return;
      }

      final available = 8 - _existingImageCount - _selectedImages.length;

      final accepted = images.take(available).toList();

      setState(() {
        _selectedImages.addAll(accepted);

        if (images.length > accepted.length) {
          _error =
              'Only 8 images are allowed. Extra selected images were ignored.';
        } else {
          _error = null;
        }
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to open gallery.';
      });
    }
  }

  Future<void> _takePhoto() async {
    if (_saving) {
      return;
    }

    if (_remainingImageSlots <= 0) {
      setState(() {
        _error = 'Maximum 8 product images are allowed.';
      });
      return;
    }

    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 88,
        maxWidth: 1800,
        maxHeight: 1800,
      );

      if (image == null || !mounted) {
        return;
      }

      setState(() {
        _selectedImages.add(image);
        _error = null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to open camera.';
      });
    }
  }

  void _removeSelectedImage(int index) {
    if (_saving) {
      return;
    }

    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  Future<void> _uploadSelectedImages(String productId) async {
    for (final image in _selectedImages) {
      await _api.uploadProductImage(productId: productId, filePath: image.path);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final categoryId = _selectedCategoryId?.trim() ?? '';

    if (categoryId.isEmpty) {
      setState(() {
        _error = 'Please select an active category.';
      });
      return;
    }

    final mrp = _parseDouble(_mrpController.text);
    final sellingPrice = _parseDouble(_sellingPriceController.text);
    final stock = _parseInt(_stockController.text);

    if (mrp == null || mrp <= 0) {
      setState(() {
        _error = 'Enter a valid MRP.';
      });
      return;
    }

    if (sellingPrice == null || sellingPrice <= 0) {
      setState(() {
        _error = 'Enter a valid selling price.';
      });
      return;
    }

    if (sellingPrice > mrp) {
      setState(() {
        _error = 'Selling price cannot exceed MRP.';
      });
      return;
    }

    if (stock == null || stock < 0) {
      setState(() {
        _error = 'Enter valid stock.';
      });
      return;
    }

    int? lowStockThreshold;
    double? shippingCharge;
    int? weightGrams;

    if (_lowStockController.text.trim().isNotEmpty) {
      lowStockThreshold = _parseInt(_lowStockController.text);

      if (lowStockThreshold == null || lowStockThreshold < 0) {
        setState(() {
          _error = 'Low stock threshold must be 0 or more.';
        });
        return;
      }
    }

    if (_shippingController.text.trim().isNotEmpty) {
      shippingCharge = _parseDouble(_shippingController.text);

      if (shippingCharge == null || shippingCharge < 0) {
        setState(() {
          _error = 'Shipping charge must be 0 or more.';
        });
        return;
      }
    }

    if (_weightController.text.trim().isNotEmpty) {
      weightGrams = _parseInt(_weightController.text);

      if (weightGrams == null || weightGrams < 1) {
        setState(() {
          _error = 'Weight must be at least 1 gram.';
        });
        return;
      }
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      if (widget.isEditing) {
        final changes = <String, dynamic>{
          'categoryId': categoryId,
          'name': _nameController.text.trim(),
          'sku': _skuController.text.trim(),
          'shortDescription': _shortDescriptionController.text.trim(),
          'description': _descriptionController.text.trim(),
          'mrp': mrp,
          'sellingPrice': sellingPrice,
          'stock': stock,
        };

        if (lowStockThreshold != null) {
          changes['lowStockThreshold'] = lowStockThreshold;
        }

        if (shippingCharge != null) {
          changes['shippingCharge'] = shippingCharge;
        }

        if (weightGrams != null) {
          changes['weightGrams'] = weightGrams;
        }

        final productId = widget.product!['id'].toString();

        await _api.updateProduct(productId: productId, changes: changes);

        if (_selectedImages.isNotEmpty) {
          await _uploadSelectedImages(productId);
        }
      } else {
        final createdProduct = await _api.createProduct(
          categoryId: categoryId,
          name: _nameController.text.trim(),
          sku: _skuController.text.trim(),
          mrp: mrp,
          sellingPrice: sellingPrice,
          stock: stock,
          shortDescription: _shortDescriptionController.text.trim(),
          description: _descriptionController.text.trim(),
          lowStockThreshold: lowStockThreshold,
          shippingCharge: shippingCharge,
          weightGrams: weightGrams,
        );

        final productId = createdProduct['id']?.toString().trim() ?? '';

        if (productId.isEmpty) {
          throw const MarketplaceSellerApiException(
            'Product was created but product ID was not returned.',
          );
        }

        if (_selectedImages.isNotEmpty) {
          await _uploadSelectedImages(productId);
        }
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _saving = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final validSelectedCategory =
        _selectedCategoryId != null &&
        _categories.any(
          (category) => category['id']?.toString() == _selectedCategoryId,
        );

    return Scaffold(
      backgroundColor: const Color(0xFF090909),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090909),
        foregroundColor: AppColors.white,
        title: Text(
          widget.isEditing ? 'Edit Product' : 'Create Product',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF151515),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Product Photos',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Add real photos from gallery or camera. Maximum 8 images.',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.65),
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (widget.product?['images'] is List &&
                      (widget.product!['images'] as List).isNotEmpty) ...[
                    const Text(
                      'Uploaded photos',
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 92,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: (widget.product!['images'] as List).length,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (context, index) {
                          final raw =
                              (widget.product!['images'] as List)[index];

                          final image = raw is Map
                              ? Map<String, dynamic>.from(raw)
                              : <String, dynamic>{};

                          final imageUrl =
                              image['imageUrl']?.toString().trim() ?? '';

                          return ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: SizedBox(
                              width: 92,
                              height: 92,
                              child: imageUrl.isEmpty
                                  ? Container(
                                      color: const Color(0xFF222222),
                                      child: const Icon(
                                        Icons.image_not_supported_outlined,
                                        color: Colors.white54,
                                      ),
                                    )
                                  : Image.network(
                                      imageUrl,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) => Container(
                                        color: const Color(0xFF222222),
                                        child: const Icon(
                                          Icons.broken_image_outlined,
                                          color: Colors.white54,
                                        ),
                                      ),
                                    ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  if (_selectedImages.isNotEmpty) ...[
                    const Text(
                      'New photos',
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 104,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _selectedImages.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (context, index) {
                          return Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: SizedBox(
                                  width: 96,
                                  height: 96,
                                  child: Image.file(
                                    File(_selectedImages[index].path),
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: Material(
                                  color: Colors.black87,
                                  shape: const CircleBorder(),
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: _saving
                                        ? null
                                        : () => _removeSelectedImage(index),
                                    child: const Padding(
                                      padding: EdgeInsets.all(5),
                                      child: Icon(
                                        Icons.close,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _saving || _remainingImageSlots <= 0
                              ? null
                              : _pickGalleryImages,
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Gallery'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _saving || _remainingImageSlots <= 0
                              ? null
                              : _takePhoto,
                          icon: const Icon(Icons.camera_alt_outlined),
                          label: const Text('Camera'),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 8),

                  Text(
                    '${_existingImageCount + _selectedImages.length}/8 images selected',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.55),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),
            if (_loadingCategories)
              const LinearProgressIndicator()
            else if (_categories.isEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF151515),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'No active marketplace categories are available. Please contact admin.',
                  style: TextStyle(color: AppColors.white, height: 1.4),
                ),
              )
            else
              DropdownButtonFormField<String>(
                initialValue: validSelectedCategory
                    ? _selectedCategoryId
                    : null,
                dropdownColor: const Color(0xFF151515),
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories
                    .map(
                      (category) => DropdownMenuItem<String>(
                        value: category['id']?.toString(),
                        child: Text(category['name']?.toString() ?? ''),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) {
                  setState(() {
                    _selectedCategoryId = value;
                  });
                },
              ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _nameController,
              validator: _requiredText,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Product name'),
            ),
            TextFormField(
              controller: _skuController,
              validator: _requiredText,
              maxLength: 100,
              decoration: const InputDecoration(labelText: 'SKU'),
            ),
            TextFormField(
              controller: _shortDescriptionController,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'Short description'),
            ),
            TextFormField(
              controller: _descriptionController,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Description',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _mrpController,
              validator: _requiredText,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'MRP'),
            ),
            TextFormField(
              controller: _sellingPriceController,
              validator: _requiredText,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Selling price'),
            ),
            TextFormField(
              controller: _stockController,
              validator: _requiredText,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Stock'),
            ),
            TextFormField(
              controller: _lowStockController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Low stock threshold',
              ),
            ),
            TextFormField(
              controller: _shippingController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Shipping charge'),
            ),
            TextFormField(
              controller: _weightController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Weight in grams'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(
                _error!,
                style: const TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 22),
            FilledButton.icon(
              onPressed: _saving || _loadingCategories || _categories.isEmpty
                  ? null
                  : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(
                _saving
                    ? 'Saving...'
                    : widget.isEditing
                    ? 'Save changes'
                    : 'Create draft',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
