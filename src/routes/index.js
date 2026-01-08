const router = require('express').Router()
const path = require('path')
const line = require('./modules/line')

router.use('/line', line)

router.get('/healthz', (req,res)=>{
  return res.status(200).send('ok')
})

router.get('/', (req,res)=>{
  return res.sendFile(path.join(__dirname, '..', '..', 'views', 'default.html'))
})

module.exports = router