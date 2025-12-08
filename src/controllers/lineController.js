const logger = require('../logger')
const config = require('../config')
const { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio, getAudioDuration, replyAudioToLine, removeOriginalAudio } = require('../services/audio-service')

const lineController = {
  parseData: async(req,res)=>{
    res.sendStatus(200)

    const { events } = req.body
    if (!events || events.length === 0) return;
    
    for (const element of events){
      try {
        if (element.type !== "message" || element.message.type !== "audio") continue ;

        const messageId = element.message.id

        // #1 取得語音訊息並儲存
        await callAndSaveAudio(messageId)
        logger.info(`[Controller] #1. Audio was caught: ${messageId}`)


        // #2 利用ffmpeg將 .m4a 轉為 .wav
        await convertM4pToWav(messageId)
        logger.info(`[Controller] #2. Success in converting .m4a into .wav: ${messageId}`)
      

        // #3 將 .wav 檔用 whisper API 轉為文字
        const audioTextObj = await transcription(messageId)
        logger.info(`[Controller] #3. Transcribed audio with timestamps: ${messageId}`)


        // #4 取得最後一句的時間戳資訊
        const segments = audioTextObj.segments
        if (!segments || segments.length === 0){
          logger.warn(`[Controller] No segments found for message: ${messageId}`)
          continue;
        }

        const lastSegment = segments[segments.length-1]
        const startTime = lastSegment.start
        logger.info(`[Controller] #4. Last sentence found: "${lastSegment.text}" (since ${startTime}s)`)


        // #5 生成和聲
        const harmonyAudioPath = await generateHarmonyAudio(messageId, startTime)
        logger.info(`[Controller] #5. Harmony generated and saved: ${messageId}`)


        // #6 將音訊回傳給使用者
        const durationMs = await getAudioDuration(harmonyAudioPath)
        await replyAudioToLine(element.replyToken, messageId, durationMs)
        logger.info(`[Controller] #6. Audio replied to user: ${messageId}`)

        // #7 刪除原音訊
        await removeOriginalAudio(messageId)
        logger.info(`[Controller] #7. Origianl audio was removed: ${messageId}`)
      
      } catch(err){
        logger.error(`[Controller] Error occurred on parseData on message id ${element.message.id}: ${err.stack}`)
      }
    }
  }
}

module.exports = lineController