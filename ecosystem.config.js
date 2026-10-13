// PM2 process file — Open Heart (לבבות פתוחים)
// Usage: cd frontend && npm ci && npm run build && cd .. && pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "open-heart",
      cwd: "./backend",
      script: "App.py",
      interpreter: process.env.PYTHON || "python3",
      env: { HOST: "127.0.0.1", PORT: "8000", CORS_ORIGINS: "https://openheart.gmarup.com" },
      max_memory_restart: "300M",
      autorestart: true,
    },
  ],
};
