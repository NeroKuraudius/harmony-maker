const logger = require('../logger')
const { callAndSaveAudio } = require('../services/line-service')

const lineController = {
  parseData: (req,res)=>{
    res.sendStatus(200)

    const { events } = req.body
    
    try{
      events.forEach(async(element) => {
        if (element.type !== "message" || element.message.type !== "audio") return ;

        const messageId = element.message.id
        await callAndSaveAudio(messageId)
        logger.info(`[Controller] Audio saved successfully`)
      })
    } catch(err){
        logger.error(`[Controller] Error occurred on parseData: ${err.stack}`)
        return res.status(400).json({ message: `[Controller] Error occurred on parseData: ${err.message}` })
    }
  }
}

module.exports = lineController