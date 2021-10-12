import {
  loginAsync as teslaLogin,
  refreshTokenAsync as teslaRefreshToken,
  windowControlAsync as teslaWindowControl,
  wakeUpAsync as teslaWakeUp,
  vehiclesAsync as teslaVehicles
} from 'teslajs'
import config from '../config.js'

// NOTE: As of this writing, the login and refresh functionality is broken, see upstream
// issue here: https://github.com/mseminatore/TeslaJS/issues/261

// THEREFORE, any access token put in .env will only last 8 hours!!!

const MILLISECONDS_PER_4_HOURS = 14400000

var { accessToken, refreshToken } = config.tesla
var vehicleID = config.tesla.vehicleId

export default async function (fastify, opts) {
  fastify.put('/car/vent_windows', ventWindows)
  fastify.put('/car/close_windows', closeWindows)
  fastify.put('/car/wake_up', wakeUp)

  // verify credentials and vehicle configuration
  try {
    //await refreshCredentials(fastify.log)
    const vehicles = await teslaVehicles({ authToken: accessToken })
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

    // refresh token when needed (it expires every 8 hours as of Oct 2021)
    setInterval(() => {
      refreshCredentials(fastify.log)
    }, MILLISECONDS_PER_4_HOURS);

  }
  catch (e) {
    fastify.log.error(`Failed to initialize vehicles, car features disabled. (${e})`)
  }
}

async function ventWindows(request, reply) {
  await teslaApi(request.log, () => teslaWindowControl({ authToken: accessToken, vehicleID }, 'vent'))
  return reply.code(204)
}

async function closeWindows(request, reply) {
  await teslaApi(request.log, () => teslaWindowControl({ authToken: accessToken, vehicleID }, 'close'))
  reply.code(204)
}

async function wakeUp(request, reply) {
  await teslaApi(request.log, () => teslaWakeUp({ authToken: accessToken, vehicleID }))
  reply.code(204)
}

async function refreshCredentials(log) {
  if (refreshToken !== null) {
    try {
      const { response, refreshToken: newRefreshToken, authToken: newAccessToken } = await teslaRefreshToken(refreshToken)
      refreshToken = newRefreshToken
      accessToken = newAccessToken
      log.info(`Successfully refreshed tesla auth token ${JSON.stringify(response)}`)
    }
    catch (e) {
      log.error(`Error refreshing tesla auth token, will try logging again. ${e}`)
    }
  }
  else {
    try {
      const { username, password } = config.tesla
      const { refreshToken: newRefreshToken, authToken: newAccessToken } = await teslaLogin(username, password)
      accessToken = newAccessToken
      refreshToken = newRefreshToken
      log.info(`Successfully obtained tesla auth token`)
    }
    catch (e) {
      log.error(`Error logging into tesla account. ${e}`)
      throw e
    }
  }
}

async function teslaApi(log, action) {
  try {
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