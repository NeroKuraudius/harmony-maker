require('dotenv').config()

const path = require('path')

const audioDir = path.join(__dirname, '..', 'temp', 'cache')

const config = {

  audioDir,
  
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
  },

  line: {
    getLineMessage: process?.env.LINE_GET_MESSAGE_API || "",
    channelAccessToken: process?.env.LINE_CHANNEL_ACCESS_TOKEN || ""
  
  },

  openai: {
    API_KEY: process?.env.OPENAI_API_KEY || ""
  }
}

module.exports = config