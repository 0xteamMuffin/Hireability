// Prisma 7 configuration file for migrations
// The connection URL is read from DATABASE_URL environment variable
// This file is used by Prisma Migrate
/// <reference types="node" />

export const config = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

