import { isValidElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import styles from './HelpDocsPage.module.css'
import docsMarkdown from '../assets/docs/JSM-docs.md?raw'

function slugifyBase(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^a-z0-9 _-]/g, '')
    .trim()
    // GitHub-style anchors effectively preserve repeated separators.
    .replace(/\s/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

function createSlugger() {
  const counts = new Map<string, number>()
  return (value: string) => {
    const base = slugifyBase(value)
    const seen = counts.get(base) ?? 0
    counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}

function flattenText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join('')
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return flattenText(props.children)
  }
  return ''
}

function clearFindHighlights(container: HTMLElement) {
  const marks = Array.from(container.querySelectorAll<HTMLElement>('[data-jsm-docs-find-match="1"]'))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
    parent.normalize()
  }
}

function collectFindMatches(container: HTMLElement, query: string, baseClassName: string) {
  const normalizedQuery = query.toLowerCase()
  if (!normalizedQuery) return []

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()

  while (node) {
    const textNode = node as Text
    const value = textNode.nodeValue ?? ''
    const parent = textNode.parentElement
    const skip =
      !value ||
      !parent ||
      parent.closest('[data-jsm-docs-find-match="1"]') !== null ||
      ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)
    if (!skip) {
      textNodes.push(textNode)
    }
    node = walker.nextNode()
  }

  const matches: HTMLElement[] = []

  for (const textNode of textNodes) {
    const source = textNode.nodeValue ?? ''
    const lower = source.toLowerCase()
    let searchIndex = 0
    let matchIndex = lower.indexOf(normalizedQuery, searchIndex)

    if (matchIndex < 0) continue

    const fragment = document.createDocumentFragment()
    while (matchIndex >= 0) {
      if (matchIndex > searchIndex) {
        fragment.appendChild(document.createTextNode(source.slice(searchIndex, matchIndex)))
      }

      const mark = document.createElement('mark')
      mark.dataset.jsmDocsFindMatch = '1'
      mark.className = baseClassName
      mark.textContent = source.slice(matchIndex, matchIndex + normalizedQuery.length)
      fragment.appendChild(mark)
      matches.push(mark)

      searchIndex = matchIndex + normalizedQuery.length
      matchIndex = lower.indexOf(normalizedQuery, searchIndex)
    }

    if (searchIndex < source.length) {
      fragment.appendChild(document.createTextNode(source.slice(searchIndex)))
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return matches
}

export function HelpDocsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [matchCount, setMatchCount] = useState(0)
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [stickyTopOffset, setStickyTopOffset] = useState(0)
  const searchBarRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const docsMarkdownRef = useRef<HTMLDivElement | null>(null)
  const findMatchesRef = useRef<HTMLElement[]>([])
  const activeMatchIndexRef = useRef(-1)
  const previousQueryRef = useRef('')

  const normalizedQuery = search.trim()

  const scrollElementIntoView = useCallback((el: HTMLElement) => {
    const shellMain = document.querySelector<HTMLElement>('.shell-scroll')
    const searchBarBottom = searchBarRef.current?.getBoundingClientRect().bottom ?? 0
    const extraGap = 10

    if (shellMain) {
      const shellRect = shellMain.getBoundingClientRect()
      const targetRect = el.getBoundingClientRect()
      const offsetFromShellTop = Math.max(0, searchBarBottom - shellRect.top) + extraGap
      const targetTop = shellMain.scrollTop + (targetRect.top - shellRect.top) - offsetFromShellTop
      shellMain.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' })
      return
    }

    const targetRect = el.getBoundingClientRect()
    const targetTop = window.scrollY + targetRect.top - searchBarBottom - extraGap
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' })
  }, [])

  const setFindActiveMatch = useCallback(
    (index: number, shouldScroll: boolean) => {
      const matches = findMatchesRef.current
      if (matches.length === 0) {
        activeMatchIndexRef.current = -1
        setActiveMatchIndex(-1)
        return
      }

      const wrappedIndex = ((index % matches.length) + matches.length) % matches.length
      matches.forEach((match, i) => {
        if (i === wrappedIndex) {
          match.classList.add(styles.findMatchActive)
        } else {
          match.classList.remove(styles.findMatchActive)
        }
      })

      activeMatchIndexRef.current = wrappedIndex
      setActiveMatchIndex(wrappedIndex)

      if (shouldScroll) {
        requestAnimationFrame(() => {
          const currentMatch = findMatchesRef.current[wrappedIndex]
          if (!currentMatch) return
          scrollElementIntoView(currentMatch)
        })
      }
    },
    [scrollElementIntoView],
  )

  const rebuildFindMatches = useCallback(
    (query: string, resetToFirst: boolean) => {
      const container = docsMarkdownRef.current
      if (!container) return

      clearFindHighlights(container)
      findMatchesRef.current = []

      if (!query) {
        setMatchCount(0)
        activeMatchIndexRef.current = -1
        setActiveMatchIndex(-1)
        return
      }

      const matches = collectFindMatches(container, query, styles.findMatch)
      findMatchesRef.current = matches
      setMatchCount(matches.length)

      if (matches.length === 0) {
        activeMatchIndexRef.current = -1
        setActiveMatchIndex(-1)
        return
      }

      const targetIndex = resetToFirst ? 0 : Math.min(activeMatchIndexRef.current, matches.length - 1)
      setFindActiveMatch(targetIndex < 0 ? 0 : targetIndex, resetToFirst)
    },
    [setFindActiveMatch],
  )

  const goToRelativeMatch = useCallback(
    (direction: number) => {
      if (findMatchesRef.current.length === 0) return
      const startIndex = activeMatchIndexRef.current >= 0 ? activeMatchIndexRef.current : 0
      setFindActiveMatch(startIndex + direction, true)
    },
    [setFindActiveMatch],
  )

  const scrollToTop = useCallback(() => {
    const shellMain = document.querySelector<HTMLElement>('.shell-scroll')
    if (shellMain) {
      shellMain.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    const trimmedQuery = search.trim()
    const resetToFirst = trimmedQuery !== previousQueryRef.current
    previousQueryRef.current = trimmedQuery
    rebuildFindMatches(trimmedQuery, resetToFirst)
  }, [search, activeSlug, rebuildFindMatches])

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.responsive-header')
    if (!header) {
      setStickyTopOffset(0)
      return
    }

    const updateOffset = () => {
      const style = window.getComputedStyle(header)
      const visible = style.display !== 'none' && style.visibility !== 'hidden'
      setStickyTopOffset(visible ? Math.ceil(header.getBoundingClientRect().height) : 0)
    }

    updateOffset()

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOffset) : null
    resizeObserver?.observe(header)
    window.addEventListener('resize', updateOffset)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateOffset)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f'
      if (!isFindShortcut) return
      event.preventDefault()
      const input = searchInputRef.current
      if (!input) return
      input.focus()
      input.select()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const jumpToSection = useCallback(
    (slug: string) => {
      const normalized = decodeURIComponent(slug).replace(/^#/, '').trim().toLowerCase()
      // Clear find highlights before the state change so React reconciles against a clean DOM
      if (docsMarkdownRef.current) {
        clearFindHighlights(docsMarkdownRef.current)
      }
      setActiveSlug(normalized)
      requestAnimationFrame(() => {
        let el = document.getElementById(normalized)
        if (!el) {
          const headings = Array.from(document.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'))
          el =
            headings.find(node => {
              const text = (node.textContent ?? '').trim()
              return slugifyBase(text) === normalized
            }) ?? null
        }
        if (!el) return
        scrollElementIntoView(el)
      })
    },
    [scrollElementIntoView],
  )

  useEffect(() => {
    const container = docsMarkdownRef.current
    if (!container) return
    container.querySelectorAll<HTMLElement>(`.${styles.headingActive}`).forEach(el => {
      el.classList.remove(styles.headingActive)
    })
    if (!activeSlug) return
    const activeEl = container.querySelector<HTMLElement>(`[id="${CSS.escape(activeSlug)}"]`)
    activeEl?.classList.add(styles.headingActive)
  }, [activeSlug])

  const markdownComponents = useMemo<Components>(() => {
    const slugger = createSlugger()
    const renderHeading =
      (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
      (({ children }: { children?: ReactNode }) => {
        const text = flattenText(children).trim()
        const id = slugger(text)
        return (
          <Tag id={id} className={styles.heading}>
            {children}
          </Tag>
        )
      }) as NonNullable<Components['h1']>

    return {
      h1: renderHeading('h1'),
      h2: renderHeading('h2'),
      h3: renderHeading('h3'),
      h4: renderHeading('h4'),
      h5: renderHeading('h5'),
      h6: renderHeading('h6'),
      a: (({ href, children }: { href?: string; children?: ReactNode }) => {
        const isHashLink = typeof href === 'string' && href.startsWith('#')
        const isExternal = typeof href === 'string' && /^https?:\/\//i.test(href)
        if (isHashLink) {
          return (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault()
                const hash = href.slice(1)
                if (!hash) return
                jumpToSection(hash)
              }}
            >
              {children}
            </a>
          )
        }
        if (isExternal) {
          return (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault()
                window.electronAPI?.openExternal?.(href)
              }}
            >
              {children}
            </a>
          )
        }
        return <a href={href}>{children}</a>
      }) as NonNullable<Components['a']>,
    }
  }, [jumpToSection])

  return (
    <Card className={`control-panel ${styles.helpCard}`}>
      <div ref={searchBarRef} className={styles.searchBar} style={stickyTopOffset > 0 ? { top: `${stickyTopOffset}px` } : undefined}>
        <div className={styles.headerRow}>
          <h2>{t('help.title')}</h2>
        </div>
        <label className={styles.searchField}>
          <span>{t('help.searchDocumentation')}</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('help.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (event.shiftKey) {
                goToRelativeMatch(-1)
                return
              }
              if (normalizedQuery) {
                goToRelativeMatch(1)
              }
            }}
          />
        </label>
        <div className={styles.searchControls}>
          <div className={styles.findStatus}>
            {normalizedQuery
              ? matchCount > 0
                ? t('help.findStatusMatches', { current: activeMatchIndex + 1, total: matchCount })
                : t('help.findStatusNoMatches')
              : t('help.findStatusTypeToFind')}
          </div>
          <div className={styles.findButtons}>
            <button
              type="button"
              className={styles.findNavButton}
              onClick={() => {
                setSearch('')
                searchInputRef.current?.focus()
              }}
              disabled={!search}
            >
              {t('common.clear')}
            </button>
            <button
              type="button"
              className={styles.findNavButton}
              onClick={() => goToRelativeMatch(-1)}
              disabled={!normalizedQuery || matchCount === 0}
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              className={styles.findNavButton}
              onClick={() => goToRelativeMatch(1)}
              disabled={!normalizedQuery || matchCount === 0}
            >
              {t('common.next')}
            </button>
            <button type="button" className={styles.findNavButton} onClick={scrollToTop}>
              {t('common.top')}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.docsViewport}>
        <div ref={docsMarkdownRef} className={styles.docsMarkdown}>
          <ReactMarkdown components={markdownComponents}>{docsMarkdown}</ReactMarkdown>
        </div>
      </div>
    </Card>
  )
}
