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

const cleanCommand = (inputWav, splitTime, newRate, tempo, sampleRate, outputMixed)=>{
  const command = `ffmpeg -y -i ${inputWav} -filter_complex "
      [0:a]atrim=end=${splitTime},asetpts=PTS-STARTPTS[intro];
      [0:a]atrim=start=${splitTime},asetpts=PTS-STARTPTS[outro_raw];
      [outro_raw]asplit[v_main][v_harm_input];
      [v_harm_input]asetrate=${newRate},atempo=${tempo},aresample=${sampleRate},volume=0.6[v_harm];
      [v_main]volume=1.0[v_clean];
      [v_clean][v_harm]amix=inputs=2:duration=longest[outro_mixed];
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
        else resolve()
    })
  })
}

async function transcription(messageId){
  const fileName = path.join(config.audioDir, `${messageId}.wav`)
  
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

// function getLastSentence(text){
//   if (!text || typeof text !== 'string') return;

//   const sentences = text.split(/(?<=[，。．\.？！!?])/)
//     .map(s => s.trim())
//     .filter(Boolean)

//   return sentences.length > 0 ? sentences[sentences.length-1] : text.trim()
// }

async function generateHarmonyAudio(messageId, splitTime){
  const inputWav = path.join(config.audioDir, `${messageId}.wav`)
  const outputMixed = path.join(config.audioDir, `${messageId}_harmony.wav`)

  // 音調參數調整: 升高4個半音(大三度)
  const pitchRatio = 1.25992
  const sampleRate = 16000
  const newRate = Math.round(sampleRate * pitchRatio)
  const tempo = 1 / pitchRatio
  
  return new Promise((resolve, reject)=>{
    const exeCommand = cleanCommand(inputWav, splitTime, newRate, tempo, sampleRate, outputMixed)

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

module.exports = { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio }