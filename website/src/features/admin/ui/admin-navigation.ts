export const adminModules = [
  { title: "Financial Overview", href: "/admin/finance", icon: "finance", group: "Operations", description: "Recorded collections, earnings and wallet liabilities." },
  { title: "Manage Customers", href: "/admin/customers", icon: "customers", group: "People", description: "Customer profiles, account status and existing activity." },
  { title: "Support Tickets", href: "/admin/support", icon: "support", group: "People", description: "Customer conversations, assignments and resolutions." },
  { title: "Customer Feedback", href: "/admin/feedback", icon: "feedback", group: "People", description: "Ratings, feedback and moderation notes." },
  { title: "Approve Astrologers", href: "/admin/astrologers", icon: "astrologers", group: "People", description: "Applications, verification and approval workflows." },
  { title: "Manage Consultations", href: "/admin/consultations", icon: "consultations", group: "Operations", description: "Existing chat, audio and video consultation records." },
  { title: "Wallet & Transactions", href: "/admin/wallet", icon: "wallet", group: "Operations", description: "Wallet balances and recorded ledger transactions." },
  { title: "Payments", href: "/admin/payments", icon: "payments", group: "Operations", description: "Pending, failed, successful and refunded orders." },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: "subscriptions", group: "Operations", description: "Plan details, subscription status and entitlements." },
  { title: "Notification Catalogue", href: "/admin/notifications", icon: "notifications", group: "Platform", description: "Editorial templates and guarded campaign approvals." },
  { title: "Platform Analytics", href: "/admin/analytics", icon: "analytics", group: "Platform", description: "Available platform usage and financial reporting." },
  { title: "Reports", href: "/admin/reports", icon: "reports", group: "Platform", description: "Operational records and existing report exports." },
  { title: "Kundli Settings", href: "/admin/kundli-settings", icon: "kundli", group: "Platform", description: "Professional Kundli plans and authorized settings." },
  { title: "Soul Bazaar", href: "/admin/marketplace", icon: "marketplace", group: "Platform", description: "Sellers, products, orders and marketplace moderation." },
  { title: "Platform Settings", href: "/admin/platform-settings", icon: "settings", group: "Platform", description: "Existing configuration and commission controls." },
  { title: "Video Management", href: "/admin/videos", icon: "videos", group: "Platform", description: "Video lessons, translations and publishing controls." },
] as const;

export function isAdminRoute(path: string) {
  return path === "/admin" || path.startsWith("/admin/") || path === "/admin.backup-before-token-fix" || path.startsWith("/admin.backup-before-token-fix/");
}
export function isAdminAuthRoute(path: string) {
  return path === "/admin/login" || path === "/admin/verify-otp";
}
export function adminPageInfo(path: string) {
  if (path === "/admin") return {title: "Dashboard", description: "Your platform, at a glance."};
  if (path === "/admin/marketplace/products") return {title: "Marketplace Products", description: "Review existing products and preserve their moderation workflow."};
  if (path === "/admin/marketplace/categories") return {title: "Marketplace Categories", description: "Organize existing product categories and visibility."};
  if (path.startsWith("/admin/astrologers/")) return {title: "Astrologer Profile", description: "Review the existing profile, verification and approval status."};
  return adminModules.find(item => path === item.href || path.startsWith(`${item.href}/`)) ??
    {title: path.startsWith("/admin/articles") ? "Article Management" : "Administration", description: "Manage your platform with confidence."};
}
