import {
  loginAsync as teslaLogin,
  refreshTokenAsync as teslaRefreshToken,
  windowControlAsync as teslaWindowControl,
  wakeUpAsync as teslaWakeUp
} from 'teslajs'
import config from '../config.js'

const MILLISECONDS_PER_WEEK = 604800000

const options = {
  authToken: null,
  vehicleID: config.tesla.vehicleId
}
var refreshToken = null

// once a week we'll force the refreshing of our token (it expires every 45 days)
setInterval(() => {
  options.authToken = null
}, MILLISECONDS_PER_WEEK);

export default async function (fastify, opts) {
  fastify.put('/car/vent_windows', ventWindows)
  fastify.put('/car/close_windows', closeWindows)
  fastify.put('/car/wake_up', wakeUp)
}

async function ventWindows(request, reply) {
  await teslaApi(request, () => teslaWindowControl(options, 'vent'))
  reply.code(204)
}

async function closeWindows(request, reply) {
  await teslaApi(request, () => teslaWindowControl(options, 'close'))
  reply.code(204)
}

async function wakeUp(request, reply) {
  await teslaApi(request, () => teslaWakeUp(options))
  reply.code(204)
}

async function refreshCredentials(request) {
  if (options.authToken === null) {
    if (refreshToken !== null) {
      try {
        const { refreshToken: newRefreshToken, authToken: newAuthToken } = await teslaRefreshToken(refreshToken)
        refreshToken = newRefreshToken
        options.authToken = newAuthToken
        request.log.info(`Successfully refreshed tesla auth token`)
      }
      catch (e) {
        request.log.error(`Error refreshing tesla auth token, will try logging again. ${e}`)
      }
    }
    else {
      try {
        const { username, password } = config.tesla
        const { refreshToken: newRefreshToken, authToken: newAuthToken } = await teslaLogin(username, password)
        options.authToken = newAuthToken
        refreshToken = newRefreshToken
        request.log.info(`Successfully obtained tesla auth token`)
      }
      catch (e) {
        request.log.error(`Error logging into tesla account. ${e}`)
        throw e
      }
    }
  }
}

async function teslaApi(request, action) {
  try {
    await refreshCredentials(request)
    await action()
  }
  catch (e) {
    if (typeof(e) === 'string' && e.includes('408')) {
      request.log.error(`Timeout during tesla api call, possibly car is asleep.`)
      throw { statusCode: 408, message: 'Car is asleep' }
    }
    else {
      request.log.error(`Error during tesla api call. ${e}`)
      throw { statusCode: 500 }
    }
  }
}
