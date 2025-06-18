if (!process.env.API_KEY || !process.env.API_SECRET) {
  console.error('API_KEY and API_SECRET environment variables are require, please check that .env file is present');
  process.exit(1);
}

const config = {
  API_KEY: process.env.API_KEY,
  API_SECRET: process.env.API_SECRET,
  LOG_LEVEL: process.env.LOG_LEVEL || 'trace',
};

export default config;
