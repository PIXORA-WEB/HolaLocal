import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SelectField from '../../components/common/SelectField.jsx'
import ServiceAreaSelector from '../../components/business/ServiceAreaSelector.jsx'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import { EditableImageAvatar } from '../../components/common/PublicBusinessCard.jsx'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  createBusinessProfile,
  deleteBusinessGalleryImage,
  getBusinessByOwnerId,
  uploadBusinessGalleryImages,
  uploadBusinessLogo,
  updateBusinessProfile,
} from '../../services/businessService.js'
import {
  businessCategoryOptions,
  businessLanguageOptions,
  countryOptions,
  getBusinessCategoryLabel,
  normalizeCustomValues,
  provinceOptions,
  serviceAreaOptions,
} from '../../utils/business.js'
import { getLanguageNameFromCode, normalizeLanguageCode } from '../../utils/languages.js'
import { getBusinessProfileCompletion } from '../../utils/businessCompletion.js'
import {
  getServiceAreaLabel,
  normalizeCountryCode,
  normalizeProvinceId,
  normalizeServiceAreaId,
} from '../../utils/locations.js'

const emptyForm = {
  name: '',
  tagline: '',
  description: '',
  primaryCategoryId: '',
  categoryIds: [],
  phone: '',
  phoneVisible: false,
  whatsappNumber: '',
  whatsappVisible: false,
  email: '',
  emailVisible: false,
  website: '',
  websiteVisible: false,
  preferredContactMethod: 'holalocal',
  allowCallbackRequests: false,
  city: '',
  province: '',
  country: 'ES',
  serviceAreas: [],
  serviceRadiusKm: 20,
  languages: ['en'],
  primaryLanguage: 'en',
}

function prepareCustomSelection(values = [], options) {
  const optionValues = options.map((option) => typeof option === 'string' ? option : option.value)
  const customValue = values.find((value) => value !== 'Other' && value !== 'other' && !optionValues.includes(value)) ?? ''
  const selectedValues = values.filter((value) => value !== 'Other' && value !== 'other' && optionValues.includes(value))

  if (customValue) selectedValues.push(optionValues.includes('other') ? 'other' : 'Other')

  return { customValue, selectedValues }
}

function draftSignature(form, customSubcategory, customServiceArea, customLanguage) {
  return JSON.stringify({ form, customSubcategory, customServiceArea, customLanguage })
}

