import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getServiceIdsForGroup,
  getServiceTaxonomyService,
  MAX_BUSINESS_SERVICE_SELECTIONS,
  MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH,
  SERVICE_AREA_LABELS,
  SERVICE_TAXONOMY_GROUPS,
} from '@holalocal/firebase-contract'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getBusinessByOwnerId, updateBusinessProfile } from '../../services/businessService.js'
import {
  beginMobileTaxonomyEdit,
  deriveMobileBusinessTaxonomy,
  selectMobilePrimaryService,
  selectMobileTaxonomyGroup,
  toggleMobileAdditionalService,
} from '../../services/businessTaxonomyForm.js'
import { getLanguageDisplayName, supportedAccountLanguageCodes } from '../../utils/languages.js'

function selectedValues(event) {
  return [...event.target.selectedOptions].map(({ value }) => value)
}

function EditBusinessPage() {
  const { i18n, t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [business, setBusiness] = useState(null)
  const [form, setForm] = useState(null)
  const [taxonomy, setTaxonomy] = useState(null)
  const [taxonomyDirty, setTaxonomyDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getBusinessByOwnerId(user.uid, userProfile.businessId)
      .then((profile) => {
        if (!active) return
        setBusiness(profile)
        if (profile) setForm({
          name: profile.name,
          tagline: profile.tagline,
          description: profile.description,
          serviceAreas: [...profile.serviceAreas],
          serviceRadiusKm: profile.serviceRadiusKm ?? 20,
          location: { ...profile.location },
          languages: [...profile.languages],
          primaryLanguage: profile.primaryLanguage,
        })
        if (profile) {
          setTaxonomy(deriveMobileBusinessTaxonomy(profile))
          setTaxonomyDirty(false)
        }
      })
      .catch((caught) => { if (active) setError(getAuthenticationErrorMessage(caught, t)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [t, user.uid, userProfile.businessId])

  function field(name, value) { setForm((current) => ({ ...current, [name]: value })) }
  function location(name, value) {
    setForm((current) => ({ ...current, location: { ...current.location, [name]: value } }))
  }
  function editTaxonomy(update) {
    setTaxonomyDirty(true)
    setTaxonomy((current) => update(current))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const requireTaxonomy = !business.primaryCategoryId
        && (!Array.isArray(business.categoryIds) || business.categoryIds.length === 0)
      await updateBusinessProfile(business.businessId, form, {
        taxonomy, taxonomyDirty, requireTaxonomy,
      })
      navigate('/business/dashboard', { replace: true })
    } catch (caught) {
      setError(getAuthenticationErrorMessage(caught, t))
    } finally { setSaving(false) }
  }

  if (loading) return <LoadingScreen message={t('business.loading')} />
  if (error && !business) return <p className="form-message form-message--error" role="alert">{error}</p>
  if (!business) return <section className="business-form-page"><h1>{t('business.setupDeferred.title')}</h1><p>{t('business.setupDeferred.description')}</p></section>
  if (!business.editSupport.supported) return <section className="business-form-page"><h1>{t('business.readOnly.title')}</h1><p>{t('business.readOnly.description')}</p></section>

  const customLanguages = business.languageValues.filter(({ isCustom }) => isCustom)
  const customAreas = business.serviceAreaValues.filter(({ isCustom }) => isCustom)
  const mainServiceOptions = getServiceIdsForGroup(taxonomy.groupId)
    .map(getServiceTaxonomyService)
  const otherSelected = taxonomy.primaryServiceId === 'other-local-service'
    || taxonomy.additionalServiceIds.includes('other-local-service')
  return (
    <section className="business-form-page">
      <h1>{t('business.edit')}</h1>
      <p>{t('business.editScope')}</p>
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <form className="auth-form business-form" onSubmit={submit}>
        <label htmlFor="business-name">{t('business.fields.name')}</label>
        <input id="business-name" maxLength={120} onChange={(event) => field('name', event.target.value)} required value={form.name} />
        <label htmlFor="business-tagline">{t('business.fields.tagline')}</label>
        <input id="business-tagline" maxLength={160} onChange={(event) => field('tagline', event.target.value)} value={form.tagline} />
        <label htmlFor="business-description">{t('business.fields.description')}</label>
        <textarea id="business-description" maxLength={2000} onChange={(event) => field('description', event.target.value)} required value={form.description} />
        <section className="mobile-taxonomy" aria-labelledby="business-services-title">
          <h2 id="business-services-title">{t('business.taxonomyEditor.title')}</h2>
          <p>{t('business.taxonomyEditor.description')}</p>
          {taxonomy.hasLegacyValues && (
            <div className="mobile-taxonomy__legacy" role="status">
              <strong>{t('business.taxonomyEditor.legacyTitle')}</strong>
              <p>{t('business.taxonomyEditor.legacyDescription')}</p>
              {taxonomy.unresolvedValues.length > 0 && (
                <p>{t('business.taxonomyEditor.currentLegacyValues')}: {taxonomy.unresolvedValues.join(', ')}</p>
              )}
              {!taxonomy.editing && (
                <button className="button button--secondary" onClick={() => editTaxonomy(beginMobileTaxonomyEdit)} type="button">
                  {t('business.taxonomyEditor.updateServices')}
                </button>
              )}
            </div>
          )}
          <label htmlFor="business-service-group">{t('business.taxonomyEditor.serviceGroup')}</label>
          <select
            disabled={!taxonomy.editing}
            id="business-service-group"
            onChange={(event) => editTaxonomy((current) => selectMobileTaxonomyGroup(current, event.target.value))}
            required
            value={taxonomy.groupId}
          >
            <option value="">{t('business.taxonomyEditor.chooseGroup')}</option>
            {SERVICE_TAXONOMY_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>{t(group.translationKey, { defaultValue: group.defaultLabel })}</option>
            ))}
          </select>
          <label htmlFor="business-category">{t('business.taxonomyEditor.mainService')}</label>
          <select
            disabled={!taxonomy.editing || !taxonomy.groupId}
            id="business-category"
            onChange={(event) => editTaxonomy((current) => selectMobilePrimaryService(current, event.target.value))}
            required
            value={taxonomy.primaryServiceId}
          >
            <option value="">{t('business.taxonomyEditor.chooseMain')}</option>
            {mainServiceOptions.map((service) => (
              <option key={service.id} value={service.id}>{t(service.translationKey, { defaultValue: service.defaultLabel })}</option>
            ))}
          </select>
          <fieldset className="checkbox-group" id="business-additional-services">
            <legend>{t('business.taxonomyEditor.additionalServices')}</legend>
            {SERVICE_TAXONOMY_GROUPS.map((group) => (
              <div className="mobile-taxonomy__group" key={group.id}>
                <strong>{t(group.translationKey, { defaultValue: group.defaultLabel })}</strong>
                <div className="checkbox-group__options">
                  {getServiceIdsForGroup(group.id)
                    .filter((serviceId) => serviceId !== taxonomy.primaryServiceId)
                    .map((serviceId) => {
                      const service = getServiceTaxonomyService(serviceId)
                      const selected = taxonomy.additionalServiceIds.includes(serviceId)
                      const disabled = !taxonomy.editing || (
                        taxonomy.additionalServiceIds.length >= MAX_BUSINESS_SERVICE_SELECTIONS - 1 && !selected
                      )
                      return (
                        <label key={serviceId}>
                          <input
                            checked={selected}
                            disabled={disabled}
                            onChange={() => editTaxonomy((current) => toggleMobileAdditionalService(current, serviceId))}
                            type="checkbox"
                          />
                          <span>{t(service.translationKey, { defaultValue: service.defaultLabel })}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            ))}
          </fieldset>
          <p className="mobile-taxonomy__limit">
            {t('business.taxonomyEditor.additionalLimit', {
              selected: taxonomy.additionalServiceIds.length,
              count: MAX_BUSINESS_SERVICE_SELECTIONS - 1,
            })}
          </p>
          {otherSelected && (
            <div className="custom-option-field">
              <label htmlFor="business-custom-service">{t('business.taxonomyEditor.customDescription')}</label>
              <input
                aria-describedby="business-custom-service-help"
                disabled={!taxonomy.editing}
                id="business-custom-service"
                maxLength={MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH}
                onChange={(event) => editTaxonomy((current) => ({
                  ...current, customServiceDescription: event.target.value,
                }))}
                required
                value={taxonomy.customServiceDescription}
              />
              <small id="business-custom-service-help">
                {t('business.taxonomyEditor.customDescriptionLimit', { count: MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH })}
              </small>
            </div>
          )}
        </section>
        <label htmlFor="business-areas">{t('business.fields.serviceAreas')}</label>
        <select id="business-areas" multiple onChange={(event) => field('serviceAreas', selectedValues(event))} value={form.serviceAreas}>
          {Object.entries(SERVICE_AREA_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          {customAreas.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
        <label htmlFor="business-radius">{t('business.fields.radius')}</label>
        <input id="business-radius" max="500" min="0" onChange={(event) => field('serviceRadiusKm', event.target.value)} type="number" value={form.serviceRadiusKm} />
        <label htmlFor="business-locality">{t('business.fields.locality')}</label>
        <input id="business-locality" onChange={(event) => location('locality', event.target.value)} value={form.location.locality ?? ''} />
        <label htmlFor="business-region">{t('business.fields.region')}</label>
        <input id="business-region" onChange={(event) => location('region', event.target.value)} value={form.location.region ?? ''} />
        <label htmlFor="business-country">{t('business.fields.countryCode')}</label>
        <input id="business-country" maxLength="2" onChange={(event) => location('countryCode', event.target.value)} value={form.location.countryCode ?? ''} />
        <label htmlFor="business-languages">{t('business.fields.languages')}</label>
        <select id="business-languages" multiple onChange={(event) => field('languages', selectedValues(event))} value={form.languages}>
          {supportedAccountLanguageCodes.map((code) => <option key={code} value={code}>{getLanguageDisplayName(code, i18n.resolvedLanguage)}</option>)}
          {customLanguages.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
        <label htmlFor="business-primary-language">{t('business.primaryLanguage')}</label>
        <select id="business-primary-language" onChange={(event) => field('primaryLanguage', event.target.value)} required value={form.primaryLanguage ?? ''}>
          {form.languages.map((code) => <option key={code} value={code}>{getLanguageDisplayName(code, i18n.resolvedLanguage)}</option>)}
        </select>
        <p className="form-message" role="status">{t('business.contactMediaReadOnly')}</p>
        <button className="button button--primary" disabled={saving} type="submit">{saving ? t('business.saving') : t('business.save')}</button>
      </form>
    </section>
  )
}

export default EditBusinessPage
