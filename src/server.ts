import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';
import { prisma } from './config/database.js';
import bcrypt from 'bcryptjs';

const PORT = parseInt(env.PORT, 10) || 4000;

async function ensureDbInitialized() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      logger.info('Database is empty. Initializing default owner user & business...');
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      const user = await prisma.user.create({
        data: {
          email: 'owner@alrehman.pk',
          passwordHash,
          name: 'Tariq Mehmood',
        },
      });

      const business = await prisma.business.create({
        data: {
          name: 'Al-Rehman Fabrics & Fragrances',
          ownerId: user.id,
          phone: '+923009988776',
        },
      });

      await prisma.userBusiness.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: 'OWNER',
        },
      });

      await prisma.whatsAppConfig.create({
        data: {
          businessId: business.id,
          verifyToken: env.WHATSAPP_VERIFY_TOKEN,
        },
      });

      logger.info('Default owner account initialized: owner@alrehman.pk / Admin123!');
    }
  } catch (err) {
    logger.warn('Auto-initialization check warning:', err);
  }
}

const server = app.listen(PORT, async () => {
  logger.info(`🚀 WhatsApp Business OS Server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`🔗 API Health: http://localhost:${PORT}/health`);
  await ensureDbInitialized();
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Database connection closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
