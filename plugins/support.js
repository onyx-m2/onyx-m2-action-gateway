import plugin from 'fastify-plugin'

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope

export default plugin(async function (fastify, opts) {
  fastify.decorate('someSupport', function () {
    return 'hugs'
  })
})
