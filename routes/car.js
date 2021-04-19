import {
  loginAsync as teslaLogin,
  refreshTokenAsync as teslaRefreshToken,
  windowControlAsync as teslaWindowControl,
  wakeUpAsync as teslaWakeUp,
  vehiclesAsync as teslaVehicles
} from 'teslajs'
import config from '../config.js'

const MILLISECONDS_PER_WEEK = 604800000

var authToken = null
var refreshToken = null
var vehicleID = config.tesla.vehicleId


// once a week we'll force the refreshing of our token (it expires every 45 days)
setInterval(() => {
  authToken = null
}, MILLISECONDS_PER_WEEK);

export default async function (fastify, opts) {
  fastify.put('/car/vent_windows', ventWindows)
  fastify.put('/car/close_windows', closeWindows)
  fastify.put('/car/wake_up', wakeUp)

  // verify credentials and vehicle configuration
  await refreshCredentials(fastify.log)
  const vehicles = await teslaVehicles({ authToken })
  if (!vehicleID) {
    fastify.log.warn(`TESLA_VEHICLE_ID is not set, use one of the vehicles below:`)
    for (const vehicle of vehicles) {
      const { id, display_name: name, vin } = vehicle
      fastify.log.info(`Id ${id} is ${name} with vin ${vin}`)
    }
  }
  else {
    const vehicle = vehicles.find(v => v.id == vehicleID)
    if (vehicle) {
      const { display_name: name, vin } = vehicle
      fastify.log.info(`Selected tesla vehicle is ${name} with vin ${vin}`)
    }
    else {
      fastify.log.error(`No tesla vehicle with id ${vehicleID}`)
    }
  }
}

async function ventWindows(request, reply) {
  await teslaApi(request.log, () => teslaWindowControl({ authToken, vehicleID }, 'vent'))
  reply.code(204)
}

async function closeWindows(request, reply) {
  await teslaApi(request.log, () => teslaWindowControl({ authToken, vehicleID }, 'close'))
  reply.code(204)
}

async function wakeUp(request, reply) {
  await teslaApi(request.log, () => teslaWakeUp({ authToken, vehicleID }))
  reply.code(204)
}

async function refreshCredentials(log) {
  if (authToken === null) {
    if (refreshToken !== null) {
      try {
        const { refreshToken: newRefreshToken, authToken: newAuthToken } = await teslaRefreshToken(refreshToken)
        refreshToken = newRefreshToken
        authToken = newAuthToken
        log.info(`Successfully refreshed tesla auth token`)
      }
      catch (e) {
        log.error(`Error refreshing tesla auth token, will try logging again. ${e}`)
      }
    }
    else {
      try {
        const { username, password } = config.tesla
        const { refreshToken: newRefreshToken, authToken: newAuthToken } = await teslaLogin(username, password)
        authToken = newAuthToken
        refreshToken = newRefreshToken
        log.info(`Successfully obtained tesla auth token`)
      }
      catch (e) {
        log.error(`Error logging into tesla account. ${e}`)
        throw e
      }
    }
  }
}

async function teslaApi(log, action) {
  try {
    await refreshCredentials(log)
    return await action()
  }
  catch (e) {
    if (typeof(e) === 'string' && e.includes('408')) {
      log.error(`Timeout during tesla api call, possibly car is asleep.`)
      throw { statusCode: 408, message: 'Car is asleep' }
    }
    else {
      log.error(`Error during tesla api call. ${e}`)
      throw { statusCode: 500 }
    }
  }
}