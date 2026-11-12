export const PAGES = ['home', 'study', 'drill', 'compete', 'you'] as const
export type Page = (typeof PAGES)[number]
const read = (): Page => { const h = location.hash.replace(/^#\/?/, '') as Page; return PAGES.includes(h) ? h : 'home' }
export const route = $state<{ page: Page }>({ page: read() })
addEventListener('hashchange', () => { route.page = read() })
export const go = (p: Page) => { location.hash = '/' + p }
