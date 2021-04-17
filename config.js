import { exit } from 'process'
import dotenv from 'dotenv'
if (dotenv.config().error) {
  console.error('Unable to configure application, did you create a .env file?')
  exit(1)
}

export default {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '80',
  authorization: process.env.AUTHORIZATION,
  logging: {
    level: process.env.LOGGING_LEVEL || 'info'
  },
  myQ: {
    username: process.env.MYQ_USERNAME,
    password: process.env.MYQ_PASSWORD,
    device: process.env.MYQ_DEVICE
  },
  tesla: {
    username: process.env.TESLA_USERNAME,
    password: process.env.TESLA_PASSWORD,
    id: process.env.TESLA_ID,
    vehicleId: process.env.TESLA_VEHICLE_ID
  }
}