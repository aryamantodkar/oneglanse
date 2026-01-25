module.exports = {
  apps: [
    {
      name: "onescope-api",
      script: "src/api.ts",
      interpreter: "node",
      interpreter_args: "--loader ts-node/esm",
      instances: 1,
      exec_mode: "fork",
    },
    {
      name: "onescope-agent-worker",
      script: "src/worker.ts",
      interpreter: "node",
      interpreter_args: "--loader ts-node/esm",

      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 5000,

      instances: 1,      // 🔒 REQUIRED (single Chrome profile)
      exec_mode: "fork", // 🔒 REQUIRED (NOT cluster)
      watch: false,      // 🔒 prevents infinite restarts
    },
  ],
};