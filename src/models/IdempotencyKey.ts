export interface IdempotencyKey {
  key: string;
  request_hash: string;
  response_status: number;
  response_body: any;
  created_at: Date;
  expires_at: Date;
}

export interface CreateIdempotencyKeyInput {
  key: string;
  request_hash: string;
  response_status: number;
  response_body: any;
  expires_at: Date;
}
