const axios = require('axios')
const path = require('path')
const fs = require('fs')

const config = require('../config')
const logger = require('../logger')

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


module.exports = { callAndSaveAudio }