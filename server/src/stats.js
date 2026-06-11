import os from 'node:os'
import { readFile, readdir } from 'node:fs/promises'

let prevCpu = null

function cpuTimes() {
  const cpus = os.cpus()
  let idle = 0, total = 0
  for (const c of cpus) {
    for (const [k, v] of Object.entries(c.times)) {
      total += v
      if (k === 'idle') idle += v
    }
  }
  return { idle, total }
}

export function cpuPercent() {
  const now = cpuTimes()
  let pct = 0
  if (prevCpu) {
    const dTotal = now.total - prevCpu.total
    const dIdle = now.idle - prevCpu.idle
    pct = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0
  }
  prevCpu = now
  return pct
}

// Batería vía /sys (Linux). En desktop normalmente no hay: devuelve null.
async function battery() {
  try {
    const base = '/sys/class/power_supply'
    const entries = await readdir(base)
    const bat = entries.find(e => e.startsWith('BAT'))
    if (!bat) return null
    const capacity = Number((await readFile(`${base}/${bat}/capacity`, 'utf8')).trim())
    const status = (await readFile(`${base}/${bat}/status`, 'utf8')).trim()
    return { capacity, charging: status === 'Charging' }
  } catch {
    return null
  }
}

export async function getStats() {
  return {
    hostname: os.hostname(),
    uptime: os.uptime(),
    load: os.loadavg()[0],
    cpu: cpuPercent(),
    mem: {
      total: os.totalmem(),
      used: os.totalmem() - os.freemem()
    },
    battery: await battery(),
    time: Date.now()
  }
}
