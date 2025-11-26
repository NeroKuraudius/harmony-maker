require('dotenv').config()

const config = {
  
  server: {
    port: process?.env.PORT,
    host: process.env.HOST || "0.0.0.0",
    hostname: process.env.HOSTNAME || "localhost",
    limit: {
      rate: process.env.LIMIT_RATE === "1" || false,
      whitelistedIP: process.env.LIMIT_WHITELIST_IP
        ? process.env.LIMIT_WHITELIST_IP.split(',').map(ip => ip.trim())
        : [],
    }
  }
}

module.exports = config