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

Supported city centers: Berkeley, Oakland, Alameda, San Francisco, Richmond, Walnut Creek, Fremont, San Jose, Santa Clara, and Fairfield. Alternatively choose **Use my current location** and grant your browser permission. Device coordinates stay in browser storage. You can return to a city center at any time.

Driving mileage is not computed or displayed in Gather. Each event detail has a Google Maps driving-directions link; Google Maps shows the route, travel distance, and time. Demo routes use city centers because their venues are fictional. Device-location mode lets Maps ask for an origin rather than including saved device coordinates in the URL. The Search area radius uses geographic proximity internally, not road distance. Nearby Discover excludes unverified locations by default. **Include unverified locations** lets you inspect those records explicitly; **Within my brief** still excludes them. Locations inferred only from a listing title remain unverified. Known distant sources, including the Fairfax County, Virginia and Los Angeles examples, never pass the nearby filter, even with the unverified-location option enabled. Saved lists retain events outside your current radius unless you enable that filter.

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

## Apify live discovery

Put `APIFY_TOKEN` in `.env` on the server using an account with access to `apify/google-search-scraper` and `apify/website-content-crawler`. Never commit credentials or put them in frontend code.

Choose **Web-discovered opportunities**, then choose **Find opportunities online** (also available in the empty state), or expand **Search the web for opportunities**. Selecting the web view alone does not run a search. This is the only action that starts paid discovery. Regular searches use your selected home city, offering category, organization type, and current year. Exact device coordinates, revenue, and organization descriptions are not sent. The optional pilot checkbox uses these original queries instead:

1. Bay Area holiday market vendor applications 2026
2. Oakland market "vendor application" November 2026
3. Berkeley holiday fair "call for vendors"

Three queries, one results page each; up to five shortlisted organic URLs; at most ten crawl pages, depth one. Social sites and Reddit are excluded from future shortlists. Search AI add-ons, leads, ads, and search-content enrichment are disabled. No language model service is called.

The crawler defaults to plain HTTP (`cheerio`) after Apify's Firefox mode failed to launch during the pilot. It cannot render JavaScript-only content. Set `APIFY_CRAWLER_TYPE=playwright:firefox` to try browser rendering when that service issue is resolved.

The server caches completed discoveries (scoped by origin/radius) and successful search results (scoped by query) independently for 24 hours, so a failed crawl can reuse its search stage. The most recently completed cached discovery is available after server restarts without another paid search; its retrieval date is shown even if it is old. While discovery runs, an animated loader shows the current search/crawl/local-check stage and elapsed time; reduced-motion preferences disable the spinner animation. The search button stays disabled until the run finishes or fails, and a temporary polling connection error keeps checking the existing job. New completed runs include search, page-read, and local extraction timings under Run details and usage. Cached results retain the original run timings. No AI summary model is involved. Each Actor has a 180-second timeout. One discovery job runs at a time, and a browser reload can resume checking it. An interrupted server process loses in-flight job status. Check Console before retrying because completed work may already have incurred charges.

Run details link to Apify Console and show reported `usageTotalUsd` where available. Check Console for final charges. Page/time limits bound workload, not a guaranteed dollar budget. Existing Apify usage is the only paid integration; no hosting, database, model, or geocoding service is added.

## Extraction limits

The crawler provides text; Gather applies conservative label/keyword extraction. Explicit year-bearing dates, supported labeled cities, venue/address, attendance and audience labels, single-dollar vendor fees, vendor categories with positive/negative/conditional evidence, requirements, and application links can be extracted with exact source evidence. Category clauses are parsed independently: rejection language is not acceptance, exceptions such as locally roasted coffee remain conditional, and capacity limits require review. Shared normalization updates fresh results, server caches, and browser-stored records. Known distant search results are excluded before using crawl slots; future crawls also cache raw pages locally for reprocessing. Ambiguous or unsupported locations remain unverified. Page layout differences, multiday dates, ambiguous fee ranges, and pages containing multiple events can require manual review. Application status stays unknown unless a source explicitly says it is closed/sold out or a known deadline/event date has passed. Generic preparation steps are presented separately from source requirements. Additional fees, nonprofit/club eligibility, and missing location/date information must be confirmed with the organizer. Public listings are not automatically verified matches.

Official Actor schemas: [Google Search Results Scraper](https://apify.com/apify/google-search-scraper/input-schema) and [Website Content Crawler](https://apify.com/apify/website-content-crawler/input-schema).

The server binds to loopback and has no authentication. Keep it local. Static files are explicitly allowlisted; `.env`, server modules, and cached data files are not served directly.

## Suggested freshness policy

For a future hosted version, start with daily discovery and recheck saved opportunities every 6–12 hours when deadlines are within a week. Recheck the source immediately before applying. This is a product recommendation, not a schedule configured by this project. The local demo uses explicit user-triggered discovery and a 24-hour cache; it does not scrape in the background. Respect source terms and rate limits, avoid repeated full discovery per visitor, and track last-checked times. Apify can schedule Actors, but a hosted ingestion flow would also need to bring scheduled results into Gather.
