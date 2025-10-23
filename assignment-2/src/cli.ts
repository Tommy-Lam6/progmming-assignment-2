import { main } from './processor'

try {
  main(process.argv)
} catch (error) {
  console.error(error)
  process.exit(1)
}
