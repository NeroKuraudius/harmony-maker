const router = require('express').Router()
const lineController = require('../../controllers/lineController')

router.post('/webhook', lineController.parseData)

module.exports = router