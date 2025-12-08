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
  const filterComplex = `
      [0:a]atrim=end=${splitTime},asetpts=PTS-STARTPTS[intro];
      [0:a]atrim=start=${splitTime},asetpts=PTS-STARTPTS[outro_raw];
      
      [outro_raw]asplit=3[v_main][v_h1_in][v_h2_in];
      
      [v_h1_in]asetrate=${highRate},atempo=${highTempo},aresample=${sampleRate},lowpass=f=1500,vibrato=f=6:d=0.3,adelay=20|20,volume=0.6[v_h1];
      
      [v_h2_in]asetrate=${lowRate},atempo=${lowTempo},aresample=${sampleRate},lowpass=f=1500,vibrato=f=6:d=0.3,adelay=40|40,volume=0.5[v_h2];
      
      [v_main]volume=1.2[v_clean];
      
      [v_clean][v_h1][v_h2]amix=inputs=3:duration=longest[outro_mixed_dry];
      
      [outro_mixed_dry]aecho=0.8:0.88:200:0.3[outro_final];
      
      [intro][outro_final]concat=n=2:v=0:a=1[out]
      `

  const command = `ffmpeg -y -i ${inputWav} -filter_complex "${filterComplex.replace(/\n/g, '')}" -map "[out]" -c:a aac -b:a 128k -ar 44100 -movflags +faststart ${outputMixed}`

  return command
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
  const outputMixed = path.join(config.harmonyDir, `${messageId}_harmony.m4a`)
  
  // 設定原始音高
  const sampleRate = 16000

  // 音調參數調整: 
  // 升高4個半音(大三度)
  const highPitchRatio = 1.2599
  const highRate = Math.round(sampleRate * highPitchRatio)
  const highTempo = 1 / highPitchRatio
  // 升高7個半音(純五度)
  const lowPitchRatio = 1.4983
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


async function replyAudioToLine(replyToken, messageId, durationMs){
  const staticUrl = config.server.serverUrl + `/static/harmony/${messageId}_harmony.m4a`
  
  logger.info(`### For Test - staticUrl: ${staticUrl}`)

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

  // 設定1分鐘後刪除
  const harmonyAudioPath = path.join(config.harmonyDir, `${messageId}_harmony.m4a`)
  setTimeout(() => {
    fs.unlink(harmonyAudioPath, (err) => {
      if (err) {
        logger.warn(`[Service] Failed to cleanup output file: ${err}`)
      }else{
        logger.info(`[Service] Harmony audio was removed: ${messageId}`)
      }
    })
  }, 180000)
}


async function removeOriginalAudio(messageId){
  const originalWavPath = path.join(config.cacheDir, `${messageId}.wav`)

  fs.unlink(`${originalWavPath}`, (unlinkErr) => {
    if (unlinkErr) {
      logger.warn(`[Service] Failed to delete ${messageId}.m4a: ${unlinkErr}`)
    }
    return ;
  })
}



module.exports = { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio, getAudioDuration, replyAudioToLine, removeOriginalAudio }