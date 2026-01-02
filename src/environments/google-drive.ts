/**
 * Google Drive configuration injected from environment variables.
 * Source: .env (NG_APP_GOOGLE_CLIENT_ID)
 */

export const googleDriveConfig = {
  clientId: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'] || '',
} as const;

export function isGoogleDriveConfigured(): boolean {
  return !!googleDriveConfig.clientId;
}
