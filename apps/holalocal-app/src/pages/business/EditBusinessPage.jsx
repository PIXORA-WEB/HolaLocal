import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  createBusinessProfile,
  getBusinessByOwnerId,
  updateBusinessProfile,
} from '../../services/businessService.js'
import {
  businessCategoryOptions,
  businessLanguageOptions,
  normalizeCustomValues,
  provinceOptions,
  serviceAreaOptions,
} from '../../utils/business.js'

const emptyForm = {
  businessName: '',
  tagline: '',
  description: '',
  mainCategory: '',
  subcategories: [],
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  city: '',
  province: '',
  country: 'Spain',
  serviceAreas: [],
  serviceRadiusKm: 20,
  languages: ['English'],
  primaryLanguage: 'English',
}

function prepareCustomSelection(values = [], options) {
  const customValue = values.find((value) => value !== 'Other' && !options.includes(value)) ?? ''
  const selectedValues = values.filter((value) => value !== 'Other' && options.includes(value))

  if (customValue) selectedValues.push('Other')

  return { customValue, selectedValues }
}

function CheckboxGroup({ legend, name, options, selectedValues, onToggle }) {
  return (
    <fieldset className="checkbox-group">
      <legend>{legend}</legend>
      <div className="checkbox-group__options">
        {options.map((option) => (
          <label key={option}>
            <input
              checked={selectedValues.includes(option)}
              name={name}
              onChange={() => onToggle(option)}
              type="checkbox"
              value={option}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function EditBusinessPage() {
  const { t } = useTranslation()
  const { updateUserProfile, user, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [customSubcategory, setCustomSubcategory] = useState('')
  const [customServiceArea, setCustomServiceArea] = useState('')
  const [customLanguage, setCustomLanguage] = useState('')

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      try {
        const profile = await getBusinessByOwnerId(user.uid)
        if (!active) return

        const loadedLanguages = profile?.languages ?? [userProfile.preferredLanguage ?? 'English']
        const preparedSubcategories = prepareCustomSelection(
          profile?.subcategories ?? [],
          businessCategoryOptions,
        )
        const preparedServiceAreas = prepareCustomSelection(
          profile?.serviceAreas ?? [],
          serviceAreaOptions,
        )
        const preparedLanguages = prepareCustomSelection(
          loadedLanguages,
          businessLanguageOptions,
        )

        setBusinessProfile(profile)
        setCustomSubcategory(preparedSubcategories.customValue)
        setCustomServiceArea(preparedServiceAreas.customValue)
        setCustomLanguage(preparedLanguages.customValue)
        setForm({
          ...emptyForm,
          email: userProfile.email ?? '',
          city: userProfile.city ?? '',
          country: userProfile.country ?? 'Spain',
          primaryLanguage: profile?.primaryLanguage ?? loadedLanguages[0] ?? 'English',
          ...(profile ?? {}),
          subcategories: preparedSubcategories.selectedValues,
          serviceAreas: preparedServiceAreas.selectedValues,
          languages: preparedLanguages.selectedValues,
        })
      } catch (loadError) {
        if (active) setError(getAuthenticationErrorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()

    return () => {
      active = false
    }
  }, [user.uid, userProfile])

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleArrayValue(field, value) {
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
    setForm((current) => {
      if (!current.languages.includes('Other')) return current

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

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const businessName = form.businessName.trim()
    const description = form.description.trim()
    const mainCategory = form.mainCategory.trim()
    const city = form.city.trim()
    const usesCustomSubcategory = form.subcategories.includes('Other')
    const usesCustomServiceArea = form.serviceAreas.includes('Other')
    const usesCustomLanguage = form.languages.includes('Other')

    if (!businessName || !description || !mainCategory || !city) {
      setError('Business name, description, main category, and city are required.')
      return
    }

    if (usesCustomSubcategory && !customSubcategory.trim()) {
      setError('Add a custom subcategory or deselect Other.')
      return
    }

    if (usesCustomServiceArea && !customServiceArea.trim()) {
      setError('Add a custom service area or deselect Other.')
      return
    }

    if (usesCustomLanguage && !customLanguage.trim()) {
      setError('Add a custom language or deselect Other.')
      return
    }

    const subcategories = normalizeCustomValues(form.subcategories, customSubcategory)
    const serviceAreas = normalizeCustomValues(form.serviceAreas, customServiceArea)
    const languages = normalizeCustomValues(form.languages, customLanguage)

    if (languages.length === 0) {
      setError('Select at least one language.')
      return
    }

    const primaryLanguage =
      languages.find(
        (language) => language.toLowerCase() === form.primaryLanguage.trim().toLowerCase(),
      ) ?? languages[0]

    setSubmitting(true)

    const businessData = {
      businessName,
      tagline: form.tagline.trim(),
      description,
      mainCategory,
      subcategories,
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      website: form.website.trim(),
      city,
      province: form.province,
      country: form.country.trim() || 'Spain',
      serviceAreas,
      serviceRadiusKm: Number(form.serviceRadiusKm),
      languages,
      primaryLanguage,
      profileCompleted: true,
    }

    try {
      const savedBusiness = businessProfile
        ? await updateBusinessProfile(businessProfile.businessId, businessData)
        : await createBusinessProfile(user.uid, businessData)

      await updateUserProfile({
        businessProfileCompleted: true,
        businessId: savedBusiness.businessId,
      })
      navigate('/business/dashboard', { replace: true })
    } catch (saveError) {
      setError(getAuthenticationErrorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading your business profile…" />

  return (
    <section className="business-form-page">
      <div className="business-form-page__heading">
        <p className="placeholder-page__eyebrow">Business profile</p>
        <h1>{businessProfile?.profileCompleted ? 'Edit business' : 'Set up your business'}</h1>
        <p>Complete the core details for your future public business profile.</p>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <form className="auth-form business-form" onSubmit={handleSubmit}>
        <label htmlFor="business-name">Business name *</label>
        <input
          id="business-name"
          maxLength={120}
          onChange={(event) => setField('businessName', event.target.value)}
          required
          type="text"
          value={form.businessName}
        />

        <label htmlFor="business-tagline">Tagline</label>
        <input
          id="business-tagline"
          maxLength={160}
          onChange={(event) => setField('tagline', event.target.value)}
          type="text"
          value={form.tagline}
        />

        <label htmlFor="business-description">Description *</label>
        <textarea
          id="business-description"
          maxLength={2000}
          onChange={(event) => setField('description', event.target.value)}
          required
          rows={6}
          value={form.description}
        />

        <label htmlFor="business-main-category">Main category *</label>
        <select
          id="business-main-category"
          onChange={(event) => setField('mainCategory', event.target.value)}
          required
          value={form.mainCategory}
        >
          <option value="">Select a category</option>
          {businessCategoryOptions.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <CheckboxGroup
          legend="Subcategories"
          name="subcategories"
          onToggle={(value) => toggleArrayValue('subcategories', value)}
          options={businessCategoryOptions}
          selectedValues={form.subcategories}
        />

        {form.subcategories.includes('Other') && (
          <div className="custom-option-field">
            <label htmlFor="custom-subcategory">Add custom subcategory</label>
            <input
              id="custom-subcategory"
              maxLength={100}
              onChange={(event) => setCustomSubcategory(event.target.value)}
              required
              type="text"
              value={customSubcategory}
            />
          </div>
        )}

        <div className="business-form__columns">
          <div>
            <label htmlFor="business-phone">Phone</label>
            <input
              autoComplete="tel"
              id="business-phone"
              onChange={(event) => setField('phone', event.target.value)}
              type="tel"
              value={form.phone}
            />
          </div>
          <div>
            <label htmlFor="business-whatsapp">WhatsApp</label>
            <input
              autoComplete="tel"
              id="business-whatsapp"
              onChange={(event) => setField('whatsapp', event.target.value)}
              type="tel"
              value={form.whatsapp}
            />
          </div>
        </div>

        <label htmlFor="business-email">Business email</label>
        <input
          autoComplete="email"
          id="business-email"
          onChange={(event) => setField('email', event.target.value)}
          type="email"
          value={form.email}
        />

        <label htmlFor="business-website">Website</label>
        <input
          autoComplete="url"
          id="business-website"
          onChange={(event) => setField('website', event.target.value)}
          placeholder="https://"
          type="url"
          value={form.website}
        />

        <div className="business-form__columns">
          <div>
            <label htmlFor="business-city">City *</label>
            <input
              autoComplete="address-level2"
              id="business-city"
              maxLength={100}
              onChange={(event) => setField('city', event.target.value)}
              required
              type="text"
              value={form.city}
            />
          </div>
          <div>
            <label htmlFor="business-province">Province</label>
            <select
              id="business-province"
              onChange={(event) => setField('province', event.target.value)}
              value={form.province}
            >
              <option value="">Select a province</option>
              {provinceOptions.map((province) => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="business-country">Country</label>
        <input
          autoComplete="country-name"
          id="business-country"
          maxLength={100}
          onChange={(event) => setField('country', event.target.value)}
          type="text"
          value={form.country}
        />

        <CheckboxGroup
          legend="Service areas"
          name="serviceAreas"
          onToggle={(value) => toggleArrayValue('serviceAreas', value)}
          options={serviceAreaOptions}
          selectedValues={form.serviceAreas}
        />

        {form.serviceAreas.includes('Other') && (
          <div className="custom-option-field">
            <label htmlFor="custom-service-area">Add custom service area</label>
            <input
              id="custom-service-area"
              maxLength={100}
              onChange={(event) => setCustomServiceArea(event.target.value)}
              required
              type="text"
              value={customServiceArea}
            />
          </div>
        )}

        <label htmlFor="service-radius">Service radius (km)</label>
        <input
          id="service-radius"
          max={500}
          min={0}
          onChange={(event) => setField('serviceRadiusKm', event.target.value)}
          type="number"
          value={form.serviceRadiusKm}
        />

        <CheckboxGroup
          legend="Languages spoken *"
          name="languages"
          onToggle={(value) => toggleArrayValue('languages', value)}
          options={businessLanguageOptions}
          selectedValues={form.languages}
        />

        {form.languages.includes('Other') && (
          <div className="custom-option-field">
            <label htmlFor="custom-language">Add custom language</label>
            <input
              id="custom-language"
              maxLength={100}
              onChange={(event) => handleCustomLanguageChange(event.target.value)}
              required
              type="text"
              value={customLanguage}
            />
          </div>
        )}

        <label htmlFor="primary-language">{t('business.primaryLanguage')} *</label>
        <select
          disabled={normalizeCustomValues(form.languages, customLanguage).length === 0}
          id="primary-language"
          onChange={(event) => setField('primaryLanguage', event.target.value)}
          required
          value={form.primaryLanguage}
        >
          {normalizeCustomValues(form.languages, customLanguage).map((language) => (
            <option key={language.toLowerCase()} value={language}>{language}</option>
          ))}
        </select>

        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? t('business.saving') : t('business.save')}
        </button>
      </form>
    </section>
  )
}

export default EditBusinessPage
