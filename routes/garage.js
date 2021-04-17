import MyQ from 'myq-api'
import config from '../config.js'

const MILLISECONDS_PER_QUARTER_HOUR = 3600000 / 4

const { device } = config.myQ
const { OPEN, CLOSE } = MyQ.actions.door

const myQ = new MyQ()
var myQToken = null

// it is not know how long the token stays valid, so we'll force a refresh
// at least every hour
setInterval(() => {
  myQToken = null
}, MILLISECONDS_PER_QUARTER_HOUR);

export default async function (fastify, opts) {
  fastify.put('/garage/open_door', openDoor)
  fastify.put('/garage/close_door', closeDoor)
}

async function openDoor(request, reply) {
  await myQApi(request, () => myQ.setDoorState(device, OPEN))
  reply.code(204)
}

async function closeDoor(request, reply) {
  await myQApi(request, () => myQ.setDoorState(device, CLOSE))
  reply.code(204)
}

async function refreshCredentials(request) {
  if (myQToken === null) {
    try {
      const { username, password } = config.myQ
      const { securityToken } = await myQ.login(username, password)
      myQToken = securityToken
      request.log.info(`Successfully obtained myQ security token`)
    }
    catch (e) {
      request.log.error(`Error logging into myQ account. ${e}`)
      throw e
    }
  }
}

async function myQApi(request, action) {
  try {
    await refreshCredentials(request)
    await action()
  }
  catch (e) {
    log.error(`Error during myQ api call. ${e}`)
    throw { statusCode: 500 }
  }
}
