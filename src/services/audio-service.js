const axios = require('axios')
const OpenAI = require('openai')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')

const config = require('../config')
const logger = require('../logger')

const client = new OpenAI(config.openai.API_KEY)

const reformUrl = (messageId)=>{
  const url = config.line.getLineMessage
  const newUrl = url.replace('messageId', messageId)
  return newUrl
}

// ===================================================================== //

async function callAndSaveAudio(messageId){
  if (!messageId){
    throw new Error('messageId is empty')
  }

  try{
    const url = reformUrl(messageId)
    const filePath = path.join(config.audioDir, `${messageId}.m4a`)
    
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${config.line.channelAccessToken}`
      }
    })

    fs.writeFileSync(filePath, Buffer.from(res.data))

  }catch(err){
    logger.error(`[Service] Error occurred on callAndSaveAudio: ${err.stack}`)
    throw new Error(`[Service] Error occurred on callAndSaveAudio: ${err.message}`)
  }
}

function convertM4pToWav(messageId){
  const fileName = path.join(config.audioDir, `${messageId}`)

  return new Promise((resolve, reject)=>{
    exec(`ffmpeg -y -i ${fileName}.m4a -ar 16000 -ac 1 ${fileName}.wav`, (err)=>{
      if (err) reject(err)
        else resolve
    })
  })
}

async function transcription(messageId){
  const fileName = path.join(config.audioDir, `${messageId}.wav`)
  
  const transcript = await client.audio.transcriptions.create({
    file: fs.createReadStream(fileName),
    model: "gpt-4o-mini-transcribe"
  })

  return transcript
}

module.exports = { callAndSaveAudio, convertM4pToWav, transcription }