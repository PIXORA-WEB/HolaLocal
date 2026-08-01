import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { serviceAreaMatchesSearch } from '../../utils/locations.js'
import FormFieldError from '../common/FormFieldError.jsx'

function AreaCards({ onToggle, options, selectedValues }) {
  return (
    <div className="checkbox-group__options service-area-selector__options">
      {options.map((option) => (
        <label key={option.value}>
          <input
            checked={selectedValues.includes(option.value)}
            name="serviceAreas"
            onChange={() => onToggle(option.value)}
            type="checkbox"
            value={option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

function ServiceAreaSelector({
  error,
  onRadiusChange,
  onToggle,
  options,
  province,
  radius,
  selectedValues,
}) {
  const { t } = useTranslation()
  const id = useId()
  const [search, setSearch] = useState('')
  const groups = useMemo(() => options.reduce((result, option) => {
    const group = typeof option?.group === 'string' && option.group ? option.group : 'other'
    if (!result.has(group)) result.set(group, [])
    result.get(group).push(option)
    return result
  }, new Map()), [options])
  const [openGroups, setOpenGroups] = useState(() => new Set(
    [...groups.entries()]
      .filter(([group, groupOptions]) => group === province
        || groupOptions.some((option) => selectedValues.includes(option.value)))
      .map(([group]) => group),
  ))
  const selectedOptions = selectedValues
    .map((value) => options.find((option) => option.value === value) ?? {
      label: value,
      unresolved: true,
      value,
    })
  const searchResults = search.trim()
    ? options.filter((option) => serviceAreaMatchesSearch(option, search))
    : []

  function toggleGroup(group) {
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <section
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      aria-labelledby={`${id}-title`}
      className="business-location-subsection business-location-subsection--coverage"
      id="business-service-areas"
      tabIndex={error ? -1 : undefined}
    >
      <header className="business-location-subsection__heading">
        <div>
          <h3 id={`${id}-title`}>{t('business.form.location.coverageTitle')}</h3>
          <p>{t('business.form.location.coverageDescription')}</p>
        </div>
        <span className="service-area-selector__count">
          {t('business.form.location.totalSelected', { count: selectedOptions.length })}
        </span>
      </header>

      <div className="service-area-selector__controls">
        <div className="service-area-selector__search">
          <label htmlFor={`${id}-search`}>{t('business.form.location.searchAreas')}</label>
          <div>
            <input
              autoComplete="off"
              id={`${id}-search`}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              value={search}
            />
            {search && (
              <button onClick={() => setSearch('')} type="button">
                {t('business.form.location.clearSearch')}
              </button>
            )}
          </div>
        </div>
        <div className="service-area-selector__radius">
          <label htmlFor="service-radius">{t('business.form.location.radius')}</label>
          <input
            id="service-radius"
            max={500}
            min={0}
            onChange={(event) => onRadiusChange(event.target.value)}
            type="number"
            value={radius}
          />
          <p>{t('business.form.location.radiusHelp')}</p>
        </div>
      </div>

      <div className="service-area-selector__selection">
        {selectedOptions.length > 0 ? (
          <div className="service-area-selector__chips">
            {selectedOptions.map((option) => (
              <button
                aria-label={t('business.form.location.removeArea', { area: option.label })}
                key={option.value}
                onClick={() => onToggle(option.value)}
                type="button"
              >
                {option.label}
                {option.unresolved && <span className="service-area-selector__unresolved"> {t('business.form.location.unresolved')}</span>}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : <p>{t('business.form.location.noSelectedAreas')}</p>}
      </div>

      {search.trim() ? (
        <section className="service-area-selector__results" aria-live="polite">
          <h4>{t('business.form.location.searchResults')}</h4>
          {searchResults.length > 0 ? (
            <AreaCards onToggle={onToggle} options={searchResults} selectedValues={selectedValues} />
          ) : <p className="service-area-selector__empty">{t('business.form.location.noAreaResults')}</p>}
        </section>
      ) : (
        <div className="service-area-selector__groups">
          {[...groups.entries()].map(([group, groupOptions]) => {
            const open = openGroups.has(group)
            const selectedCount = groupOptions.filter((option) => selectedValues.includes(option.value)).length
            const panelId = `${id}-${group}`
            return (
              <section className="service-area-selector__group" key={group}>
                <button
                  aria-controls={panelId}
                  aria-expanded={open}
                  onClick={() => toggleGroup(group)}
                  type="button"
                >
                  <span>{groupOptions[0]?.groupLabel ?? t('common.other')}</span>
                  <span className="service-area-selector__badge">{selectedCount}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
                </button>
                <div hidden={!open} id={panelId}>
                  <AreaCards onToggle={onToggle} options={groupOptions} selectedValues={selectedValues} />
                </div>
              </section>
            )
          })}
        </div>
      )}

      <FormFieldError id={`${id}-error`} message={error} />
    </section>
  )
}

export default ServiceAreaSelector
