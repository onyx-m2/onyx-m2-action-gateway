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

  // verify credentials and device
  await refreshCredentials(fastify.log)
  const { devices } = await myQ.getDevices()
  if (!device) {
    fastify.log.warn(`MYQ_DEVICE is not set, use one of the devices below:`)
    for (const info of devices) {
      const { serial_number: id, name } = info
      fastify.log.info(`Serial number (device) ${id} is ${name}`)
    }
  }
  else {
    const info = devices.find(d => d.serial_number == device)
    if (info) {
      const { serial_number: id, name } = info
      fastify.log.info(`Selected garage door is ${name} with serial number ${id}`)
    }
    else {
      fastify.log.error(`No myQ device with id ${device}`)
    }
  }
}

async function openDoor(request, reply) {
  await myQApi(request.log, () => myQ.setDoorState(device, OPEN))
  reply.code(204)
}

async function closeDoor(request, reply) {
  await myQApi(request.log, () => myQ.setDoorState(device, CLOSE))
  reply.code(204)
}

async function refreshCredentials(log) {
  if (myQToken === null) {
    try {
      const { username, password } = config.myQ
      const { securityToken } = await myQ.login(username, password)
      myQToken = securityToken
      log.info(`Successfully obtained myQ security token`)
    }
    catch (e) {
      log.error(`Error logging into myQ account. ${e}`)
      throw e
    }
  }
}

async function myQApi(log, action) {
  try {
    await refreshCredentials(log)
    await action()
  }
  catch (e) {
    log.error(`Error during myQ api call. ${e}`)
    throw { statusCode: 500 }
  }
}
