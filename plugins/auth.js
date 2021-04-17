import plugin from 'fastify-plugin'
import config from '../config.js'

export default plugin(async function (fastify, opts) {
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.headers.authorization !== config.authorization) {
      throw { statusCode: 401, message: "Unauthorized" }
    }
  })
})
