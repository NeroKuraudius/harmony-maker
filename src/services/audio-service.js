const axios = require('axios')
const OpenAI = require('openai')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')

const config = require('../config')
const logger = require('../logger')

// ===================================================================== //
const client = new OpenAI(config.openai.API_KEY)

const reformUrl = (messageId)=>{
  const url = config.line.getLineMessage
  const newUrl = url.replace('messageId', messageId)
  return newUrl
}

const cleanCommand = (inputWav, splitTime, highRate, highTempo, lowRate, lowTempo, sampleRate, outputMixed)=>{
  const command = `ffmpeg -y -i ${inputWav} -filter_complex "
      [0:a]atrim=end=${splitTime},asetpts=PTS-STARTPTS[intro];
      [0:a]atrim=start=${splitTime},asetpts=PTS-STARTPTS[outro_raw];
      
      [outro_raw]asplit=3[v_main][v_high_in][v_low_in];
      
      [v_high_in]asetrate=${highRate},atempo=${highTempo},aresample=${sampleRate},volume=0.5[v_high];
      [v_low_in]asetrate=${lowRate},atempo=${lowTempo},aresample=${sampleRate},volume=0.6[v_low];
      [v_main]volume=1.0[v_clean];
      
      [v_clean][v_high][v_low]amix=inputs=3:duration=longest[outro_mixed];
      
      [intro][outro_mixed]concat=n=2:v=0:a=1[out]
    " -map "[out]" -ar ${sampleRate} ${outputMixed}`

  return command.replace(/\n/g, ' ')
}

// ===================================================================== //

async function callAndSaveAudio(messageId){
  if (!messageId){
    throw new Error('messageId is empty')
  }

  try{
    const url = reformUrl(messageId)
    const filePath = path.join(config.cacheDir, `${messageId}.m4a`)
    
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
  const fileName = path.join(config.cacheDir, `${messageId}`)

  return new Promise((resolve, reject)=>{
    exec(`ffmpeg -y -i ${fileName}.m4a -ar 16000 -ac 1 ${fileName}.wav`, (err)=>{
      if (err) reject(err)
      else {
        fs.unlink(`${fileName}.m4a`, (unlinkErr) => {
          if (unlinkErr) {
            logger.warn(`[Service] Failed to delete ${messageId}.m4a: ${unlinkErr}`);
          }
          resolve()
        })
      }
    })
  })
}

async function transcription(messageId){
  const fileName = path.join(config.cacheDir, `${messageId}.wav`)
  
  try{
    const transcript = await client.audio.transcriptions.create({
      file: fs.createReadStream(fileName),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    })

    return transcript
  } catch(err){
    logger.error(`[Service] Error occurred on transcription: ${err.stack}`)
    throw new Error(`[Service] Error occurred on transcription: ${err.message}`)
  }
}


async function generateHarmonyAudio(messageId, splitTime){
  const inputWav = path.join(config.cacheDir, `${messageId}.wav`)
  const outputMixed = path.join(config.harmonyDir, `${messageId}_harmony.wav`)
  
  // 設定原始音高
  const sampleRate = 16000

  // 音調參數調整: 
  // 升高4個半音(大三度)
  const highPitchRatio = 1.598
  const highRate = Math.round(sampleRate * highPitchRatio)
  const highTempo = 1 / highPitchRatio
  // 降低5個半音(低四度)
  const lowPitchRatio = 0.402
  const lowRate = Math.round(sampleRate * lowPitchRatio)
  const lowTempo = 1 / lowPitchRatio
  
  return new Promise((resolve, reject)=>{
    const exeCommand = cleanCommand(inputWav, splitTime, highRate, highTempo, lowRate, lowTempo, sampleRate, outputMixed)

    exec(exeCommand, (err)=>{
      if(err){
        logger.error(`[Service] FFmpeg harmony generate error: ${err.message}`)
        reject(err)
      }else{
        resolve(outputMixed)
      }
    })
  })
}

async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`, (err, stdout) => {
      if (err) return reject(err)
      resolve(Math.round(parseFloat(stdout) * 1000))
    })
  })
}


async function replyAudioToLine(replyToken, staticUrl, durationMs){
  const body = {
    replyToken,
    messages: [
      {
        type: "audio",
        originalContentUrl: staticUrl,
        duration: durationMs
      }
    ]
  }

  await axios.post(config.line.lineReplyApi, body, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.line.channelAccessToken}`
    }
  })
}


async function removeOriginalAudio(messageId){
  const originalWavPath = path.join(config.cacheDir, `${messageId}.wav`)

  fs.unlink(`${originalWavPath}`, (unlinkErr) => {
    if (unlinkErr) {
      logger.warn(`[Service] Failed to delete ${messageId}.m4a: ${unlinkErr}`);
    }
    resolve()
  })
}



module.exports = { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio, getAudioDuration, replyAudioToLine, removeOriginalAudio }