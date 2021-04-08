import { createLogger } from '@generates/logger'
import Docker from 'dockerode'
import { asleep } from '@ianwalter/sleep'

const logger = createLogger({ level: 'info', namespace: 'bff.provisioner' })
const docker = new Docker()

export default {
  async beforeEach (_, context) {
    const { containers } = context.provisioner
    if (containers) {
      logger.debug('Provisioning containers', containers)

      context.testContext.containers = []
      for (const config of containers) {
        //
        if (config.Labels) {
          config.Labels.push('bff')
        } else {
          config.Labels = ['bff']
        }

        try {
          const container = await docker.createContainer(config)
          logger.debug('Created container', container)

          context.testContext.containers.push(container.id)

          await container.start()
          logger.debug('Started container', container.id)

          await asleep(9999)
        } catch (err) {
          logger.error(err)
        }
      }
    }
  },
  async afterEach (_, context) {
    for (const id of context.testContext.containers || []) {
      try {
        const container = docker.getContainer(id)
        await container.stop()
        logger.debug('Stopped container', id)

        await container.remove()
        logger.debug('Removed container', id)
      } catch (err) {
        logger.error(err)
      }
    }
  },

}
