module.exports = {
  apps: [
    {
      name: 'henzo-backend',
      script: 'dist/main.js',
      cwd: '/var/www/henzo/apps/backend',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/henzo-backend-error.log',
      out_file: '/var/log/pm2/henzo-backend-out.log',
      log_file: '/var/log/pm2/henzo-backend-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};
