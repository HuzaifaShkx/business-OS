import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';
import { prisma } from './config/database.js';

const PORT = parseInt(env.PORT, 10) || 4000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 WhatsApp Business OS Server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`🔗 API Health: http://localhost:${PORT}/health`);
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