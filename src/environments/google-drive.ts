/**
 * Google Drive configuration injected from environment variables.
 * Source: .env (NG_APP_GOOGLE_CLIENT_ID, NG_APP_GOOGLE_API_KEY, NG_APP_GOOGLE_USE_APP_DATA_FOLDER)
 */

export const googleDriveConfig = {
  clientId: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'] || '',
  apiKey: import.meta.env['NG_APP_GOOGLE_API_KEY'] || '',
  useAppDataFolder: import.meta.env['NG_APP_GOOGLE_USE_APP_DATA_FOLDER'] !== 'false',
} as const;

export function isGoogleDriveConfigured(): boolean {
  return !!(googleDriveConfig.clientId && googleDriveConfig.apiKey);
}
