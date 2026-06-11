/**
 * Tipos compartilhados pra integração com Google Drive (T27/T28/T29).
 */

export interface DriveTokenPair {
  access_token: string;
  /** Pode estar vazio quando o token foi obtido via refresh — usar somente se vier no payload. */
  refresh_token?: string;
  expires_at: number; // unix ms
  token_type: 'Bearer';
  scope: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface DriveFileUploadResult {
  id: string;
  name: string;
  webViewLink?: string;
  parents?: string[];
}

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'DriveError';
  }
}

/** Indica que o token expirou — caller deve dar refresh ou pedir re-auth. */
export class DriveAuthExpiredError extends DriveError {
  constructor(message = 'Token Google expirado ou inválido — re-autenticar') {
    super(message, 401);
    this.name = 'DriveAuthExpiredError';
  }
}
