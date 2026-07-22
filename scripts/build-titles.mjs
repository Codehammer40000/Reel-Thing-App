import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const LIST_MAP = {
  'IMDb_Top_250_Movies.csv': 'top250Movies',
  'IMDb_Top_250_TV_Shows.csv': 'top250Tv',
  'IMDb_Top_100_Most_Popular_Movies.csv': 'popularMovies',
  'IMDb_Top_100_Most_Popular_TV_Shows.csv': 'popularTv',
}

function enlargePoster(url) {
  if (!url) return url
  // Drop IMDb's tiny CR crop params so the poster can fill the card centered
  return url.replace(/\._V1_.*$/i, '._V1_UX600.jpg')
}

function parseCsv(text) {
  const rows = []
  let i = 0
  let field = ''
  let row = []
  let inQuotes = false

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((cell) => cell.length)) rows.push(row)
  }
  return rows
}

function main() {
  /** @type {Map<string, any>} */
  const byId = new Map()

  for (const [filename, listTag] of Object.entries(LIST_MAP)) {
    const path = join(root, filename)
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      console.warn(`Skipping missing file: ${filename}`)
      continue
    }

    const rows = parseCsv(text)
    if (rows.length < 2) continue
    const headers = rows[0].map((h) => h.trim())
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]))

    for (const cells of rows.slice(1)) {
      const id = (cells[idx['IMDb Title ID']] || '').trim()
      if (!id) continue

      const rank = Number(cells[idx['Rank']] || 0)
      const title = (cells[idx['Title']] || '').trim()
      const type = (cells[idx['Type']] || '').trim()
      const rating = Number(cells[idx['IMDb Rating']] || 0)
      const year = (cells[idx['Release Years']] || '').trim()
      const blurb = (cells[idx['Blurb']] || '').trim()
      const thumbnailUrl = (cells[idx['Thumbnail URL']] || '').trim()
      const imdbUrl = (cells[idx['IMDb URL']] || '').trim()

      const existing = byId.get(id)
      if (existing) {
        if (!existing.lists.includes(listTag)) existing.lists.push(listTag)
        existing.ranks[listTag] = rank
        continue
      }

      byId.set(id, {
        id,
        title,
        type,
        rating,
        year,
        blurb,
        thumbnailUrl,
        posterUrl: enlargePoster(thumbnailUrl),
        imdbUrl,
        lists: [listTag],
        ranks: { [listTag]: rank },
      })
    }
  }

  const titles = [...byId.values()].sort((a, b) => {
    const aRank = Math.min(...Object.values(a.ranks).map(Number))
    const bRank = Math.min(...Object.values(b.ranks).map(Number))
    if (aRank !== bRank) return aRank - bRank
    return a.title.localeCompare(b.title)
  })

  const outPath = join(root, 'public', 'titles.json')
  writeFileSync(outPath, JSON.stringify(titles, null, 2))
  console.log(`Wrote ${titles.length} titles → public/titles.json`)
}

main()
