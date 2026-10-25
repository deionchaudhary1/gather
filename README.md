# Gather

Find markets, festivals, and community events for small businesses, nonprofits, and clubs to expand business exposure and reach. Gather includes a local vendor application catalog and separate public listings from Apify.

## Run

Node.js 22.9+ is required. No package dependencies.

```sh
npm run dev
```

Open http://127.0.0.1:4173. `npm run dev` and `npm start` load `.env` automatically when present. Exported environment variables take precedence. Run `npm test` to verify location, matching, planning, and discovery behavior.

## First-visit demo onboarding

New visitors see the centered Gather logo, then a sign-up / login welcome screen. Choose **I’m a small business**, create a local demo username and password, and set up a new organization profile before entering Discover. The welcome flow focuses exclusively on small businesses. There is no market-organizer account path.

Demo accounts and sessions stay in this browser. Passwords are salted and hashed with Web Crypto PBKDF2; plaintext passwords are not saved. This is a demo flow, not server authentication or a private multiuser service. Use a throwaway demo password. Existing sample profiles and saved events remain available in the shared workspace. Drafts and application plans stay scoped to each organization profile. Browser storage and Web Crypto on localhost are required for demo sign-up.

Completed sessions return to the workspace on refresh; unfinished accounts return to profile setup. **Log out** returns to the welcome screen. **Replay welcome** in the sidebar plays the logo sequence again for recording without deleting accounts, profiles, or saved work. Use a new username to record a fresh signup, or log back into an existing demo account.

## Organization profile and nearby events

The business switcher includes three approved test profiles: **Daybreak Coffee** (Berkeley, coffee/beverages, 30 miles, $200), **East Bay Clay Studio** (Oakland, handmade ceramics, 20 miles, $100), and **Loop & Leaf Refill** (San Francisco, sustainable household retail, 25 miles, $150). Each is editable and persists independently. An existing customized profile is preserved as a previous profile rather than overwritten.

Choose **Demo opportunities** to explore 30 seeded catalog listings, including 24 additional applications across beverage service, handmade goods, sustainable retail, festivals, and community organizations. Catalog records are synthetic development data, retain their internal `sample` flag, and contain no organizer contacts or purported applications for their fictional events. Each card and detail header links to a clearly labeled real example application page (Off the Grid or HEAD WEST); these are illustrative references, not applications for the fictional event. The UI calls them demo opportunities; they are never marked as public sources or mixed into Apify results. Original catalog IDs remain stable so saved events, drafts, and plans still work. Cases include shared and category-specific matches, conditional acceptance, distant locations, different budgets, free spaces, unpublished fees, and closed applications.

Choose **Compare all three** for a matrix of the same listings across the three businesses, including distant and unverified listings. Each cell separates category acceptance/exclusion/conditions, radius, fee, application status, and supporting source text. Scores never override hard exclusions and do not estimate acceptance probability. Comparison does not start a search. The active business controls the detail/application workflow.

Favorites remain shared across businesses. Inquiry drafts, application materials, notes, statuses, and checklists belong to each business independently; existing drafts and plans migrate to the original profile once. Switching businesses does not copy those drafts to the other businesses.

Use **Edit your brief** to set organization type, offering, home city, travel radius, budget, interests, target audience, years operating, and optional revenue range. Revenue stays local and is excluded from matching, search requests, inquiry templates, and application exports.

Supported city centers: Berkeley, Oakland, Alameda, San Francisco, Richmond, Walnut Creek, Fremont, San Jose, Santa Clara, Fairfield, Concord, and additional supported Bay Area cities shown in the profile selector. Alternatively choose **Use my current location** and grant your browser permission. Device coordinates stay in browser storage. You can return to a city center at any time.

Driving mileage is not computed or displayed in Gather. Each event detail has a Google Maps driving-directions link; Google Maps shows the route, travel distance, and time. Demo routes use city centers because their venues are fictional. Device-location mode lets Maps ask for an origin rather than including saved device coordinates in the URL. The Search area radius uses geographic proximity internally, not road distance. Web Discover requires source-backed Bay Area locations; the missing-dates option reveals incomplete Bay Area records, while **Within my brief** still requires supported matching criteria. Locations inferred only from a listing title remain unverified. Known distant sources, including the Fairfax County, Virginia and Los Angeles examples, never pass the nearby filter, even with the unverified-location option enabled. Saved lists retain events outside your current radius unless you enable that filter.

