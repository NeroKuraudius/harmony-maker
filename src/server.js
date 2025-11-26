const express = require("express")
const rateLimit = require('express-rate-limit')

const config = require('./config.js')
const logger = require('./logger')

// configure basic express server
const app = express()

if (config.server.limit.rate) {
  const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: "Too many requests",
    skip: (req) => {
      const whitelistedIPs = config.server.limit.whitelistedIP
      if (whitelistedIPs && whitelistedIPs.length > 0) {
        return whitelistedIPs.includes(req.ip)
      }
      return false
    }
  })
  app.use(limiter)
}

// serve static files
app.use('/static', express.static(__dirname + '/../public'))
// app.use('/userPic', express.static(config.cachePath))


// all following routes can directly use body-parsing middleware
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))


// web pages
const router = require('./routes/index')
app.use('/', router)


// init server
const startServer = () => {

  const { port, host } = config.server
  if (!port || !host) {
    throw new Error("Server configuration is incomplete.")
  }

  const server = require("http").createServer(app)

  server.on("error", (err) => {
    logger.error(`Server encountered an error: ${err.message}`)
  })

  server.listen(port, host, () => {
    logger.info(`HTTP server running on ${host}:${port}`)
  })
}

module.exports = { app, startServer }
