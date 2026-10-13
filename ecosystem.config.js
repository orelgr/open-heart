// PM2 process file — Open Heart (לבבות פתוחים)
// Server: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt
//         (cd frontend && npm ci && npm run build) && pm2 start ecosystem.config.js
const fs = require("fs");
const path = require("path");

const venvPython = path.join(__dirname, "backend", ".venv", "bin", "python");

module.exports = {
  apps: [
    {
      name: "open-heart",
      cwd: "./backend",
      script: "App.py",
      interpreter: process.env.PYTHON || (fs.existsSync(venvPython) ? venvPython : "python3"),
      env: { HOST: "127.0.0.1", PORT: "8000", CORS_ORIGINS: "https://openhearts.gmarup.com" },
      max_memory_restart: "300M",
      autorestart: true,
    },
  ],
};
