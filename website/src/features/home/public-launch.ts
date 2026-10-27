/** Runtime server gate. No query parameter, role cookie or client flag can publish Home. */
export function publicHomepageAllowed(environment = process.env.NODE_ENV, approval = process.env.PUBLIC_WEBSITE_LAUNCH_APPROVED) {
  return environment === 'development' || environment === 'test' || approval === 'true';
}
