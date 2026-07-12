#!/usr/bin/env node
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Socket } from 'node:net'
import { createAdminAuditSource } from './adminSource.js'
import { auditHelp, parseAuditArguments, safeErrorDetails, validateExecutionEnvironment } from './config.js'
import { runFirebaseAudit } from './auditCore.js'
import { humanSummary, writeAuditReports } from './reportWriter.js'

function checkTcpEndpoint(endpoint) {
  return new Promise((resolveCheck, rejectCheck) => {
    const [host, portText] = endpoint.split(':')
    const port = Number(portText)
    if (!host || !Number.isInteger(port)) {
      rejectCheck(new Error('Invalid emulator host format.'))
      return
    }
    const socket = new Socket()
    socket.setTimeout(2000)
    socket.once('connect', () => {
      socket.destroy()
      resolveCheck()
    })
    socket.once('timeout', () => {
      socket.destroy()
      rejectCheck(new Error('Emulator connection timed out.'))
    })
    socket.once('error', () => rejectCheck(new Error('Emulator connection failed.')))
    socket.connect(port, host)
  })
}

async function main() {
  const options = parseAuditArguments(process.argv.slice(2))
  if (options.help) {
    console.log(auditHelp())
    return
  }
  const identity = await validateExecutionEnvironment(options, {
    env: process.env,
    readTextFile: readFile,
    checkFirestoreEmulator: checkTcpEndpoint,
  })
  console.log(`[firebase-audit] Project: ${options.projectId}`)
  console.log(`[firebase-audit] Mode: ${options.emulator ? 'emulator' : 'confirmed non-emulator read-only'}`)
  console.log(`[firebase-audit] Credential project: ${identity.credentialProjectStatus}`)
  console.log(`[firebase-audit] Collections: ${options.collectionScope.join(', ')}`)
  console.log(`[firebase-audit] Output directory: ${resolve(options.outputDir)}`)
  const source = createAdminAuditSource(options)
  const report = await runFirebaseAudit(source, options)
  const paths = await writeAuditReports(report, options.outputDir)
  console.log(humanSummary(report))
  console.log(`[firebase-audit] JSON report: ${paths.jsonPath}`)
  console.log(`[firebase-audit] Summary report: ${paths.summaryPath}`)
  if (report.metadata.complete !== true) process.exitCode = 2
}

main().catch((error) => {
  const safe = safeErrorDetails(error, { check: 'cli' })
  console.error(`[firebase-audit] ${safe.message}`)
  process.exitCode = 1
})
