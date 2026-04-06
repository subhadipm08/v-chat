import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProduction
    ? undefined // JSON logs in production
    : {
        target: 'pino-pretty', // Colored readable logs in dev
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
});

export default logger;
