/**
 * Education is delivered through Moodle, hosted at accesstomusic.ac.uk.
 * Students, parents, admin and teachers all sign in at the same login page,
 * so both URLs below point to the same confirmed live site.
 */
export const MOODLE_STUDENT_URL = 'https://moodle.accesstomusic.ac.uk/login/index.php'
export const MOODLE_TEACHER_URL = 'https://moodle.accesstomusic.ac.uk/login/index.php'

/**
 * Base site URL (no path), used to derive LTI 1.3 endpoints for the
 * /admin/lti platform-registration form. This is also the expected `iss`
 * (issuer) claim Moodle sends on every LTI launch from this site.
 */
export const MOODLE_BASE_URL = 'https://moodle.accesstomusic.ac.uk'

/**
 * Moodle's LTI 1.3 endpoints live at fixed, well-known paths under the site
 * root for every Moodle install — only the Client ID and Deployment ID are
 * specific to how this tool gets registered, and Moodle only hands those
 * out once "Tranmere Tracker" is added as an External Tool in
 * Site Administration → Plugins → External Tools.
 * Docs: https://docs.moodle.org/en/LTI_Provider
 */
export const MOODLE_LTI_ENDPOINTS = {
  issuer: MOODLE_BASE_URL,
  authLoginUrl: `${MOODLE_BASE_URL}/mod/lti/auth.php`,
  authTokenUrl: `${MOODLE_BASE_URL}/mod/lti/token.php`,
  keysetUrl: `${MOODLE_BASE_URL}/mod/lti/certs.php`,
}
