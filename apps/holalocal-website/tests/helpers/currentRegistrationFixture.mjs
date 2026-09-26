// Current-account setup only. Historical acceptance must be seeded explicitly,
// never passed as input to the production CURRENT registration validator.
import { doc, setDoc } from 'firebase/firestore'
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../../../../shared/firebase-contract/legalConsent.js'
import { BUNDLED_LEGAL_PUBLICATION } from '../../../../shared/firebase-contract/legalNotice.js'
import { buildRegistrationProfile } from '../../../holalocal-app/src/services/userPayloads.js'

export function buildCurrentRegistrationFixture(uid, timestampFactory) {
  return buildRegistrationProfile(uid, {
    email: `${uid}@example.invalid`, termsAccepted: true, privacyAccepted: true,
    termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
  }, timestampFactory)
}

export async function seedCurrentLegalPublication(environment) {
  await environment.withSecurityRulesDisabled(context => setDoc(
    doc(context.firestore(), 'legalPublications', 'current'), BUNDLED_LEGAL_PUBLICATION,
  ))
}
