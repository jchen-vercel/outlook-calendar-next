import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Inspect generated assets, not source CSS: a successful compilation can still
// produce a deployment without the showcase stylesheet.
async function cssAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? cssAssets(path) : entry.name.endsWith('.css') ? [path] : []
  }))
  return files.flat()
}

const requiredSelectors = [
  '.showcase-shell',
  '.showcase-workspace',
  '.scenario-tabs',
  '.approach-grid',
  '.live-calendar-panel',
  '.skip-link',
]

try {
  const files = await cssAssets('.next/static')
  const output = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  const missing = requiredSelectors.filter((selector) => !output.includes(selector))
  if (missing.length) {
    throw new Error(`Missing showcase layout rules in production CSS: ${missing.join(', ')}`)
  }
  console.log(`Production CSS verified: ${requiredSelectors.length} showcase selectors in ${files.length} stylesheet(s).`)
} catch (error) {
  console.error(`Production CSS verification failed. ${error.message}`)
  process.exitCode = 1
}