Compatibility is deterministic and local, not AI: category (35), geographic search area (25), published fee (20), explicit organization eligibility (10), and shared interest/audience words (10). The score is not an acceptance probability. Unknown fields remain unknown, and known exclusions, past events, and expired deadlines do not qualify. **Hide past and closed** is on by default in Discover. You can still inspect them by turning it off. The user chose local matching rather than a model service for this version.

## Opportunity presentation

Cards show distinctive strong-fit, review, and outside-brief badges, a compatibility score, and free Unsplash stock images with source credits. Photos are illustrative rather than photos of the events. Default ordering is fit tier, then earliest event date, then score; unknown dates sort last within a tier. Dates/deadlines are still filtered for closed/past applications by default.

The detail header links to the external application when extracted, with the source page as fallback. The compatibility score and its evidence are the main detail section. Next steps, application requirements/materials, audience/fee details, and progress/notes are collapsed until requested. The existing checklist remains local; no generative model service is added.

Profiles named `test` or `2345678` (case-insensitive, surrounding whitespace ignored) are excluded during profile initialization and the cleaned profile list is persisted. Other profiles remain available.

Stock photo sources (free Unsplash license): [Kyle Nieber, outdoor market](https://unsplash.com/photos/eE-ffApg7oI), [Shelley Pauls, market produce](https://unsplash.com/photos/kuR1Kwo4my4), [Quino Al, pottery](https://unsplash.com/photos/person-making-pot-vBxlL1xpSdc), [Quan Jing, coffee vendor](https://unsplash.com/photos/man-preparing-drinks-at-a-mobile-coffee-van-yWICG2j7rkE). Images load remotely; there is no Unsplash API dependency.

## Saved events, calendars, and applications

- Save events with the heart button. Sort your shortlist by compatibility, distance, event date, deadline, or published fee; unknown values sort last.
- Switch Saved opportunities between list and monthly calendar. The calendar always includes the full saved list, independent of list filters. Event dates and deadlines are separate entries. Listings without event dates remain in an undated list.
- Export `.ics` to import saved dates and deadlines into a calendar application. Unknown dates are skipped. Catalog exports identify their source as Gather's vendor catalog; public listings retain source URLs. Export is a snapshot, not a subscription or reminder service.
- Open an event for venue, audience, attendance (if published), participation/rental costs, requirements, application steps, source links, and compatibility evidence.
- Complete applications using the organizer's website when a verified application link is available. Otherwise follow the source page. Gather does not submit applications, send messages, or take payments.
- Prepare editable application materials or inquiry drafts and download `.txt`. Application materials omit revenue. Saved materials are drafts and do not automatically update when you later edit the organization profile; review them before use.
- Track your own Interested / Preparing / Applied / Accepted / Not attending status, preparation notes, organizer requirement checklist, general planning tasks, and custom tasks. These are user-reported states, not organizer confirmations.
- Event detail links use `#event/<id>`. Sample links work on this local server; public listing links require the record to be available in the same browser or the server's latest cached discovery. These are local workspace links, not globally hosted listings.

All profiles, saved IDs, drafts, application plans, and device coordinates persist in this browser's localStorage, with in-memory operation if browser storage is unavailable. Demo accounts are browser-local only; there is no server account service or cross-device synchronization. Sample events remain accessible alongside public listings so old sample saves and drafts are preserved.

## Apify web discovery

Set `APIFY_TOKEN` in the server-only `.env` using an account with access to `apify/google-search-scraper` and `apify/website-content-crawler`. Never commit credentials or put them in frontend code.

**Web-discovered opportunities** is the default for new browsers. Entering this view, changing the selected business/city/offering, or saving a changed profile checks that city’s cached result and starts Apify automatically if needed. Existing browsers keep their chosen source. Searches use two queries based on the selected supported Bay Area city, offering, organization type, and current year, plus a regional Bay Area query so nearby opportunities across city boundaries are not missed. Exact device coordinates, revenue, and business descriptions are excluded. The old fixed holiday pilot-search override has been removed.

Each new search uses at most three Google results pages and five shortlisted source URLs plus up to three trusted organizer starting pages, with at most ten fresh crawl pages at depth zero. Social sites, general permit pages, generic city directories, and known out-of-region sources are excluded or deprioritized. A small organizer-source registry supplies fallback crawl URLs when search ranking is poor; it contains no event dates, fees, or synthetic event records. Those pages are still read through Apify and must pass the same source-fact checks. Ads, search-engine AI add-ons, lead enrichment, and language-model services are disabled. Scraping and source extraction are real; compatibility remains transparent local matching.

A new uncached run can take a minute or more (the initial live validation took about 90 seconds); cached results normally load in under a second. The loader shows actual search/read/check stages and elapsed time. Run details show original Actor links, reported usage, verification counts, and timings. A reused source-run link is labeled as reused rather than a new charge. Check Apify Console for final charges.

Search results and completed discoveries are cached for up to 24 hours. Discoveries are scoped by city, offering, and organization type, rather than travel radius. Radius, sorting, categories, and compatibility filters operate locally without another paid search. Recently crawled, source-backed Bay Area event pages may be reused across nearby cities, retaining their original per-event retrieval time and source evidence. The oldest included source check limits cache freshness. One job runs at a time; other city requests wait. Jobs and results for different cities do not overwrite each other. A browser reload can resume polling its own city job; a server restart loses in-flight jobs but reloads completed city-specific caches.

**Refresh sources** explicitly rereads sources using Apify credits; the search stage may still reuse its cached SERP. It does not repeatedly relaunch after completing. If a search fails, it shows an error and waits for an explicit retry.

## Location, date, and source verification

Default Discover results require both a source-backed Bay Area city and a published event date. The search-area radius and **Hide past and closed** filters then apply. Florida/Michigan Oakland pages, other states, and known distant California locations cannot enter the Bay Area feed even when incomplete listings are enabled. The supported city list includes Concord and additional cities across the nine-county Bay Area; coordinates represent city centers rather than exact verified venues.

**Show Bay Area listings with missing dates** reveals only listings whose Bay Area city is supported by source evidence but whose date needs confirmation. It does not bypass the regional boundary or admit arbitrary unknown locations. Verification diagnostics distinguish missing dates, location exclusions, out-of-radius listings, and past/closed applications; counts can overlap. If no verified listings match, the UI explains what was filtered rather than simply suggesting a location-filter bypass.

Extraction supports labeled fields, ordinary month/day/year dates, same-month date ranges, published times, application deadlines, and schema.org Event JSON-LD. Structured event lists are separated into event-specific records with individual event links; they never borrow another listing’s fee or application form. Unrelated entertainment listings and related-event cards are excluded. Publication/update timestamps, broad year-round ranges, and ambiguous multiple dates are not passed off as confirmed event dates. A missing year is used only when the event’s own title supplies a single explicit year; the current year is never guessed. Exact source excerpts are retained. Times not published remain unknown. Search snippets may conservatively identify closed applications, but do not confirm locations or event dates.

The feed contains only extracted real-source records. It never pads results with the synthetic demo catalog. Source-backed city/date does not establish vendor acceptance: offerings, booth availability, fees, and application status can still require confirmation. Each detail links to the application when found, otherwise to the specific event page/source. Users apply with the organizer, not through Gather.

The crawler defaults to raw HTTP (`cheerio`). It cannot read JavaScript-only or blocked pages reliably; unreadable-page counts appear in Run details. No CAPTCHA bypass is attempted. Future source changes may require review. Each Actor has a 180-second timeout. Completed work may already incur charges even if later processing fails.

Official Actor schemas: [Google Search Results Scraper](https://apify.com/apify/google-search-scraper/input-schema) and [Website Content Crawler](https://apify.com/apify/website-content-crawler/input-schema).

The server binds to loopback and has no authentication. Keep it local. Static files are explicitly allowlisted; `.env`, server modules, and cached data files are not served directly.

## Suggested freshness policy

For a future hosted version, start with daily discovery and recheck saved opportunities every 6–12 hours when deadlines are within a week. Recheck the source immediately before applying. This is a product recommendation, not a schedule configured by this project. The local demo checks the selected city on entering the web view, reuses fresh results for up to 24 hours, and has no recurring background schedule. Respect source terms and rate limits, avoid repeated full discovery per visitor, and track last-checked times. Apify can schedule Actors, but a hosted ingestion flow would also need to bring scheduled results into Gather.
