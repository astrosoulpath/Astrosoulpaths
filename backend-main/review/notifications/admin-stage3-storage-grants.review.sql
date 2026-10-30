-- REVIEW ONLY: separate approval required for the ORIGINAL local database.
-- Apply only after the pinned seven-table migration, using a migration owner
-- distinct from the runtime role. No role creation, membership or global grants.
-- psql variable runtime_role must come from the verified local configuration.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
-- Remove inherited default table grants from these NEW objects only, so
-- column-level policy controls and immutable records stay least-privileged.
REVOKE ALL PRIVILEGES ON TABLE public."SmartNotificationPolicy", public."SmartNotificationCampaign",
  public."SmartNotificationConsent", public."SmartNotificationInsight",
  public."SmartNotificationDelivery", public."SmartNotificationAudit",
  public."SmartNotificationOpen" FROM PUBLIC, :"runtime_role";
GRANT SELECT ON TABLE public."SmartNotificationPolicy", public."SmartNotificationCampaign",
  public."SmartNotificationConsent", public."SmartNotificationInsight",
  public."SmartNotificationDelivery", public."SmartNotificationAudit",
  public."SmartNotificationOpen" TO :"runtime_role";
GRANT INSERT ON TABLE public."SmartNotificationCampaign", public."SmartNotificationConsent",
  public."SmartNotificationInsight", public."SmartNotificationDelivery",
  public."SmartNotificationAudit", public."SmartNotificationOpen" TO :"runtime_role";
GRANT UPDATE ("enabled", "languages", "dailyLimit", "minimumIntervalMs", "quietStart", "quietEnd", "scheduleMinute", "controlVersion")
  ON public."SmartNotificationPolicy" TO :"runtime_role";
GRANT UPDATE ON TABLE public."SmartNotificationCampaign", public."SmartNotificationConsent",
  public."SmartNotificationDelivery" TO :"runtime_role";
-- No UPDATE/DELETE/TRUNCATE on immutable content/audit or tracking records.
-- No policy approval/entitlement UPDATE. No new schema CREATE, owner or role rights.
COMMIT;
