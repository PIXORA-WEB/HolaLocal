import { validateCleanupAuditOptions } from '../testDataCleanupAudit/config.js'

export const CONFIRMATION_PHRASE = 'DELETE CONFIRMED HOLALOCAL TEST DATA'

export function parseExecutionArguments(values) {
  const options = {
    apply: false,
    approvedReportPath: '',
    confirmationPhrase: '',
    confirmProject: '',
    emulator: false,
    help: false,
    outputDir: '',
    pageSize: 100,
    projectId: '',
    protectedUids: [],
    targetUids: [],
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const next = () => {
      index += 1
      if (index >= values.length) throw new Error(`Missing value for ${value}`)
      return values[index]
    }
    const addList = (target, raw) => target.push(...String(raw).split(',').map((item) => item.trim()).filter(Boolean))

    if (value === '--help') options.help = true
    else if (value === '--apply') options.apply = true
    else if (value === '--emulator') options.emulator = true
    else if (value === '--project-id') options.projectId = next()
    else if (value.startsWith('--project-id=')) options.projectId = value.slice(13)
    else if (value === '--confirm-project') options.confirmProject = next()
    else if (value.startsWith('--confirm-project=')) options.confirmProject = value.slice(18)
    else if (value === '--target-uid') addList(options.targetUids, next())
    else if (value.startsWith('--target-uid=')) addList(options.targetUids, value.slice(13))
    else if (value === '--target-uids') addList(options.targetUids, next())
    else if (value.startsWith('--target-uids=')) addList(options.targetUids, value.slice(14))
    else if (value === '--protected-uid') addList(options.protectedUids, next())
    else if (value.startsWith('--protected-uid=')) addList(options.protectedUids, value.slice(16))
    else if (value === '--protected-uids') addList(options.protectedUids, next())
    else if (value.startsWith('--protected-uids=')) addList(options.protectedUids, value.slice(17))
    else if (value === '--output-dir') options.outputDir = next()
    else if (value.startsWith('--output-dir=')) options.outputDir = value.slice(13)
    else if (value === '--approved-dry-run-report') options.approvedReportPath = next()
    else if (value.startsWith('--approved-dry-run-report=')) options.approvedReportPath = value.slice(26)
    else if (value === '--confirmation-phrase') options.confirmationPhrase = next()
    else if (value.startsWith('--confirmation-phrase=')) options.confirmationPhrase = value.slice(22)
    else if (value === '--page-size') options.pageSize = Number(next())
    else if (value.startsWith('--page-size=')) options.pageSize = Number(value.slice(12))
    else if (/^--(write|fix|migrate|cleanup|execute|run|remove|destroy|purge)(=|$)/.test(value)) {
      throw new Error(`${value} is not supported. Use --apply with the exact confirmation phrase.`)
    } else throw new Error(`Unknown argument: ${value}`)
  }

  return options.help ? options : validateExecutionOptions(options)
}

export function validateExecutionOptions(options) {
  const validated = validateCleanupAuditOptions(options)
  if (!options.approvedReportPath) throw new Error('Missing required --approved-dry-run-report.')
  if (options.apply && options.confirmationPhrase !== CONFIRMATION_PHRASE) {
    throw new Error('Production cleanup requires the exact confirmation phrase.')
  }
  return {
    ...validated,
    apply: Boolean(options.apply),
    approvedReportPath: options.approvedReportPath,
    confirmationPhrase: options.confirmationPhrase,
  }
}

export function executionHelp() {
  return `Usage:
  npm run cleanup:test-data-controlled -- --project-id <project-id> --confirm-project <project-id> --target-uid <uid> --target-uid <uid> --target-uid <uid> --target-uid <uid> --protected-uid <uid> --protected-uid <uid> --approved-dry-run-report <path> --output-dir <private-dir>

Defaults to dry-run mode. Production deletion additionally requires:
  --apply --confirmation-phrase "${CONFIRMATION_PHRASE}"

No Storage deletion is implemented.`
}
