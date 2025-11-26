const logger = require('../logger')
const { callAndSaveAudio, convertM4pToWav, transcription } = require('../services/audio-service')

const lineController = {
  parseData: (req,res)=>{
    res.sendStatus(200)

    const { events } = req.body
    
    try{
      events.forEach(async(element) => {
        if (element.type !== "message" || element.message.type !== "audio") return ;

        const messageId = element.message.id

        // #1 取得語音訊息並儲存
        await callAndSaveAudio(messageId)
        logger.info(`[Controller] Audio was saved: ${messageId}`)

        // #2 利用ffmpeg將 .m4a 轉為 .wav
        await convertM4pToWav(messageId)
        logger.info(`[Controller] Success in converting .m4a into .wav: ${messageId}`)
      
        // #3 將 .wav 檔用whisper轉為文字
        const audioText = await transcription(messageId)
        logger.info(`[Controller] Transcribed audio to text: ${messageId}`)

        logger.debug(`##### audioText: ${audioText}`)
      
      })
    } catch(err){
        logger.error(`[Controller] Error occurred on parseData: ${err.stack}`)
        return res.status(400).json({ message: `[Controller] Error occurred on parseData: ${err.message}` })
    }
  }
}

module.exports = lineController