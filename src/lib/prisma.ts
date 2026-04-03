import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const getPrismaUrl = () => {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes(':6543') && !url.includes('pgbouncer=true')) {
    url = url.includes('?') ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
};

export const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: getPrismaUrl(),
    },
  },
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
