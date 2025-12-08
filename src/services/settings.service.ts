import { prisma } from '../utils/prisma.util';
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import {
  UpdateUserInput,
  UpdatePasswordInput,
  UpdateSettingsInput,
  UserSettingsResponse,
  UserDetailsResponse,
} from '../types/settings.types';

export const getUserDetails = async (
  userId: string
): Promise<UserDetailsResponse | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    settings: user.settings
      ? {
          id: user.settings.id,
          userId: user.settings.userId,
          notifications: user.settings.notifications,
          darkMode: user.settings.darkMode,
          language: user.settings.language,
          createdAt: user.settings.createdAt,
          updatedAt: user.settings.updatedAt,
        }
      : null,
  };
};

export const updateUserDetails = async (
  userId: string,
  data: UpdateUserInput
): Promise<UserDetailsResponse | null> => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
    },
    include: { settings: true },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    settings: user.settings
      ? {
          id: user.settings.id,
          userId: user.settings.userId,
          notifications: user.settings.notifications,
          darkMode: user.settings.darkMode,
          language: user.settings.language,
          createdAt: user.settings.createdAt,
          updatedAt: user.settings.updatedAt,
        }
      : null,
  };
};

export const updatePassword = async (
  userId: string,
  data: UpdatePasswordInput
): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await comparePassword(data.currentPassword, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return true;
};

export const getSettings = async (
  userId: string
): Promise<UserSettingsResponse | null> => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) return null;

  return {
    id: settings.id,
    userId: settings.userId,
    notifications: settings.notifications,
    darkMode: settings.darkMode,
    language: settings.language,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
};

export const upsertSettings = async (
  userId: string,
  data: UpdateSettingsInput
): Promise<UserSettingsResponse> => {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      notifications: data.notifications ?? true,
      darkMode: data.darkMode ?? false,
      language: data.language ?? 'en',
    },
    update: {
      notifications: data.notifications,
      darkMode: data.darkMode,
      language: data.language,
    },
  });

  return {
    id: settings.id,
    userId: settings.userId,
    notifications: settings.notifications,
    darkMode: settings.darkMode,
    language: settings.language,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
};

export const deleteAccount = async (userId: string): Promise<boolean> => {
  await prisma.user.delete({
    where: { id: userId },
  });

  return true;
};
