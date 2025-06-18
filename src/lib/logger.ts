import { pino } from 'pino';
import config from './config.ts';

const logger = pino({
  level: config.LOG_LEVEL,
});

export default logger;
