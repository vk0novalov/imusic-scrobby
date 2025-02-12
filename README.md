# iMusic-Scrobby

Simple music scrobbler for Apple Music written in Node.js (22.12+) with Bun support

[![Testing CI](https://github.com/vk0novalov/imusic-scrobby/actions/workflows/test.yml/badge.svg)](https://github.com/vk0novalov/imusic-scrobby/actions/workflows/test.yml)
[![snyk](https://snyk.io/test/github/vk0novalov/imusic-scrobby/badge.svg)](https://snyk.io/test/github/vk0novalov/imusic-scrobby)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/vk0novalov/imusic-scrobby/blob/main/LICENSE)

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Installation

```bash
# Clone the repository
git clone https://github.com/vk0novalov/imusic-scrobby.git

# Navigate to the project directory
cd imusic-scrobby

# Install dependencies
npm install

# or for Bun
bun install
```

## Environment Variables

Create a `.env` file in the root directory based on provided example:

```bash
cp .env.example .env
```

Fill in the .env file with your API keys provided by Last.fm

You can get them here: https://www.last.fm/api/account/create

```env
API_KEY=app_key
API_SECRET=app_secret
```

## Usage

```bash
# Run in development mode
npm run dev

# Run in production mode
npm start

# for Bun
bun run src/index.ts

# Run tests
npm t
```

## Launch as a service

You can use [PM2](https://pm2.keymetrics.io/) to run the application as a service.

Install PM2 globally:

```bash
npm install -g pm2
```

Run the application as a service:

```bash
pm2 start npm --name imusic-scrobby -- start
```

Useful [how-to](https://bun.sh/guides/ecosystem/pm2) for Bun.

## Dependencies

- applescript
- bun-storage (shim of localStorage for Bun)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Viktor Konovalov - [@vk0novalov](https://github.com/vk0novalov)
