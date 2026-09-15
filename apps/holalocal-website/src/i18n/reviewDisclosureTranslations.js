// Compatibility access for full-layer consumers; runtime legal pages load individual slices.
import { reviewNotices } from './legalDisclosures/reviewNotices.js'
import { reviewPrivacySection as privacy, reviewTermsSection as terms } from './legalDisclosures/createReviewSections.js'
import en from './legalDisclosures/review-en.js'
import es from './legalDisclosures/review-es.js'
import fr from './legalDisclosures/review-fr.js'
import de from './legalDisclosures/review-de.js'
import nl from './legalDisclosures/review-nl.js'
import pt from './legalDisclosures/review-pt.js'
import pl from './legalDisclosures/review-pl.js'
import ro from './legalDisclosures/review-ro.js'
import cs from './legalDisclosures/review-cs.js'
import sk from './legalDisclosures/review-sk.js'
import hu from './legalDisclosures/review-hu.js'
import uk from './legalDisclosures/review-uk.js'
import it from './legalDisclosures/review-it.js'
import sv from './legalDisclosures/review-sv.js'
import da from './legalDisclosures/review-da.js'
import fi from './legalDisclosures/review-fi.js'
import no from './legalDisclosures/review-no.js'
const copies = { en, es, fr, de, nl, pt, pl, ro, cs, sk, hu, uk, it, sv, da, fi, no }
export const reviewDisclosureTranslations = Object.fromEntries(Object.entries(copies).map(([code, copy]) => [code, [...copy, ...reviewNotices[code]]]))
export function reviewPrivacySection(code, availability) { return privacy(reviewDisclosureTranslations[code], availability) }
export function reviewTermsSection(code, availability, text) { return terms(reviewDisclosureTranslations[code], availability, text) }
