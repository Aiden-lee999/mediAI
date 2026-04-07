require('dotenv').config();
const { execSync } = require('child_process');
execSync('npx prisma db push', { stdio: 'inherit' });
