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
      // SECRET_KEY (base64, 32+ random bytes) is read from the server's environment, never from git:
      //   python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
      // Without it, backend/data/secret.key is generated on first run (back it up separately from the DB).
      env: {
        HOST: "127.0.0.1",
        PORT: "8000",
        CORS_ORIGINS: "https://openhearts.gmarup.com",
        COOKIE_SECURE: "1",
        ...(process.env.SECRET_KEY ? { SECRET_KEY: process.env.SECRET_KEY } : {}),
      },
      max_memory_restart: "300M",
      autorestart: true,
    },
  ],
};
