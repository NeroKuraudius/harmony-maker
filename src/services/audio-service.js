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
    " -map "[out]" -ar ${sampleRate} ${outputFinal}`

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
  
  // 設定原始音高
  const sampleRate = 16000

  // 音調參數調整: 
  // 升高4個半音(大三度)
  const highPitchRatio = 1.2599
  const highRate = Math.round(sampleRate * highPitchRatio)
  const highTempo = 1 / highPitchRatio
  // 降低5個半音(低四度)
  const lowPitchRatio = 0.7491
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

module.exports = { callAndSaveAudio, convertM4pToWav, transcription, generateHarmonyAudio }