export const REPORT_OPTIONS = [
  {type:'CUSTOMERS',title:'Customer Report',description:'Canonical customer registrations and account records.'},
  {type:'ASTROLOGERS',title:'Astrologer Report',description:'Registered professional profiles and approval flags.'},
  {type:'CONSULTATIONS',title:'Consultation Report',description:'Persisted charges and recorded earnings, with currency and free-chat status.'},
  {type:'PAYMENTS',title:'Payment Report',description:'Gateway records with persisted TEST/LIVE/UNKNOWN classification; not bank settlement.'},
  {type:'WALLETS',title:'Wallet Report',description:'Current wallet balances and liabilities by currency.'},
  {type:'SUBSCRIPTIONS',title:'Subscription Report',description:'Verified subscription records, periods and status.'},
  {type:'WALLET_TRANSACTIONS',title:'Wallet Transactions',description:'Authoritative wallet journal entries across app and website.'},
  {type:'SUPPORT_TICKETS',title:'Support Tickets',description:'Owned ticket records; private notes and attachments excluded.'},
  {type:'KYC_APPROVALS',title:'KYC Audit',description:'Recorded astrologer moderation decisions; requires activated audit storage.'},
  {type:'MARKETPLACE_ORDERS',title:'Marketplace Orders',description:'Recorded order status and currency; no inferred settlement.'},
  {type:'REFUNDS',title:'Refund Audit Events',description:'Append-only workflow events, not refund totals or bank settlement.'},
  {type:'NOTIFICATIONS',title:'Notification Records',description:'Inbox records and enabled outboxes. Provider acceptance is not device delivery.'},
] as const;
export type ReportType = typeof REPORT_OPTIONS[number]['type'];
