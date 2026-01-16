export interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
}
