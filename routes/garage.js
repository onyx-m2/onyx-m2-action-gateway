import { myQApi } from '@hjdhjd/myq'
import config from '../config.js'

const MILLISECONDS_PER_QUARTER_HOUR = 3600000 / 4
const { username, password, deviceId } = config.myQ

const myQ = new myQApi(username, password)
var device = null

// it is not know how long the token stays valid, so we'll force a refresh
// at least every hour
setInterval(() => {
  myQ.refreshDevices()
}, MILLISECONDS_PER_QUARTER_HOUR);

export default async function (fastify, opts) {
  fastify.put('/garage/open_door', openDoor)
  fastify.put('/garage/close_door', closeDoor)

  // verify credentials and device
  if (!await myQ.refreshDevices()) {
    fastify.log.warn(`Unable to refresh MyQ devices`)
  }
  if (!deviceId) {
    fastify.log.warn(`MYQ_DEVICE is not set, use one of the devices below:`)
    for (const device of myQ.devices) {
      const { serial_number: id, name } = device
      fastify.log.info(`Serial number (device) ${id} is ${name}`)
    }
  }
  else {
    device = myQ.getDevice(deviceId)
    if (device) {
      const { serial_number: id, name } = device
      fastify.log.info(`Selected garage door is ${name} with serial number ${id}`)
    }
    else {
      fastify.log.error(`No myQ device with id ${deviceId}`)
    }
  }
}

async function openDoor(request, reply) {
  await callApi(request.log, 'open')
  reply.code(204)
}

async function closeDoor(request, reply) {
  await callApi(request.log, 'close')
  reply.code(204)
}

async function callApi(log, action) {
  if (!await myQ.execute(device, action)) {
    log.error(`Error during myQ api call: ${action}`)
    throw { statusCode: 500 }
  }
}
