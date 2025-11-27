require('dotenv').config()

const path = require('path')

const cacheDir = path.join(__dirname, '..', 'temp', 'cache')
const harmonyDir = path.join(__dirname, '..', 'public', 'harmony')

const config = {

  cacheDir, harmonyDir,
  
  server: {
    port: process?.env.PORT,
    host: process.env.HOST || "0.0.0.0",
    hostname: process.env.HOSTNAME || "localhost",
    limit: {
      rate: process.env.LIMIT_RATE === "1" || false,
      whitelistedIP: process.env.LIMIT_WHITELIST_IP
        ? process.env.LIMIT_WHITELIST_IP.split(',').map(ip => ip.trim())
        : [],
    },
    serverUrl: process?.env.SERVER_URL || ""
  },

  line: {
    getLineMessage: process?.env.LINE_GET_MESSAGE_API || "",
    channelAccessToken: process?.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    lineReplyApi: process?.env.LINE_REPLY_API || ""
  },

  openai: {
    API_KEY: process?.env.OPENAI_API_KEY || ""
  }
}

module.exports = config