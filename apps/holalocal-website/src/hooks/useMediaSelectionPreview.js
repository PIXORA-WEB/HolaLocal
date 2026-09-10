import { useEffect, useRef, useState } from 'react'
import { validateImageFile } from '../firebase/storageClient.js'

// One owner for local selection URLs. Releases happen after a render stops using
// a URL; a confirmed selection is retained as a fallback for a failed replacement.
export default function useMediaSelectionPreview() {
  const [selection, setSelection] = useState({ items: [], fallback: [] })
  const owned = useRef(new Set())
  useEffect(() => {
    const retained = new Set([...selection.items, ...selection.fallback].map(({ url }) => url))
    for (const url of owned.current) {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url)
        owned.current.delete(url)
      }
    }
  }, [selection])
  useEffect(() => {
    const urls = owned.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  function select(files) {
    files.forEach((file) => validateImageFile(file))
    const items = files.map((file) => {
      const url = URL.createObjectURL(file)
      owned.current.add(url)
      return { file, url, committed: false }
    })
    setSelection((previous) => ({ items, fallback: previous.items.filter(({ committed }) => committed) }))
  }
  function committed(file) {
    setSelection((previous) => ({
      items: previous.items.map((item) => item.file === file ? { ...item, committed: true } : item),
      fallback: [],
    }))
  }
  function failed() {
    setSelection((previous) => ({
      items: previous.items.some(({ committed }) => committed)
        ? previous.items.filter(({ committed }) => committed) : previous.fallback,
      fallback: [],
    }))
  }
  function clear() { setSelection({ items: [], fallback: [] }) }
  return { items: selection.items, select, committed, failed, clear }
}
