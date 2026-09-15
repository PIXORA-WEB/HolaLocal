// Aggregate access for layer-level tests and tooling. Runtime loads one slice directly.
import ro from './completion/completion-ro.js'
import pl from './completion/completion-pl.js'
import cs from './completion/completion-cs.js'
import sk from './completion/completion-sk.js'
import hu from './completion/completion-hu.js'
import uk from './completion/completion-uk.js'
import it from './completion/completion-it.js'
import fi from './completion/completion-fi.js'
import sv from './completion/completion-sv.js'
import da from './completion/completion-da.js'
import no from './completion/completion-no.js'

export const fallbackLocaleCompletionTranslations = { ro, pl, cs, sk, hu, uk, it, fi, sv, da, no }
