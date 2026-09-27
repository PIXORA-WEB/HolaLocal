# DRAFT — LEGAL REVIEW RECOMMENDED

Internal assessment for Privacy/Terms 1.2, target publication 2026-09-27. This is a working product assessment, not legal advice, professional approval or permission to activate translation. Owner: HolaLocal, operated by Craig Evans. Contact: hello@holalocal.es.

## Purpose and interest

Enable local customers and businesses who use different languages to communicate through HolaLocal's core private messaging feature. Article 6(1)(f) is the working Article 6 basis for this draft. The interest is communication within an existing private conversation, not advertising, publication, profiling or model training.

## Necessity and alternatives

Recipient-language translation reduces communication barriers where messaging is the core contact method. Manual copy/paste into another translator adds friction and exposes text to a provider chosen outside HolaLocal's safeguards. That makes it a less effective practical alternative for multilingual use, but inconvenience alone does not establish legal necessity. A reviewer must assess whether default-ON processing is proportionate compared with an on-demand/default-OFF design, including users' reasonable expectations and the possibility that a sender has opted out of their own incoming translations.

Limit processing to eligible new text messages, one recipient target, with no public exposure, historical backfill or routine staff translation/review. No separate names, emails, UIDs or conversation/message IDs are sent as translation fields. Those details may nevertheless occur in free text; minimisation is not anonymisation.

## Balancing and safeguards

Each recipient can independently opt out in Profile. The sender's incoming-message preference does not control the other participant's processing. Originals remain available; View original is display-only. The worker enforces saved preference at its reviewed checkpoints and re-enable cutoff. One target only; no all-language fan-out. Credentials stay server-side. Requests use the EU endpoint and europe-west1, without promising that all associated provider operations stay in one region.

Google states translation text is handled briefly in memory for service provision and not used to train/improve Translation features. Do not extend that statement to operational/security/billing records. HolaLocal stores the successful translation and language/status metadata with the message; retention follows the message. Inbox hiding is not deletion and account deletion does not imply immediate erasure of all conversation history. Existing security/moderation/legal-access provisions remain.

## Risks and mitigations

Private text may contain personal data, third-party information or special-category data. Warn against unnecessary sensitive information; provide clear disclosure of text transmission. This draft does NOT establish an Article 9 condition or claim special-category consent. Legal review must determine the implications and any additional safeguards before activation.

Translation can be inaccurate/unavailable: label translated display, retain originals and ask users to confirm prices, dates, addresses and safety instructions directly. Already-sent provider requests cannot be withdrawn after opt-out; disclose that limitation. Existing translations can remain viewable while OFF and are not automatically deleted. Re-enable does not backfill, and language changes do not automatically retranslate older messages.

## Rights and operational follow-up

Recipients can switch off incoming automatic translation. The switch is not consent and opt-out does not itself supply the lawful basis. Anyone may object to legitimate-interest processing or exercise applicable rights through hello@holalocal.es; follow the existing identity-verification and rights-request workflow. Assess objections rather than assuming that a recipient setting resolves all sender/third-party concerns. Preserve the policy's AEPD complaint route.

Before approval record the balancing conclusion, reviewer/date, provider terms/transfer safeguards, mobile opt-out accessibility and monitoring arrangements. Reassess on material provider, payload, retention or product changes. No approval is recorded in this draft.

## Sources checked for this draft

- GDPR Article 6(1)(f), Article 21: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- EDPB Guidelines 1/2024 consultation materials (not labelled here as final approval): https://www.edpb.europa.eu/public-consultations/guidelines-12024-on-processing-of-personal-data-based-on-article-61f-gdpr_en
- Google data usage: https://docs.cloud.google.com/translate/data-usage
- Google endpoints: https://docs.cloud.google.com/translate/docs/advanced/endpoints
