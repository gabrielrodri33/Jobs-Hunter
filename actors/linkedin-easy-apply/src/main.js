/**
 * LinkedIn Easy Apply Scraper
 * Apify actor using Playwright (pre-installed in Docker image)
 *
 * Flow:
 * 1. Login via li_at cookie
 * 2. Search jobs with Easy Apply URL filter
 * 3. For each job found, open job page and verify Easy Apply button
 * 4. Push only verified Easy Apply jobs to dataset
 */
import { Actor } from 'apify'
import { chromium } from 'playwright'

await Actor.init()

const input = await Actor.getInput()
const {
  linkedinCookie,
  searchQueries = ['Desenvolvedor .NET'],
  location = 'Brazil',
  remote = true,
  datePosted = 'r604800',
  maxResultsPerQuery = 20,
} = input ?? {}

if (!linkedinCookie) throw new Error('linkedinCookie is required')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const randomDelay = (min = 2000, max = 4000) => sleep(min + Math.random() * (max - min))

// Launch browser (Playwright Chrome pre-installed in Apify Docker image)
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 768 },
  locale: 'pt-BR',
})

// Set LinkedIn session cookie
await context.addCookies([{
  name: 'li_at',
  value: linkedinCookie,
  domain: '.linkedin.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'None',
}])

// Verify login
const testPage = await context.newPage()
await testPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 })
if (testPage.url().includes('/login') || testPage.url().includes('/checkpoint')) {
  await browser.close()
  throw new Error('LinkedIn cookie expired or invalid. Please refresh your li_at cookie.')
}
console.log('✅ LinkedIn login confirmed')
await testPage.close()

const page = await context.newPage()
const seenIds = new Set()
let totalFound = 0

for (const query of searchQueries) {
  console.log(`\n🔍 Searching: "${query}"`)
  let collected = 0
  let start = 0

  while (collected < maxResultsPerQuery) {
    // Build search URL with Easy Apply filter
    const params = new URLSearchParams({
      keywords: query,
      location,
      f_LF: 'f_AL',      // Easy Apply filter
      f_TPR: datePosted,
      start: String(start),
      sortBy: 'DD',
    })
    if (remote) params.set('f_WT', '2')

    await page.goto(`https://www.linkedin.com/jobs/search/?${params}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    if (page.url().includes('/login')) {
      console.log('⚠️ Session expired during run')
      break
    }

    await randomDelay(2000, 3000)

    // Extract job links from search results page
    const jobLinks = await page.evaluate(() => {
      const links = []
      document.querySelectorAll('a[href*="/jobs/view/"]').forEach(a => {
        const match = a.href.match(/\/jobs\/view\/(\d+)/)
        if (match) links.push({ id: match[1], link: a.href.split('?')[0] })
      })
      return [...new Map(links.map(l => [l.id, l])).values()]
    })

    if (jobLinks.length === 0) break

    for (const { id, link } of jobLinks) {
      if (collected >= maxResultsPerQuery) break
      if (seenIds.has(id)) continue
      seenIds.add(id)

      await randomDelay(2000, 4000)

      // Open job page and verify Easy Apply button
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(1500, 2500)

      // Check for Easy Apply button (check by button text — most stable selector)
      const isEasyApply = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(b => {
          const text = b.textContent?.trim().toLowerCase() ?? ''
          return text.includes('easy apply') || text.includes('candidatura simplificada')
        })
      })

      if (!isEasyApply) {
        console.log(`  ⏭️  Skipping ${id} — not Easy Apply`)
        continue
      }

      // Extract job data
      const jobData = await page.evaluate((jobId) => {
        const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? ''
        return {
          id: jobId,
          title: get('h1'),
          companyName: get('.job-details-jobs-unified-top-card__company-name a') || get('.jobs-unified-top-card__company-name'),
          location: get('.job-details-jobs-unified-top-card__bullet') || get('.jobs-unified-top-card__bullet'),
          descriptionText: get('.jobs-description__content') || get('.job-details-about-the-job-module__description'),
          applicantsCount: get('.num-applicants__caption') || get('.jobs-unified-top-card__applicant-count'),
          salary: get('.compensation__salary') || '',
          postedAt: get('.jobs-unified-top-card__posted-date') || '',
          easyApply: true,
        }
      }, id)

      jobData.link = link
      jobData.searchQuery = query

      await Actor.pushData(jobData)
      collected++
      totalFound++
      console.log(`  ✅ [${collected}/${maxResultsPerQuery}] ${jobData.title} — ${jobData.companyName}`)
    }

    start += 25
    await randomDelay(3000, 6000)
  }

  console.log(`  📊 ${collected} Easy Apply jobs found for "${query}"`)
  await randomDelay(5000, 10000)
}

await browser.close()
console.log(`\n✅ Done — ${totalFound} Easy Apply jobs total`)
await Actor.exit()
