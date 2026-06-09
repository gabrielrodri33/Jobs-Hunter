/**
 * LinkedIn Easy Apply Scraper — No Cookie Required
 *
 * Uses only public LinkedIn pages:
 * - Job search results: linkedin.com/jobs/search/ (public, no login needed)
 * - Job detail pages: linkedin.com/jobs/view/ID (public, button visible without login)
 *
 * Detects Easy Apply by reading the apply button text on each job page.
 * No LinkedIn account or session cookie required.
 */
import { Actor } from 'apify'
import { chromium } from 'playwright'

await Actor.init()

// ── Input ──────────────────────────────────────────────────────────────────
const input = await Actor.getInput()
const {
  searchQueries = ['Desenvolvedor .NET', 'Full Stack .NET React'],
  location = 'Brazil',
  remote = true,
  datePosted = 'r604800',
  maxResultsPerQuery = 20,
} = input ?? {}

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const randomDelay = (min = 2000, max = 4000) =>
  sleep(min + Math.random() * (max - min))

/**
 * Builds LinkedIn job search URL with Easy Apply filter
 */
function buildSearchUrl(query, location, remote, datePosted, start = 0) {
  const params = new URLSearchParams({
    keywords: query,
    location,
    f_LF: 'f_AL',       // Easy Apply filter
    f_TPR: datePosted,  // Date posted
    start: String(start),
    sortBy: 'DD',       // Most recent first
  })
  if (remote) params.set('f_WT', '2') // Remote only
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

/**
 * Detects Easy Apply from button text on the public job page.
 * LinkedIn job pages at /jobs/view/ID are publicly accessible.
 * The apply button text is visible without login.
 */
async function detectEasyApply(page, jobId) {
  const url = `https://www.linkedin.com/jobs/view/${jobId}/`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(1500, 2500)

    // Check if redirected to login (occasionally happens with aggressive bot detection)
    if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
      console.log(`  ⚠️  Job ${jobId} requires login — skipping`)
      return { isEasyApply: false, jobData: null }
    }

    // Read all button texts on the page
    const buttonTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a[role="button"]'))
        .map(el => el.textContent?.trim().toLowerCase() ?? '')
        .filter(Boolean)
    )

    // Easy Apply detection — check for both EN and PT-BR text
    const isEasyApply = buttonTexts.some(text =>
      text.includes('easy apply') ||
      text.includes('candidatura simplificada')
    )

    // Also check if there's a regular "Apply" button pointing to external URL
    const hasExternalApply = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
      return links.some(a => {
        const href = a.href ?? ''
        const text = a.textContent?.trim().toLowerCase() ?? ''
        return !href.includes('linkedin.com') &&
               (text.includes('apply') || text.includes('candidatar'))
      })
    })

    if (!isEasyApply && hasExternalApply) {
      console.log(`  ⏭️  Job ${jobId} — external apply link detected, skipping`)
      return { isEasyApply: false, jobData: null }
    }

    if (!isEasyApply) {
      console.log(`  ⏭️  Job ${jobId} — no Easy Apply button found, skipping`)
      return { isEasyApply: false, jobData: null }
    }

    // Extract job data from the public page
    const jobData = await page.evaluate((id) => {
      const get = (selectors) => {
        for (const sel of selectors) {
          const text = document.querySelector(sel)?.textContent?.trim()
          if (text) return text
        }
        return ''
      }

      return {
        id,
        title: get(['h1', '.job-details-jobs-unified-top-card__job-title h1']),
        companyName: get([
          '.job-details-jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name a',
          '.topcard__org-name-link',
        ]),
        location: get([
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__bullet',
          '.topcard__flavor--bullet',
        ]),
        descriptionText: get([
          '.jobs-description__content',
          '.job-details-about-the-job-module__description',
          '.description__text',
        ]),
        applicantsCount: get([
          '.num-applicants__caption',
          '.jobs-unified-top-card__applicant-count',
          '.topcard__flavor--metadata',
        ]),
        salary: get(['.compensation__salary', '.salary']),
        postedAt: get([
          '.jobs-unified-top-card__posted-date',
          '.topcard__flavor--metadata',
        ]),
        easyApply: true,
      }
    }, jobId)

    return { isEasyApply: true, jobData }

  } catch (err) {
    console.log(`  ❌ Error processing job ${jobId}: ${err.message}`)
    return { isEasyApply: false, jobData: null }
  }
}

// ── Browser setup ──────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 768 },
  locale: 'pt-BR',
  extraHTTPHeaders: {
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  },
})

// Block unnecessary resources for faster loading
await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,otf}', route => route.abort())

const page = await context.newPage()
const seenIds = new Set()
let totalFound = 0
let totalChecked = 0

// ── Main loop ──────────────────────────────────────────────────────────────
for (const query of searchQueries) {
  console.log(`\n🔍 Searching: "${query}" | Location: ${location} | Remote: ${remote}`)

  let collected = 0
  let start = 0
  let emptyPages = 0

  while (collected < maxResultsPerQuery && emptyPages < 3) {
    const searchUrl = buildSearchUrl(query, location, remote, datePosted, start)
    console.log(`  📄 Loading results page (offset: ${start})...`)

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(2000, 3500)

      // Extract job IDs from search result cards
      const jobLinks = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('a[href*="/jobs/view/"]').forEach(a => {
          const match = a.href?.match(/\/jobs\/view\/(\d+)/)
          if (match) {
            results.push({
              id: match[1],
              link: `https://www.linkedin.com/jobs/view/${match[1]}/`
            })
          }
        })
        return [...new Map(results.map(r => [r.id, r])).values()]
      })

      if (jobLinks.length === 0) {
        emptyPages++
        console.log(`  ⚠️  No jobs found on this page (${emptyPages}/3 empty pages)`)
        break
      }

      emptyPages = 0
      console.log(`  📋 Found ${jobLinks.length} job links on this page`)

      for (const { id } of jobLinks) {
        if (collected >= maxResultsPerQuery) break
        if (seenIds.has(id)) continue
        seenIds.add(id)

        totalChecked++
        await randomDelay(2000, 4000)

        const { isEasyApply, jobData } = await detectEasyApply(page, id)

        if (isEasyApply && jobData) {
          jobData.searchQuery = query
          jobData.inputUrl = searchUrl

          await Actor.pushData(jobData)
          collected++
          totalFound++
          console.log(`  ✅ [${collected}] ${jobData.title} — ${jobData.companyName}`)
        }
      }

      start += 25
      await randomDelay(3000, 5000)

    } catch (err) {
      console.log(`  ❌ Error on search page: ${err.message}`)
      emptyPages++
    }
  }

  console.log(`  📊 "${query}": ${collected} Easy Apply jobs confirmed`)

  if (searchQueries.indexOf(query) < searchQueries.length - 1) {
    await randomDelay(5000, 10000)
  }
}

// ── Wrap up ────────────────────────────────────────────────────────────────
await browser.close()

console.log(`\n✅ Actor completed`)
console.log(`📋 Total jobs checked: ${totalChecked}`)
console.log(`🎯 Easy Apply confirmed: ${totalFound}`)
console.log(`📊 Conversion rate: ${totalChecked > 0 ? ((totalFound / totalChecked) * 100).toFixed(1) : 0}%`)

await Actor.exit()
