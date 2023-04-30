const FNM = process.env.FNM_MULTISHELL_PATH

module.exports = {
  apps: [
    {
      name: 'sonos-http-api',
      cwd: __dirname,
      combine_logs: true,
      watch: true,
      ignore_watch: ['node_modules', '.git'],
      script: './server.js',
      interpreter: FNM ? `${FNM}/bin/node` : 'node',
    },
  ],
}
