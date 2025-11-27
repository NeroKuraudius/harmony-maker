const winston = require('winston')

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

// in production only show warn | error
const level = () => {
  const env = process.env.NODE_ENV || 'development'
  const isDevelopment = env === 'development'
  return isDevelopment ? 'debug' : 'warn'
}

// define different colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
}

winston.addColors(colors)

// define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

// define log transports
const transports = [

  // print all errors to console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.errors({ stack: true })
    )
  }),

  // error level "error" goes to separate log
  new winston.transports.File({
    filename: __dirname + '/../temp/logs/error.log',
    level: 'error',
  }),

  // log all messages to this log
  new winston.transports.File({
    filename: __dirname + '/../temp/logs/all.log',
  }),
]

// create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
})

module.exports = logger