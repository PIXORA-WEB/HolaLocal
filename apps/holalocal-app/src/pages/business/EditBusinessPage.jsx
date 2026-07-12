import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SERVICE_AREA_LABELS } from '@holalocal/firebase-contract'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { getBusinessByOwnerId, updateBusinessProfile } from '../../services/businessService.js'
import { BUSINESS_CATEGORY_KEYS, CANONICAL_BUSINESS_CATEGORIES } from '../../services/businessPayloads.js'
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
          primaryCategoryId: profile.primaryCategoryId,
          categoryIds: [...profile.categoryIds],
          serviceAreas: [...profile.serviceAreas],
          serviceRadiusKm: profile.serviceRadiusKm ?? 20,
          location: { ...profile.location },
          languages: [...profile.languages],
          primaryLanguage: profile.primaryLanguage,
        })
      })
      .catch((caught) => { if (active) setError(getAuthenticationErrorMessage(caught, t)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [t, user.uid, userProfile.businessId])

  function field(name, value) { setForm((current) => ({ ...current, [name]: value })) }
  function location(name, value) {
    setForm((current) => ({ ...current, location: { ...current.location, [name]: value } }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateBusinessProfile(business.businessId, form)
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
        <label htmlFor="business-category">{t('business.fields.category')}</label>
        <select id="business-category" onChange={(event) => field('primaryCategoryId', event.target.value)} required value={form.primaryCategoryId}>
          <option value="">{t('business.fields.chooseCategory')}</option>
          {CANONICAL_BUSINESS_CATEGORIES.map((category) => <option key={category} value={category}>{t(`business.categoryLabels.${BUSINESS_CATEGORY_KEYS[category]}`)}</option>)}
        </select>
        <label htmlFor="business-categories">{t('business.fields.categories')}</label>
        <select id="business-categories" multiple onChange={(event) => field('categoryIds', selectedValues(event))} value={form.categoryIds}>
          {CANONICAL_BUSINESS_CATEGORIES.map((category) => <option key={category} value={category}>{t(`business.categoryLabels.${BUSINESS_CATEGORY_KEYS[category]}`)}</option>)}
        </select>
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