function CheckboxGroup({ error, id, legend, name, options, selectedValues, onToggle }) {
  const groups = options.reduce((result, option) => {
    const group = typeof option === 'string' ? '' : option.group ?? ''
    if (!result.has(group)) result.set(group, [])
    result.get(group).push(option)
    return result
  }, new Map())

  return (
    <fieldset
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      className="checkbox-group"
      id={id}
      tabIndex={error ? -1 : undefined}
    >
      <legend>{legend}</legend>
      {[...groups.entries()].map(([group, groupOptions]) => (
        <div className="checkbox-group__section" key={group || 'options'}>
          {group && <p>{groupOptions[0].groupLabel}</p>}
          <div className="checkbox-group__options">
            {groupOptions.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              return (
                <label key={optionValue}>
                  <input
                    checked={selectedValues.includes(optionValue)}
                    name={name}
                    onChange={() => onToggle(optionValue)}
                    type="checkbox"
                    value={optionValue}
                  />
                  <span>{optionLabel}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
      <FormFieldError id={`${id}-error`} message={error} />
    </fieldset>
  )
}

function EditBusinessPage() {
  const { t } = useTranslation()
  const { signOutUser, user, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [customSubcategory, setCustomSubcategory] = useState('')
  const [customServiceArea, setCustomServiceArea] = useState('')
  const [customLanguage, setCustomLanguage] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [deletingImage, setDeletingImage] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [mediaRetryAvailable, setMediaRetryAvailable] = useState(false)
  const mediaRetryRef = useRef(null)
  const [initialDraftSignature, setInitialDraftSignature] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const categoryListboxOptions = [
    { label: t('business.form.selectCategory'), value: '' },
    ...businessCategoryOptions.map((category) => ({
      label: getBusinessCategoryLabel(category.value, t),
      value: category.value,
    })),
  ]
  const provinceListboxOptions = [
    { label: t('business.form.selectProvince'), value: '' },
    ...provinceOptions.map((province) => ({ label: t(province.labelKey), value: province.value })),
  ]
  const localizedCategoryOptions = businessCategoryOptions.map((category) => ({
    ...category,
    label: getBusinessCategoryLabel(category.value, t),
  }))
  const localizedServiceAreaOptions = serviceAreaOptions.map((area) => {
    const translatedGroup = t(`locations.groups.${area.group}`)
    return {
      ...area,
      groupLabel: typeof translatedGroup === 'string' ? translatedGroup : area.group,
      label: getServiceAreaLabel(area.value, t),
    }
  })
  const localizedLanguageOptions = businessLanguageOptions.map((language) => ({
    ...language,
    label: language.value === 'other' ? t('common.other') : language.label,
  }))
  const galleryImages = businessProfile?.galleryImages?.length > 0
    ? businessProfile.galleryImages
    : (businessProfile?.galleryImageURLs ?? []).map((downloadUrl) => ({ downloadUrl }))
  const currentDraftSignature = useMemo(
    () => draftSignature(form, customSubcategory, customServiceArea, customLanguage),
    [customLanguage, customServiceArea, customSubcategory, form],
  )
  const isDirty = initialDraftSignature !== null && initialDraftSignature !== currentDraftSignature
  const countryListboxOptions = countryOptions.map((country) => ({
    label: t(country.labelKey),
    value: country.value,
  }))
  const contactMethodOptions = [
    { label: t('business.form.contact.holalocal'), value: 'holalocal' },
    { label: t('business.form.contact.phone'), value: 'phone' },
    { label: t('business.form.contact.emailLabel'), value: 'email' },
    { label: 'WhatsApp', value: 'whatsapp' },
  ]
  const completion = getBusinessProfileCompletion({
    ...businessProfile,
    ...form,
    contact: { ...(businessProfile?.contact ?? {}), preferredContactMethod: form.preferredContactMethod },
    galleryImages: businessProfile?.galleryImages,
    galleryImageURLs: businessProfile?.galleryImageURLs,
    languages: normalizeCustomValues(form.languages, customLanguage),
    location: { ...(businessProfile?.location ?? {}), locality: form.city },
    profilePhoto: businessProfile?.profilePhoto,
    serviceAreas: normalizeCustomValues(form.serviceAreas, customServiceArea),
  })

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      setError('')
      setLoading(true)
      try {
        const profile = await getBusinessByOwnerId(user.uid, userProfile.businessId)
        if (!active) return

        const loadedLanguages = (profile?.languages ?? [userProfile.preferredLocale ?? 'en'])
          .map(normalizeLanguageCode)
        const preparedSubcategories = prepareCustomSelection(
          profile?.categoryIds ?? [],
          businessCategoryOptions,
        )
        const preparedServiceAreas = prepareCustomSelection(
          (profile?.serviceAreas ?? []).map(normalizeServiceAreaId),
          serviceAreaOptions,
        )
        const preparedLanguages = prepareCustomSelection(
          loadedLanguages,
          businessLanguageOptions,
        )

        const nextForm = {
          ...emptyForm,
          email: profile?.contact?.email ?? userProfile.email ?? '',
          phone: profile?.contact?.phone ?? '',
          phoneVisible: profile?.contact?.phoneVisible === true,
          whatsappNumber: profile?.contact?.whatsappNumber ?? '',
          whatsappVisible: profile?.contact?.whatsappVisible === true,
          emailVisible: profile?.contact?.emailVisible === true,
          website: profile?.contact?.website ?? '',
          websiteVisible: profile?.contact?.websiteVisible === true,
          preferredContactMethod: profile?.contact?.preferredContactMethod ?? 'holalocal',
          allowCallbackRequests: profile?.contact?.allowCallbackRequests === true,
          city: profile?.location?.locality ?? userProfile.city ?? '',
          province: normalizeProvinceId(profile?.location?.region ?? ''),
          country: normalizeCountryCode(profile?.location?.countryCode ?? 'ES'),
          primaryLanguage: profile?.primaryLanguage ?? loadedLanguages[0] ?? 'en',
          ...(profile ?? {}),
          categoryIds: preparedSubcategories.selectedValues,
          serviceAreas: preparedServiceAreas.selectedValues,
          languages: preparedLanguages.selectedValues,
        }

        setBusinessProfile(profile)
        setCustomSubcategory(preparedSubcategories.customValue)
        setCustomServiceArea(preparedServiceAreas.customValue)
        setCustomLanguage(preparedLanguages.customValue)
        setForm(nextForm)
        setInitialDraftSignature(draftSignature(
          nextForm,
          preparedSubcategories.customValue,
          preparedServiceAreas.customValue,
          preparedLanguages.customValue,
        ))
      } catch (loadError) {
        if (active) setError(getAuthenticationErrorMessage(loadError, t))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()

    return () => {
      active = false
    }
  }, [loadAttempt, t, user.uid, userProfile])

  useEffect(() => {
    if (!isDirty) return undefined

    function warnBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }

    function warnBeforeInternalNavigation(event) {
      const link = event.target.closest?.('a[href]')
      const signOutButton = event.target.closest?.(
        '.account-menu nav button, .mobile-navigation nav button',
      )
      if (!link && !signOutButton) return
      if (link) {
        if (link.target === '_blank' || link.origin !== window.location.origin) return
        const destination = new URL(link.href)
        if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
      }
      event.preventDefault()
      event.stopPropagation()
      setPendingNavigation(signOutButton ? { type: 'signOut' } : {
        type: 'navigate',
        to: `${link.pathname}${link.search}${link.hash}`,
      })
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('click', warnBeforeInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      document.removeEventListener('click', warnBeforeInternalNavigation, true)
    }
  }, [isDirty])

  useEffect(() => {
    if (!saveSuccess) return undefined
    const timeout = window.setTimeout(() => setSaveSuccess(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [saveSuccess])

  async function leaveWithoutSaving() {
    const action = pendingNavigation
    setPendingNavigation(null)
    setInitialDraftSignature(currentDraftSignature)
    if (action?.type === 'signOut') {
      try {
        await signOutUser()
      } catch (signOutError) {
        setError(getAuthenticationErrorMessage(signOutError, t))
      }
    } else if (action?.to) {
      navigate(action.to)
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  function toggleArrayValue(field, value) {
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    setForm((current) => {
      const values = current[field]
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]

      if (field === 'languages') {
        const availableLanguages = normalizeCustomValues(nextValues, customLanguage)
        const currentPrimaryIsAvailable = availableLanguages.some(
          (language) => language.toLowerCase() === current.primaryLanguage.toLowerCase(),
        )

        return {
          ...current,
          languages: nextValues,
          primaryLanguage: currentPrimaryIsAvailable
            ? current.primaryLanguage
            : (availableLanguages[0] ?? ''),
        }
      }

      return {
        ...current,
        [field]: nextValues,
      }
    })
  }

  function handleCustomLanguageChange(value) {
    setCustomLanguage(value)
    setFieldErrors((current) => ({ ...current, customLanguage: '', languages: '' }))
    setForm((current) => {
      if (!current.languages.includes('other')) return current

      const availableLanguages = normalizeCustomValues(current.languages, value)
      const primaryIsAvailable = availableLanguages.some(
        (language) => language.toLowerCase() === current.primaryLanguage.toLowerCase(),
      )

      return {
        ...current,
        primaryLanguage: primaryIsAvailable
          ? current.primaryLanguage
          : (availableLanguages[0] ?? ''),
      }
    })
  }

  async function uploadLogoFile(file) {
    if (!businessProfile?.businessId) return
    setMediaError('')
    setLogoUploading(true)

    try {
      setBusinessProfile(await uploadBusinessLogo(businessProfile.businessId, file))
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (uploadError) {
      mediaRetryRef.current = () => void uploadLogoFile(file)
      setMediaRetryAvailable(true)
      setMediaError(uploadError.message || t('business.form.errors.logoUpload'))
    } finally {
      setLogoUploading(false)
    }
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadLogoFile(file)
  }

  async function uploadGalleryFiles(selectedFiles) {
    if (selectedFiles.length === 0 || !businessProfile?.businessId) return
    const remainingSlots = Math.max(8 - galleryImages.length, 0)
    if (remainingSlots === 0) {
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
      setMediaError(t('business.form.errors.galleryLimit'))
      return
    }

    mediaRetryRef.current = null
    setMediaRetryAvailable(false)
    setMediaError(selectedFiles.length > remainingSlots ? t('business.form.errors.galleryRemaining', { count: remainingSlots }) : '')
    setGalleryUploading(true)

    try {
      setBusinessProfile(
        await uploadBusinessGalleryImages(
          businessProfile.businessId,
          selectedFiles.slice(0, remainingSlots),
        ),
      )
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (uploadError) {
      mediaRetryRef.current = () => void uploadGalleryFiles(selectedFiles)
      setMediaRetryAvailable(true)
      setMediaError(uploadError.message || t('business.form.errors.galleryUpload'))
    } finally {
      setGalleryUploading(false)
    }
  }

  function handleGalleryUpload(event) {
    const selectedFiles = [...(event.target.files ?? [])]
    event.target.value = ''
    void uploadGalleryFiles(selectedFiles)
  }

  async function handleGalleryDelete(image) {
    if (!businessProfile?.businessId) return
    setMediaError('')
    setDeletingImage(image.storagePath || image.downloadUrl)

    try {
      setBusinessProfile(await deleteBusinessGalleryImage(businessProfile.businessId, image))
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (deleteError) {
      mediaRetryRef.current = () => void handleGalleryDelete(image)
      setMediaRetryAvailable(true)
      setMediaError(deleteError.message || t('business.form.errors.galleryDelete'))
    } finally {
      setDeletingImage('')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaveSuccess(false)
    setFieldErrors({})

    const name = form.name.trim()
    const description = form.description.trim()
    const primaryCategoryId = form.primaryCategoryId.trim()
    const city = form.city.trim()
    const usesCustomSubcategory = form.categoryIds.includes('Other')
    const usesCustomServiceArea = form.serviceAreas.includes('other')
    const usesCustomLanguage = form.languages.includes('other')

    const categoryIds = normalizeCustomValues(form.categoryIds, customSubcategory)
    const serviceAreas = normalizeCustomValues(form.serviceAreas, customServiceArea)
    const languages = normalizeCustomValues(form.languages, customLanguage)

    const nextErrors = {}
    if (!name) nextErrors.name = t('validation.businessName')
    if (!description) nextErrors.description = t('validation.businessDescription')
    if (!primaryCategoryId) nextErrors.primaryCategoryId = t('validation.category')
    if (!city) nextErrors.city = t('validation.city')
    if (usesCustomSubcategory && !customSubcategory.trim()) nextErrors.customSubcategory = t('validation.customSubcategory')
    if (usesCustomServiceArea && !customServiceArea.trim()) nextErrors.customServiceArea = t('validation.customServiceArea')
    if (usesCustomLanguage && !customLanguage.trim()) nextErrors.customLanguage = t('validation.customLanguage')
    if (languages.length === 0) nextErrors.languages = t('validation.languages')
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = t('validation.email')
    if (form.website && !URL.canParse(form.website)) nextErrors.website = t('validation.website')
    setFieldErrors(nextErrors)
    const fieldIds = {
      name: 'business-name', description: 'business-description', primaryCategoryId: 'business-main-category',
      city: 'business-city', customSubcategory: 'custom-subcategory', customServiceArea: 'custom-service-area',
      customLanguage: 'custom-language', languages: 'business-languages-group', email: 'business-email',
      website: 'business-website',
    }
    const firstInvalidField = Object.keys(fieldIds).find((field) => nextErrors[field])
    if (firstInvalidField) {
      document.getElementById(fieldIds[firstInvalidField])?.focus()
      return
    }

    const primaryLanguage =
      languages.find(
        (language) => language.toLowerCase() === form.primaryLanguage.trim().toLowerCase(),
      ) ?? languages[0]

    setSubmitting(true)

    const businessData = {
      name,
      tagline: form.tagline.trim(),
      description,
      primaryCategoryId,
      categoryIds,
      contact: {
        phone: form.phone.trim(),
        phoneVisible: form.phoneVisible,
        whatsappNumber: form.whatsappNumber.trim(),
        whatsappVisible: form.whatsappVisible,
        email: form.email.trim(),
        emailVisible: form.emailVisible,
        website: form.website.trim(),
        websiteVisible: form.websiteVisible,
        preferredContactMethod: form.preferredContactMethod,
        allowCallbackRequests: form.allowCallbackRequests,
      },
      location: {
        locality: city,
        region: form.province,
        countryCode: form.country.trim() || 'ES',
      },
      serviceAreas,
      serviceRadiusKm: Number(form.serviceRadiusKm),
      languages,
      primaryLanguage,
    }

    try {
      const savedBusiness = businessProfile
        ? await updateBusinessProfile(businessProfile.businessId, businessData)
        : await createBusinessProfile(user.uid, businessData)

      setBusinessProfile(savedBusiness)
      setInitialDraftSignature(currentDraftSignature)
      setSaveSuccess(true)
    } catch (saveError) {
      setError(getAuthenticationErrorMessage(saveError, t))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen message={t('business.control.loading')} />

  if (error && !businessProfile) {
    return (
      <RecoveryMessage
        message={error}
        onRetry={() => {
          setLoading(true)
          setError('')
          setLoadAttempt((attempt) => attempt + 1)
        }}
      />
    )
  }

  return (
    <section className="business-form-page">
      <div className="business-form-page__heading">
        <p className="placeholder-page__eyebrow">{t('business.form.eyebrow')}</p>
        <h1>{t(businessProfile?.profileCompleted ? 'business.form.editTitle' : 'business.form.setupTitle')}</h1>
        <p>{t('business.form.description')}</p>
        <div className="business-profile-completion">
          <div>
            <strong>{t('business.completion', { percent: completion.percentage })}</strong>
          </div>
          <progress max="100" value={completion.percentage}>{completion.percentage}%</progress>
        </div>
      </div>

      {error && (
        <RecoveryMessage
          message={error}
          onRetry={() => document.getElementById('business-profile-form')?.requestSubmit()}
        />
      )}

      {saveSuccess && (
        <div className="business-form__success" role="status">
          <span>{t('business.form.saveSuccess')}</span>
          <button aria-label={t('common.close')} onClick={() => setSaveSuccess(false)} type="button">×</button>
        </div>
      )}

      <section className="account-card business-media-manager" aria-labelledby="business-media-title">
        <header className="account-card__header business-media-manager__heading">
          <p className="account-card__eyebrow">{t('business.form.media.eyebrow')}</p>
          <h2 id="business-media-title">{t('business.form.media.title')}</h2>
          <p>{t('business.form.media.description')}</p>
          <p>{t('business.form.mediaSavedImmediately')}</p>
        </header>

        {mediaError && (
          <RecoveryMessage
            message={mediaError}
            onRetry={mediaRetryAvailable ? () => mediaRetryRef.current?.() : undefined}
          />
        )}

        {businessProfile?.businessId ? (
          <>
            <div className="business-logo-editor">
              <EditableImageAvatar
                actionLabel={t(businessProfile.logoUrl ? 'business.form.media.changeLogo' : 'business.form.media.uploadLogo')}
                className="image-avatar--business-logo"
                disabled={logoUploading}
                imageAlt={t('business.form.media.logoAlt', { name: form.name || t('business.control.yourBusiness') })}
                inputLabel={t(businessProfile.logoUrl ? 'business.form.media.changeLogo' : 'business.form.media.uploadLogo')}
                name={form.name || t('business.control.yourBusiness')}
                onChange={handleLogoUpload}
                src={businessProfile.logoUrl}
                uploading={logoUploading}
              />
              <div className="business-logo-editor__content">
                <h3>{t('business.form.media.logoTitle')}</h3>
                <p>{t('business.form.media.logoDescription')}</p>
                <span>{t('business.form.media.logoHelp')}</span>
              </div>
            </div>

            <div className="business-gallery-editor">
              <div className="business-gallery-editor__heading">
                <div>
                  <h3>{t('business.form.media.galleryTitle')}</h3>
                  <p>{t('business.form.media.galleryDescription')}</p>
                </div>
                <label className="media-upload-button">
                  <span>{galleryUploading ? t('business.form.media.uploading') : t('business.form.media.addImages')}</span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    disabled={galleryUploading || galleryImages.length >= 8}
                    multiple
                    onChange={handleGalleryUpload}
                    type="file"
                  />
                </label>
              </div>

              {galleryImages.length > 0 ? (
                <div className="business-gallery-grid">
                  {galleryImages.map((image) => (
                    <figure key={image.storagePath || image.downloadUrl}>
                      <img
                        alt={t('business.form.media.workImageAlt')}
                        decoding="async"
                        loading="lazy"
                        onError={(event) => { event.currentTarget.hidden = true }}
                        src={image.downloadUrl}
                      />
                      <button
                        disabled={deletingImage === (image.storagePath || image.downloadUrl)}
                        onClick={() => void handleGalleryDelete(image)}
                        type="button"
                      >
                        {deletingImage === (image.storagePath || image.downloadUrl) ? t('business.form.media.deleting') : t('common.delete')}
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="business-gallery-empty">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6.5h16v12H4z" />
                    <path d="m7 15 3-3 2.5 2.5 2-2L18 16" />
                    <circle cx="16.5" cy="9.5" r="1.25" />
                  </svg>
                  <p>{t('business.form.media.emptyTitle')}</p>
                  <span>{t('business.form.media.emptyDescription')}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="business-gallery-empty">
            {t('business.form.media.saveFirst')}
          </p>
        )}
      </section>

      <form className="auth-form business-form" id="business-profile-form" onSubmit={handleSubmit}>
        <section className="business-form__section" aria-labelledby="business-identity-title">
          <header>
            <h2 id="business-identity-title">{t('business.form.identity.title')}</h2>
            <p>{t('business.form.identity.description')}</p>
          </header>

          <label htmlFor="business-name">{t('business.form.identity.name')} *</label>
          <input
            aria-describedby={fieldErrors.name ? 'business-name-error' : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            id="business-name"
            maxLength={120}
            onChange={(event) => setField('name', event.target.value)}
            required
            type="text"
            value={form.name}
          />
          <FormFieldError id="business-name-error" message={fieldErrors.name} />

          <label htmlFor="business-tagline">{t('business.form.identity.tagline')}</label>
          <input
            id="business-tagline"
            maxLength={160}
            onChange={(event) => setField('tagline', event.target.value)}
            type="text"
            value={form.tagline}
          />

          <label htmlFor="business-description">{t('business.form.identity.businessDescription')} *</label>
          <textarea
            aria-describedby={fieldErrors.description ? 'business-description-error' : undefined}
            aria-invalid={Boolean(fieldErrors.description)}
            id="business-description"
            maxLength={2000}
            onChange={(event) => setField('description', event.target.value)}
            required
            rows={6}
            value={form.description}
          />
          <FormFieldError id="business-description-error" message={fieldErrors.description} />
        </section>

        <section className="business-form__section" aria-labelledby="business-services-title">
          <header>
            <h2 id="business-services-title">{t('business.form.services.title')}</h2>
            <p>{t('business.form.services.description')}</p>
          </header>

          <label htmlFor="business-main-category">{t('business.form.services.mainCategory')} *</label>
          <SelectField
            ariaDescribedBy={fieldErrors.primaryCategoryId ? 'business-main-category-error' : undefined}
            ariaInvalid={Boolean(fieldErrors.primaryCategoryId)}
            ariaLabel={t('business.form.services.mainCategory')}
            className="select-field--form"
            id="business-main-category"
            onChange={(value) => setField('primaryCategoryId', value)}
            options={categoryListboxOptions}
            showLeadingIcon={false}
            value={form.primaryCategoryId}
          />
          <FormFieldError id="business-main-category-error" message={fieldErrors.primaryCategoryId} />

          <CheckboxGroup
            id="business-subcategories-group"
            legend={t('business.form.services.subcategories')}
            name="categoryIds"
            onToggle={(value) => toggleArrayValue('categoryIds', value)}
            options={localizedCategoryOptions}
            selectedValues={form.categoryIds}
          />

          {form.categoryIds.includes('Other') && (
            <div className="custom-option-field">
              <label htmlFor="custom-subcategory">{t('business.form.services.customSubcategory')}</label>
              <input
                aria-describedby={fieldErrors.customSubcategory ? 'custom-subcategory-error' : undefined}
                aria-invalid={Boolean(fieldErrors.customSubcategory)}
                id="custom-subcategory"
                maxLength={100}
                onChange={(event) => setCustomSubcategory(event.target.value)}
                required
                type="text"
                value={customSubcategory}
              />
              <FormFieldError id="custom-subcategory-error" message={fieldErrors.customSubcategory} />
            </div>
          )}
        </section>

        <section className="business-form__section" aria-labelledby="business-contact-title">
          <header>
            <h2 id="business-contact-title">{t('business.form.contact.title')}</h2>
            <p>{t('business.form.contact.description')}</p>
          </header>

          <div className="business-form__columns">
            <div>
              <label htmlFor="business-phone">{t('business.form.contact.phone')}</label>
              <input
                autoComplete="tel"
                id="business-phone"
                onChange={(event) => setField('phone', event.target.value)}
                type="tel"
                value={form.phone}
              />
              <label className="auth-form__check">
                <input
                  checked={form.phoneVisible}
                  onChange={(event) => setField('phoneVisible', event.target.checked)}
                  type="checkbox"
                />
                <span>{t('business.form.contact.showPhone')}</span>
              </label>
            </div>
            <div>
              <label htmlFor="business-whatsapp">WhatsApp</label>
              <input
                autoComplete="tel"
                id="business-whatsapp"
                onChange={(event) => setField('whatsappNumber', event.target.value)}
                type="tel"
                value={form.whatsappNumber}
              />
              <label className="auth-form__check">
                <input
                  checked={form.whatsappVisible}
                  onChange={(event) => setField('whatsappVisible', event.target.checked)}
                  type="checkbox"
                />
                <span>{t('business.form.contact.showWhatsapp')}</span>
              </label>
            </div>
          </div>

          <label htmlFor="business-email">{t('business.form.contact.email')}</label>
          <input
            autoComplete="email"
            aria-describedby={fieldErrors.email ? 'business-email-error' : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            id="business-email"
            onChange={(event) => setField('email', event.target.value)}
            type="email"
            value={form.email}
          />
          <FormFieldError id="business-email-error" message={fieldErrors.email} />
          <label className="auth-form__check">
            <input
              checked={form.emailVisible}
              onChange={(event) => setField('emailVisible', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.showEmail')}</span>
          </label>

          <label htmlFor="business-website">{t('business.form.contact.website')}</label>
          <input
            autoComplete="url"
            aria-describedby={fieldErrors.website ? 'business-website-error' : undefined}
            aria-invalid={Boolean(fieldErrors.website)}
            id="business-website"
            onChange={(event) => setField('website', event.target.value)}
            placeholder="https://"
            type="url"
            value={form.website}
          />
          <FormFieldError id="business-website-error" message={fieldErrors.website} />
          <label className="auth-form__check">
            <input
              checked={form.websiteVisible}
              onChange={(event) => setField('websiteVisible', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.showWebsite')}</span>
          </label>

          <label htmlFor="preferred-contact-method">{t('business.form.contact.preferred')}</label>
          <SelectField
            ariaLabel={t('business.form.contact.preferred')}
            className="select-field--form"
            id="preferred-contact-method"
            onChange={(value) => setField('preferredContactMethod', value)}
            options={contactMethodOptions}
            value={form.preferredContactMethod}
          />
          <p className="auth-form__hint">{t('business.form.contact.messagingHelp')}</p>

          <label className="auth-form__check">
            <input
              checked={form.allowCallbackRequests}
              onChange={(event) => setField('allowCallbackRequests', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.callback')}</span>
          </label>
        </section>

        <section className="business-form__section" aria-labelledby="business-location-title">
          <header>
            <h2 id="business-location-title">{t('business.form.location.title')}</h2>
            <p>{t('business.form.location.description')}</p>
          </header>

          <section className="business-location-subsection" aria-labelledby="business-base-title">
            <header className="business-location-subsection__heading">
              <div>
                <h3 id="business-base-title">{t('business.form.location.baseTitle')}</h3>
                <p>{t('business.form.location.baseDescription')}</p>
              </div>
            </header>
            <div className="business-form__location-grid">
              <div>
                <label htmlFor="business-city">{t('profile.city')} *</label>
                <input
                  autoComplete="address-level2"
                  aria-describedby={fieldErrors.city ? 'business-city-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.city)}
                  id="business-city"
                  maxLength={100}
                  onChange={(event) => setField('city', event.target.value)}
                  required
                  type="text"
                  value={form.city}
                />
                <FormFieldError id="business-city-error" message={fieldErrors.city} />
              </div>
              <div>
                <label htmlFor="business-province">{t('business.form.location.province')}</label>
                <SelectField
                  ariaLabel={t('business.form.location.province')}
                  className="select-field--form"
                  id="business-province"
                  onChange={(value) => setField('province', value)}
                  options={provinceListboxOptions}
                  showLeadingIcon={false}
                  value={form.province}
                />
              </div>
              <div>
                <label htmlFor="business-country">{t('business.form.location.country')}</label>
                <SelectField
                  ariaLabel={t('business.form.location.country')}
                  className="select-field--form"
                  id="business-country"
                  onChange={(value) => setField('country', value)}
                  options={countryListboxOptions}
                  value={form.country}
                />
              </div>
            </div>
          </section>

          <ServiceAreaSelector
            customArea={customServiceArea}
            customAreaError={fieldErrors.customServiceArea}
            onCustomAreaChange={(value) => {
              setCustomServiceArea(value)
              setFieldErrors((current) => ({ ...current, customServiceArea: '' }))
            }}
            onRadiusChange={(value) => setField('serviceRadiusKm', value)}
            onToggle={(value) => toggleArrayValue('serviceAreas', value)}
            options={localizedServiceAreaOptions}
            province={form.province}
            radius={form.serviceRadiusKm}
            selectedValues={form.serviceAreas}
          />
        </section>

        <section className="business-form__section" aria-labelledby="business-languages-title">
          <header>
            <h2 id="business-languages-title">{t('business.form.languages.title')}</h2>
            <p>{t('business.form.languages.description')}</p>
          </header>

          <CheckboxGroup
            error={fieldErrors.languages}
            id="business-languages-group"
            legend={`${t('business.form.languages.spoken')} *`}
            name="languages"
            onToggle={(value) => toggleArrayValue('languages', value)}
            options={localizedLanguageOptions}
            selectedValues={form.languages}
          />

          {form.languages.includes('other') && (
            <div className="custom-option-field">
              <label htmlFor="custom-language">{t('business.form.languages.custom')}</label>
              <input
                aria-describedby={fieldErrors.customLanguage ? 'custom-language-error' : undefined}
                aria-invalid={Boolean(fieldErrors.customLanguage)}
                id="custom-language"
                maxLength={100}
                onChange={(event) => handleCustomLanguageChange(event.target.value)}
                required
                type="text"
                value={customLanguage}
              />
              <FormFieldError id="custom-language-error" message={fieldErrors.customLanguage} />
            </div>
          )}

          <label htmlFor="primary-language">{t('business.primaryLanguage')} *</label>
          <SelectField
            ariaLabel={t('business.primaryLanguage')}
            className="select-field--form"
            disabled={normalizeCustomValues(form.languages, customLanguage).length === 0}
            id="primary-language"
            onChange={(value) => setField('primaryLanguage', value)}
            options={normalizeCustomValues(form.languages, customLanguage).map((language) => ({
              label: getLanguageNameFromCode(language),
              value: language,
            }))}
            value={form.primaryLanguage}
          />
        </section>

        <footer className={`business-form__save${isDirty ? ' is-dirty' : ''}`}>
          <div>
            <strong>{isDirty ? t('business.form.unsavedTitle') : t('business.form.savedTitle')}</strong>
            {isDirty && <p>{t('business.form.unsavedDescription')}</p>}
          </div>
          <button className="button button--primary" disabled={submitting || !isDirty} type="submit">
            {submitting ? t('business.saving') : t('business.save')}
          </button>
        </footer>
      </form>
      <AccessibleDialog
        ariaDescribedBy="unsaved-business-description"
        ariaLabelledBy="unsaved-business-title"
        className="profile-edit-dialog confirmation-dialog"
        onClose={() => setPendingNavigation(null)}
        open={Boolean(pendingNavigation)}
      >
        <section className="profile-edit-dialog__panel">
          <header className="profile-edit-dialog__header">
            <h2 id="unsaved-business-title">{t('business.form.unsavedDialogTitle')}</h2>
            <button aria-label={t('common.close')} onClick={() => setPendingNavigation(null)} type="button">×</button>
          </header>
          <p id="unsaved-business-description">{t('business.form.unsavedWarning')}</p>
          <div className="profile-edit-form__actions">
            <button className="button button--secondary" onClick={() => setPendingNavigation(null)} type="button">{t('business.form.keepEditing')}</button>
            <button className="button button--primary" onClick={() => void leaveWithoutSaving()} type="button">{t('business.form.leave')}</button>
          </div>
        </section>
      </AccessibleDialog>
    </section>
  )
}

export default EditBusinessPage
