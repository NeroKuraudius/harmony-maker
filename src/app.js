const { startServer } = require('./server')

const logger = require('./logger')

const initApp = async () => {

  try {
    startServer()
  }
  catch(err) {
    logger.error(`Startup error: ${err.message}`)
    process.exit(1)
  }
}

initApp()