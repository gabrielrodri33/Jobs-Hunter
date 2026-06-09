/**
 * LinkedIn Easy Apply Scraper
 *
 * Scrapes LinkedIn job listings using only public pages — no login or cookie required.
 *
 * Flow:
 * 1. For each search query, builds a LinkedIn search URL with the configured filters
 * 2. Extracts job IDs from search result cards
 * 3. (If easyApplyOnly=true) Opens each job page and verifies the Easy Apply button
 * 4. Pushes confirmed jobs to the dataset with easyApply field set
 *
 * Output fields per job:
 *   id, title, companyName, location, descriptionText, applicantsCount,
 *   salary, postedAt, easyApply, link, searchQuery
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

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const randomDelay = (min = 2000, max = 4000) =>
  sleep(min + Math.random() * (max - min))

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

async function getJobDetails(page, jobId) {
  try {
    await page.goto(`https://www.linkedin.com/jobs/view/${jobId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await randomDelay(1500, 2500)

    if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
      console.log(`  ⚠️  Job ${jobId} redirected to login — skipping`)
      return null
    }

    const buttonTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a[role="button"]'))
        .map(el => el.textContent?.trim().toLowerCase() ?? '')
        .filter(Boolean)
    )

    const isEasyApply = buttonTexts.some(text =>
      text.includes('easy apply') || text.includes('candidatura simplificada')
    )

    const hasExternalApply = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).some(a => {
        const href = a.href ?? ''
        const text = a.textContent?.trim().toLowerCase() ?? ''
        return !href.includes('linkedin.com') &&
          (text.includes('apply') || text.includes('candidatar'))
      })
    )

    if (!isEasyApply && hasExternalApply) return null
    if (!isEasyApply) return null

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
    console.log(`  ❌ Error on job ${jobId}: ${err.message}`)
    return null
  }
}

async function getJobDetailsWithoutVerification(page, jobId) {
  try {
    await page.goto(`https://www.linkedin.com/jobs/view/${jobId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await randomDelay(1500, 2500)

    if (page.url().includes('/login') || page.url().includes('/checkpoint')) return null

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
        easyApply: null,
      }
    }, jobId)

  } catch (err) {
    console.log(`  ❌ Error on job ${jobId}: ${err.message}`)
    return null
  }
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

const page = await context.newPage()
const seenIds = new Set()
let totalFound = 0
let totalChecked = 0

// ── Main loop ──────────────────────────────────────────────────────────────
console.log(`⚙️  Config: easyApplyOnly=${easyApplyOnly} | remote=${remote} | location="${location}" | datePosted=${datePosted || 'any'}`)

for (const query of searchQueries) {
  console.log(`\n🔍 Query: "${query}"`)
  let collected = 0
  let start = 0
  let emptyPages = 0

  while (collected < maxResultsPerQuery && emptyPages < 3) {
    const searchUrl = buildSearchUrl(query, start)

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(2000, 3500)

      const jobLinks = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('a[href*="/jobs/view/"]').forEach(a => {
          const match = a.href?.match(/\/jobs\/view\/(\d+)/)
          if (match) results.push({ id: match[1] })
        })
        return [...new Map(results.map(r => [r.id, r])).values()]
      })

      if (jobLinks.length === 0) { emptyPages++; break }
      emptyPages = 0
      console.log(`  📋 ${jobLinks.length} jobs on page (offset ${start})`)

      for (const { id } of jobLinks) {
        if (collected >= maxResultsPerQuery) break
        if (seenIds.has(id)) continue
        seenIds.add(id)
        totalChecked++

        await randomDelay(2000, 4000)

        const jobData = easyApplyOnly
          ? await getJobDetails(page, id)
          : await getJobDetailsWithoutVerification(page, id)

        if (!jobData) {
          if (easyApplyOnly) console.log(`  ⏭️  Job ${id} — skipped (not Easy Apply)`)
          continue
        }

        jobData.link = `https://www.linkedin.com/jobs/view/${id}/`
        jobData.searchQuery = query

        await Actor.pushData(jobData)
        collected++
        totalFound++
        console.log(`  ✅ [${collected}] ${jobData.title} — ${jobData.companyName}`)
      }

      start += 25
      await randomDelay(3000, 5000)

    } catch (err) {
      console.log(`  ❌ Search page error: ${err.message}`)
      emptyPages++
    }
  }

  console.log(`  📊 "${query}": ${collected} jobs collected`)
  if (searchQueries.indexOf(query) < searchQueries.length - 1) {
    await randomDelay(5000, 10000)
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
await browser.close()
console.log(`\n✅ Done`)
console.log(`📋 Checked: ${totalChecked} | 🎯 Collected: ${totalFound}`)
if (easyApplyOnly) {
  console.log(`📊 Easy Apply rate: ${totalChecked > 0 ? ((totalFound / totalChecked) * 100).toFixed(1) : 0}%`)
}

await Actor.exit()
