import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseBusinessInsightDate } from '@holalocal/firebase-contract'
import SelectField from './SelectField.jsx'
import { formatPickerDate, movePickerDate, parsePickerDate, pickerDays, pickerWeekStart } from './datePickerDates.js'

export default function DatePicker({ label, value, onChange, today, min, max, ariaDescribedBy, ariaInvalid }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const id = useId()
  const root = useRef(null), popup = useRef(null), trigger = useRef(null), focusDay = useRef(false)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(today)
  const [touched, setTouched] = useState(false)
  const [yearEntry, setYearEntry] = useState(null)
  const invalid = Boolean(value && !parseBusinessInsightDate(value))
  const available = (date) => (!min || date >= min) && (!max || date <= max)
  const days = pickerDays(cursor, locale)
  const dateLabel = (date) => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(parseBusinessInsightDate(date))
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseBusinessInsightDate(cursor))
  const close = () => { setOpen(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const anchor = trigger.current.getBoundingClientRect(), box = popup.current.getBoundingClientRect()
      popup.current.style.left = `${Math.max(16, Math.min(anchor.right - box.width, window.innerWidth - box.width - 16))}px`
      popup.current.style.top = `${Math.max(16, Math.min(anchor.bottom + 8, window.innerHeight - box.height - 16))}px`
    }
    position()
    if (focusDay.current) { popup.current.querySelector(`[data-date="${cursor}"]`)?.focus(); focusDay.current = false }
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open, cursor])

  function choose(date) {
    if (!available(date)) return
    onChange(date); setTouched(false); close()
  }
  function navigate(event, date) {
    const weekday = parseBusinessInsightDate(date).getUTCDay()
    const offset = (weekday - pickerWeekStart(locale) + 7) % 7
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -offset, End: 6 - offset }[event.key]
    if (delta !== undefined || ['PageUp', 'PageDown'].includes(event.key)) {
      event.preventDefault(); focusDay.current = true
      setCursor(movePickerDate(date, delta ?? 0, delta === undefined ? (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1) : 0))
    }
  }
  return <div className="date-picker" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="date-picker__field">
      <input id={`${id}-input`} className="date-picker__input" type="text" autoComplete="off" value={formatPickerDate(value, locale)} placeholder={formatPickerDate('2001-11-22', locale)} aria-invalid={Boolean(ariaInvalid || (touched && invalid))} aria-describedby={[ariaDescribedBy, `${id}-hint`, touched && invalid ? `${id}-error` : null].filter(Boolean).join(' ')} onBlur={() => setTouched(true)} onChange={(event) => onChange(parsePickerDate(event.target.value, locale) ?? event.target.value)} />
      <button className="button button--secondary" type="button" ref={trigger} aria-label={`${label}: ${t('datePicker.open')}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-calendar`} onClick={() => { if (open) return close(); setCursor(parseBusinessInsightDate(value) && available(value) ? value : today); focusDay.current = true; setOpen(true) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 5h16v16H4V5Zm0 5h16M8 2v6m8-6v6" /></svg></button>
    </div>
    <small id={`${id}-hint`}>{t('datePicker.example', { date: formatPickerDate('2001-11-22', locale) })}</small>
    {touched && invalid && <small id={`${id}-error`} role="alert">{t('datePicker.invalid')}</small>}
    {open && <div id={`${id}-calendar`} className="date-picker__popover" ref={popup} role="dialog" aria-label={`${label}: ${t('datePicker.open')}`}>
      <div className="date-picker__navigation">
        <button type="button" className="button button--secondary" aria-label={t('datePicker.previous')} onClick={() => setCursor(movePickerDate(cursor, 0, -1))}>‹</button>
        <div><label className="visually-hidden" htmlFor={`${id}-month`}>{t('datePicker.month')}</label><SelectField id={`${id}-month`} ariaLabel={t('datePicker.month')} className="select-field--form" value={cursor.slice(5, 7)} onChange={(month) => setCursor(`${cursor.slice(0, 4)}-${month}-01`)} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1).padStart(2, '0'), label: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, index, 1))) }))} /></div>
        <label className="visually-hidden" htmlFor={`${id}-year`}>{t('datePicker.year')}</label><input id={`${id}-year`} className="date-picker__input" type="number" min="100" max="9998" value={yearEntry ?? Number(cursor.slice(0, 4))} onChange={(event) => setYearEntry(event.target.value)} onBlur={() => { const year = Number(yearEntry); if (yearEntry !== null && Number.isInteger(year) && year >= 100 && year <= 9998) setCursor(`${String(year).padStart(4, '0')}-${cursor.slice(5, 7)}-01`); setYearEntry(null) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); popup.current?.querySelector('.select-field__button')?.focus() } }} />
        <button type="button" className="button button--secondary" aria-label={t('datePicker.next')} onClick={() => setCursor(movePickerDate(cursor, 0, 1))}>›</button>
      </div>
      <p className="visually-hidden" aria-live="polite">{monthLabel}</p>
      <div role="grid" aria-label={monthLabel} className="date-picker__grid">
        <div role="row">{days.slice(0, 7).map((date) => <span role="columnheader" key={date} aria-label={new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(parseBusinessInsightDate(date))}>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(parseBusinessInsightDate(date))}</span>)}</div>
        {Array.from({ length: 6 }, (_, row) => <div role="row" key={row}>{days.slice(row * 7, row * 7 + 7).map((date) => <button type="button" role="gridcell" data-date={date} key={date} aria-label={dateLabel(date)} aria-selected={date === value} aria-current={date === today ? 'date' : undefined} aria-disabled={!available(date)} tabIndex={date === cursor ? 0 : -1} className={date.slice(5, 7) !== cursor.slice(5, 7) ? 'is-outside-month' : undefined} onKeyDown={(event) => navigate(event, date)} onClick={() => choose(date)}>{Number(date.slice(8))}</button>)}</div>)}
      </div>
      <div className="date-picker__footer"><button type="button" className="button button--secondary" disabled={!available(today)} onClick={() => choose(today)}>{t('datePicker.today')}</button><button type="button" className="button button--secondary" onClick={close}>{t('common.close')}</button></div>
    </div>}
  </div>
}
