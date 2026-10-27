import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';

String _displayLocale(String code) => code == 'hi-Latn'
    ? 'en_IN'
    : code == 'hi'
    ? 'hi_IN'
    : code == 'auto'
    ? 'en'
    : code.replaceAll('-', '_');

Future<void> prepareAiChatFormats(String code) =>
    initializeDateFormatting(_displayLocale(code));

/// Presentation only. Never parse this value back into accounting or convert FX.
String formatAiMoney(num amount, String currency, String language) {
  final code = currency.trim().toUpperCase();
  if (!amount.isFinite || !RegExp(r'^[A-Z]{3}$').hasMatch(code)) return '—';
  return NumberFormat.currency(
    locale: _displayLocale(language),
    name: code,
    symbol: code,
  ).format(amount);
}

String formatAiNumber(num value, String language) =>
    NumberFormat.decimalPattern(_displayLocale(language)).format(value);

/// Keeps the supplied calendar date; does not shift a birth date across zones.
String formatAiDate(DateTime date, String language) =>
    DateFormat.yMMMd(_displayLocale(language)).format(date);
