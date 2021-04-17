import plugin from 'fastify-plugin'
import sensible from 'fastify-sensible'

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default plugin(async function (fastify, opts) {
  fastify.register(sensible, {
    errorHandler: false
  })
})
