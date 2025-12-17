export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateSettingsInput {
  notifications?: boolean;
  darkMode?: boolean;
  language?: string;
  // Interview settings
  multiRoundEnabled?: boolean;
  defaultRounds?: string[];
}

export interface UserSettingsResponse {
  id: string;
  userId: string;
  notifications: boolean;
  darkMode: boolean;
  language: string;
  // Interview settings
  multiRoundEnabled: boolean;
  defaultRounds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDetailsResponse {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  settings: UserSettingsResponse | null;
}
