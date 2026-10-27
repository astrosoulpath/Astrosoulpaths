// Enable only after approved migration, security and device verification.
const supportOperationsUiEnabled = bool.fromEnvironment(
  'SUPPORT_OPERATIONS_UI_ENABLED',
  defaultValue: false,
);
