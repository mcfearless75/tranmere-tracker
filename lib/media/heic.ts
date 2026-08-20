/**
 * Detects HEIC/HEIF files — iPhone's default camera format since iOS 11,
 * which almost no non-Apple browser can decode in an <img> tag. Shared
 * between the client-side conversion (ProfileClient) and the server-side
 * backstop (profile actions) so the detection logic can never drift between
 * the two.
 */
export function isHeicFile(file: { type: string; name: string }): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name)
  )
}
