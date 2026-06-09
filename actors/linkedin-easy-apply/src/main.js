/**
 * LinkedIn Easy Apply Scraper
 *
 * Optimized for speed:
 * - Step 1: Extract job IDs + Easy Apply badge directly from search result cards
 *   (no individual page load needed for detection when badge is present)
 * - Step 2: Load job detail pages in parallel (CONCURRENCY=3) only for confirmed jobs
 *
 * This reduces a 30-min sequential run to ~3-5 minutes.
 */
import { Actor } from 'apify'
import { chromium } from 'playwright'

await Actor.init()

// ── Input ──────────────────────────────────────────────────────────────────
const input = await Actor.getInput()
const {
  searchQueries = ['Software Engineer'],
  location = 'United States',
  remote = true,
  easyApplyOnly = true,
  seniorityLevel = [],
  datePosted = 'r604800',
  maxResultsPerQuery = 20,
} = input ?? {}

// ── Config ─────────────────────────────────────────────────────────────────
const CONCURRENCY = 3  // parallel detail page loads
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const randomDelay = (min, max) => sleep(min + Math.random() * (max - min))

// ── Helpers ────────────────────────────────────────────────────────────────
function buildSearchUrl(query, start = 0) {
  const params = new URLSearchParams({
    keywords: query,
    location,
    f_LF: 'f_AL',
    start: String(start),
    sortBy: 'DD',
  })
  if (remote) params.set('f_WT', '2')
  if (datePosted) params.set('f_TPR', datePosted)
  if (seniorityLevel.length > 0) params.set('f_E', seniorityLevel.join(','))
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

/**
 * Extracts job cards from a search results page.
 * Returns id + whether the Easy Apply badge is visible on the card.
 * This avoids opening individual job pages just for detection.
 */
async function extractJobCards(page) {
  return page.evaluate(() => {
    const results = []
    document.querySelectorAll('a[href*="/jobs/view/"]').forEach(a => {
      const match = a.href?.match(/\/jobs\/view\/(\d+)/)
      if (!match) return

      // Walk up to the card container to check for Easy Apply badge
      const card = a.closest('li, .job-search-card, .base-card') ?? a.parentElement
      const cardText = card?.textContent?.toLowerCase() ?? ''
      const hasEasyApplyBadge =
        cardText.includes('easy apply') ||
        cardText.includes('candidatura simplificada') ||
        !!card?.querySelector('[class*="easy-apply"], .job-search-card__easy-apply-label')

      results.push({ id: match[1], easyApplyOnCard: hasEasyApplyBadge })
    })
    return [...new Map(results.map(r => [r.id, r])).values()]
  })
}

/**
 * Loads a job detail page and extracts structured data.
 * If skipVerification=false, also checks the apply button before returning.
 */
async function fetchJobDetail(context, jobId, skipVerification) {
  const page = await context.newPage()
  try {
    await page.goto(`https://www.linkedin.com/jobs/view/${jobId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await randomDelay(1000, 2000)

    if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
      return null
    }

    // Verify Easy Apply button if not confirmed from search card
    if (!skipVerification) {
      const buttonTexts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, a[role="button"]'))
          .map(el => el.textContent?.trim().toLowerCase() ?? '')
          .filter(Boolean)
      )
      const isEasyApply = buttonTexts.some(t =>
        t.includes('easy apply') || t.includes('candidatura simplificada')
      )
      if (!isEasyApply) return null
    }

    return await page.evaluate((id) => {
      const get = (selectors) => {
        for (const sel of selectors) {
          const text = document.querySelector(sel)?.textContent?.trim()
          if (text) return text
        }
        return ''
      }
      return {
        id,
        title: get(['h1']),
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
        ]),
        salary: get(['.compensation__salary', '.salary']),
        postedAt: get(['.jobs-unified-top-card__posted-date']),
        easyApply: true,
      }
    }, jobId)

  } catch (err) {
    console.log(`  ❌ Job ${jobId}: ${err.message}`)
    return null
  } finally {
    await page.close()
  }
}

/**
 * Processes a batch of job IDs in parallel (up to CONCURRENCY at a time).
 */
async function processBatch(context, jobs, easyApplyOnly) {
  const results = []
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const chunk = jobs.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(({ id, easyApplyOnCard }) => {
        const skipVerification = !easyApplyOnly || easyApplyOnCard
        return fetchJobDetail(context, id, skipVerification)
      })
    )
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
    if (i + CONCURRENCY < jobs.length) await randomDelay(1500, 2500)
  }
  return results
}

// ── Browser ────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 768 },
  locale: 'en-US',
  extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
})
await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,otf}', r => r.abort())

const searchPage = await context.newPage()
const seenIds = new Set()
let totalFound = 0
let totalChecked = 0

// ── Main loop ──────────────────────────────────────────────────────────────
console.log(`⚙️  easyApplyOnly=${easyApplyOnly} | remote=${remote} | location="${location}" | concurrency=${CONCURRENCY}`)

for (const query of searchQueries) {
  console.log(`\n🔍 Query: "${query}"`)
  let collected = 0
  let start = 0
  let emptyPages = 0

  while (collected < maxResultsPerQuery && emptyPages < 3) {
    const searchUrl = buildSearchUrl(query, start)

    try {
      await searchPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(1500, 2500)

      const cards = await extractJobCards(searchPage)
      if (cards.length === 0) { emptyPages++; break }
      emptyPages = 0

      const toProcess = cards
        .filter(c => !seenIds.has(c.id))
        .slice(0, maxResultsPerQuery - collected)

      toProcess.forEach(c => seenIds.add(c.id))
      totalChecked += toProcess.length

      const fromCard = toProcess.filter(c => c.easyApplyOnCard).length
      const needsVerify = toProcess.filter(c => !c.easyApplyOnCard).length
      console.log(`  📋 ${toProcess.length} jobs — ${fromCard} confirmed on card, ${needsVerify} need page verification`)

      const details = await processBatch(context, toProcess, easyApplyOnly)

      for (const jobData of details) {
        jobData.link = `https://www.linkedin.com/jobs/view/${jobData.id}/`
        jobData.searchQuery = query
        await Actor.pushData(jobData)
        collected++
        totalFound++
        console.log(`  ✅ [${collected}] ${jobData.title} — ${jobData.companyName}`)
      }

      start += 25
      await randomDelay(2000, 3000)

    } catch (err) {
      console.log(`  ❌ Search page error: ${err.message}`)
      emptyPages++
    }
  }

  console.log(`  📊 "${query}": ${collected} jobs collected`)
  if (searchQueries.indexOf(query) < searchQueries.length - 1) {
    await randomDelay(3000, 5000)
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
await browser.close()
console.log(`\n✅ Done — checked: ${totalChecked} | collected: ${totalFound}`)
if (easyApplyOnly && totalChecked > 0) {
  console.log(`📊 Easy Apply rate: ${((totalFound / totalChecked) * 100).toFixed(1)}%`)
}

await Actor.exit()
