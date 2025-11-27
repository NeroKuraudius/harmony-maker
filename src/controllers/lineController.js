const logger = require('../logger')
const { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio } = require('../services/audio-service')

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
      

        // #3 將 .wav 檔用 whisper API 轉為文字
        const audioTextObj = await transcription(messageId)
        logger.info(`[Controller] Transcribed audio with timestamps: ${messageId}`)


        // #4 取得最後一句的時間戳資訊
        const segments = audioTextObj.segments
        if (!segments || segments.length === 0){
          throw new Error(`Failed to get segments of audioTextObj`)
        }

        const lastSegment = segments[segments.length-1]
        const startTime = lastSegment.start
        logger.info(`[Controller] Last sentence found: "${lastSegment.text}" (since ${startTime}s)`)


        // #5 生成和聲
        const harmonyAudioPath = await generateHarmonyAudio(messageId, startTime)
        logger.info(`[Controller] Harmony generated and saved: ${messageId}`)


        // #6 將音訊回傳給使用者
        
        // logger.debug(`##### harmonyPath: ${harmonyPath}`)
      
      })
    } catch(err){
        logger.error(`[Controller] Error occurred on parseData: ${err.stack}`)
        return res.status(400).json({ message: `[Controller] Error occurred on parseData: ${err.message}` })
    }
  }
}

module.exports = lineController