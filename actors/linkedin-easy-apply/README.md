# LinkedIn Easy Apply Scraper

Scrapes LinkedIn job listings and returns only **Easy Apply** jobs — verified by reading the apply button on each public job page.

**No LinkedIn account or session cookie required.** The scraper uses only publicly accessible LinkedIn pages.

## What it does

1. Searches LinkedIn Jobs using your configured keywords and filters
2. For each job found, opens the public job page (`linkedin.com/jobs/view/ID`)
3. Reads the apply button text — if it says "Easy Apply" or "Candidatura Simplificada", the job is confirmed
4. Returns only verified Easy Apply jobs (or all jobs if `easyApplyOnly` is disabled)

## Output

Each item in the dataset contains:

| Field | Description |
|---|---|
| `id` | LinkedIn job ID |
| `title` | Job title |
| `companyName` | Company name |
| `location` | Job location |
| `descriptionText` | Full job description |
| `applicantsCount` | Number of applicants (if shown) |
| `salary` | Salary range (if shown) |
| `postedAt` | When the job was posted |
| `easyApply` | `true` if Easy Apply confirmed, `null` if verification was skipped |
| `link` | Direct link to the job page |
| `searchQuery` | The search query that found this job |

## Input

| Field | Type | Default | Description |
|---|---|---|---|
| `searchQueries` | string[] | `["Software Engineer"]` | Job search keywords. Each generates a separate search. |
| `location` | string | `"United States"` | Location filter (country, city, or region) |
| `remote` | boolean | `true` | Remote jobs only |
| `easyApplyOnly` | boolean | `true` | Verify and return only Easy Apply jobs |
| `seniorityLevel` | string[] | `[]` | Filter by seniority (Internship, Entry, Associate, Mid-Senior, Director, Executive) |
| `datePosted` | select | `"r604800"` | Last 24h / Last week / Last month / Any time |
| `maxResultsPerQuery` | integer | `20` | Max jobs to collect per search query (1–100) |

## Limitations

- LinkedIn may occasionally redirect job pages to a login screen if bot detection triggers. Affected jobs are skipped automatically.
- LinkedIn's public search results show approximately 1,000 jobs per query. Use specific keywords to get the most relevant results.
- Run time depends on the number of queries and `maxResultsPerQuery`. Each job page requires an individual request with a random delay (2–4s) to avoid rate limiting. Expect ~3–5 minutes per 20 jobs.
- CSS selectors used for data extraction may break if LinkedIn updates its page structure. Open an issue if you notice empty fields.

## Example use cases

- Daily job alerts for specific roles and locations
- Building a pipeline to analyze job listings with AI
- Tracking Easy Apply opportunities across multiple search terms
- Aggregating job data for personal or research purposes
