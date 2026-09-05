/**
 * Demo data.
 *
 * This is the ONE definition of the demo dataset once the frontend stops using its mocks — the
 * same people, businesses and projects, so a screenshot taken against mocks and one taken against
 * the real stack show the same thing.
 *
 *   npm run seed          # wipe and reseed
 *
 * ⚠️ It TRUNCATES first, so it is destructive by design and only ever points at a local database.
 * A seed that appends instead would double every row on the second run, and the failure looks like
 * a bug in the app rather than in the script.
 *
 * ⚠️ Run against the COMPILED output (`node dist/scripts/seed.js`) — see the npm script. Under
 * ESM there is no working `ts-node` loader for decorators plus `emitDecoratorMetadata`, and
 * without that metadata TypeORM cannot read the entities at all.
 */

import bcrypt from 'bcrypt'

import { ProjectStatus, QuoteStatus, UserRole } from '../common/enums.js'
import AppDataSource from '../database/data-source.js'
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { PortfolioImage } from '../database/entities/portfolio-image.entity.js'
import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { Review } from '../database/entities/review.entity.js'
import { ServiceCategory } from '../database/entities/service-category.entity.js'
import { User } from '../database/entities/user.entity.js'

/**
 * ⚠️ Cost 10 here, not the 12 the app uses.
 *
 * This script hashes nine passwords, and at cost 12 that is about two and a half seconds of pure
 * waiting every time anyone reseeds. The cost is stored INSIDE the hash, so bcrypt verifies these
 * correctly against the app's own comparisons — it is not a mismatch, just a cheaper fixture.
 * Nothing here is a real credential.
 */
const SEED_BCRYPT_ROUNDS = 10

const CATEGORIES = [
  ['plumbing', 'Plumbing', 'Leaks, water heaters, repiping, fixtures and drains.', '🚿'],
  ['electrical', 'Electrical', 'Panels, wiring, lighting, outlets and EV chargers.', '⚡'],
  ['roofing', 'Roofing', 'Inspections, repairs, replacement and gutters.', '🏠'],
  ['hvac', 'Heating & Cooling', 'Furnaces, AC units, ductwork and seasonal service.', '❄️'],
  ['painting', 'Painting', 'Interior and exterior painting, staining and trim.', '🎨'],
  ['carpentry', 'Carpentry', 'Framing, decks, cabinets, doors and built-ins.', '🔨'],
  ['landscaping', 'Landscaping', 'Design, planting, irrigation, fences and hardscape.', '🌿'],
  ['cleaning', 'House Cleaning', 'Deep cleans, move-outs and recurring service.', '🧽'],
] as const

interface SeedPerson {
  key: string
  first: string
  last: string
  phone: string
  role: (typeof UserRole)[keyof typeof UserRole]
}

const PEOPLE: SeedPerson[] = [
  { key: 'maya', first: 'Maya', last: 'Alvarez', phone: '512-555-0134', role: UserRole.HOMEOWNER },
  { key: 'daniel', first: 'Daniel', last: 'Okafor', phone: '512-555-0188', role: UserRole.HOMEOWNER },
  { key: 'luis', first: 'Luis', last: 'Rivera', phone: '512-555-0201', role: UserRole.CONTRACTOR },
  { key: 'nina', first: 'Nina', last: 'Petrov', phone: '512-555-0212', role: UserRole.CONTRACTOR },
  { key: 'tom', first: 'Tom', last: 'Becker', phone: '512-555-0223', role: UserRole.CONTRACTOR },
  { key: 'aisha', first: 'Aisha', last: 'Bello', phone: '512-555-0234', role: UserRole.CONTRACTOR },
  { key: 'marco', first: 'Marco', last: 'Silva', phone: '512-555-0245', role: UserRole.CONTRACTOR },
  { key: 'priya', first: 'Priya', last: 'Raman', phone: '512-555-0256', role: UserRole.CONTRACTOR },
    // ⚠️ `staff`, not `admin` — `admin` is Hasura's built-in superuser role. See enums.ts.
  { key: 'staff', first: 'Sam', last: 'Nakamura', phone: '512-555-0100', role: UserRole.STAFF },
]

interface SeedProfile {
  key: string
  person: string
  businessName: string
  bio: string
  years: number
  license: string | null
  city: string
  state: string
  zip: string
  radius: number
  rateMin: number
  rateMax: number
  trades: string[]
  portfolio: string[]
}

const PROFILES: SeedProfile[] = [
  {
    key: 'rivera',
    person: 'luis',
    businessName: 'Rivera Plumbing Co.',
    bio: 'Third-generation plumbers working the Austin metro since 2009. We do the unglamorous half of the job properly — shutoffs labelled, pans installed, permits pulled — because that is the half that floods a hallway at 2am when it is skipped.',
    years: 17,
    license: 'TX-PL-44219',
    city: 'Austin',
    state: 'TX',
    zip: '78704',
    radius: 30,
    rateMin: 95,
    rateMax: 145,
    trades: ['plumbing', 'hvac'],
    portfolio: ['Tankless water heater install', 'Whole-home repipe, 1962 build', 'Slab leak repair'],
  },
  {
    key: 'brightspark',
    person: 'nina',
    businessName: 'BrightSpark Electric',
    bio: 'Licensed master electrician. Panel upgrades, recessed lighting, and EV charger installs. Every job gets a photo of the finished panel with the circuits labelled, emailed to you the same day.',
    years: 11,
    license: 'TX-EL-90183',
    city: 'Austin',
    state: 'TX',
    zip: '78745',
    radius: 25,
    rateMin: 110,
    rateMax: 165,
    trades: ['electrical'],
    portfolio: ['200A panel upgrade', 'Recessed lighting, open plan', 'Level 2 EV charger'],
  },
  {
    key: 'summit',
    person: 'tom',
    businessName: 'Summit Roofing & Exteriors',
    bio: 'Storm damage, full replacements and the kind of small repair other roofers will not drive out for. We will tell you when a roof has five years left in it instead of selling you one you do not need yet.',
    years: 22,
    license: 'TX-RF-11902',
    city: 'Round Rock',
    state: 'TX',
    zip: '78664',
    radius: 45,
    rateMin: 85,
    rateMax: 130,
    trades: ['roofing', 'carpentry'],
    portfolio: ['Architectural shingle replacement', 'Hail damage repair', 'Standing seam metal roof'],
  },
  {
    key: 'verdant',
    person: 'aisha',
    businessName: 'Verdant Landscapes',
    bio: 'Drought-tolerant design for central Texas. Native planting, drip irrigation and limestone hardscape. We plant for the July your yard will actually have, not the one on the plant tag.',
    years: 8,
    license: null,
    city: 'Austin',
    state: 'TX',
    zip: '78702',
    radius: 20,
    rateMin: 65,
    rateMax: 110,
    trades: ['landscaping'],
    portfolio: ['Xeriscape front yard', 'Limestone patio and fire pit', 'Drip irrigation retrofit'],
  },
  {
    key: 'trueline',
    person: 'marco',
    businessName: 'TrueLine Painting',
    bio: 'Interior and exterior painting with genuine prep — caulk, sand, prime. A cheap paint job is a paint job you buy twice, and the difference is entirely in the two days before any colour goes on.',
    years: 14,
    license: 'TX-PT-30554',
    city: 'Austin',
    state: 'TX',
    zip: '78751',
    radius: 30,
    rateMin: 55,
    rateMax: 90,
    trades: ['painting', 'carpentry'],
    portfolio: ['Exterior repaint, 1940s bungalow', 'Cabinet refinishing', 'Whole interior, three bedrooms'],
  },
  {
    key: 'northgate',
    person: 'priya',
    businessName: 'Northgate HVAC',
    bio: 'Heating and cooling, and the load calculation that should come before either. Most of the units we replace were two sizes too big for the house, which is why they short-cycled and never dehumidified.',
    years: 13,
    license: 'TX-AC-77310',
    city: 'Cedar Park',
    state: 'TX',
    zip: '78613',
    radius: 35,
    rateMin: 100,
    rateMax: 150,
    trades: ['hvac', 'electrical'],
    portfolio: ['Variable-speed system swap', 'Duct sealing and balancing', 'Mini-split for a garage conversion'],
  },
]

async function seed(): Promise<void> {
  await AppDataSource.initialize()
  console.log('connected to', AppDataSource.options.database)

  /**
   * ⚠️ `TRUNCATE … RESTART IDENTITY CASCADE`, in one statement.
   *
   * `CASCADE` handles the foreign keys, so the tables do not have to be listed in dependency
   * order. `RESTART IDENTITY` resets the BIGSERIAL sequences, which is what makes a reseed
   * produce the same ids every time — without it, the second run starts at 10 and every URL in
   * a screenshot or a saved test fixture is wrong.
   */
  await AppDataSource.query(`
    TRUNCATE TABLE
      "reviews", "quotes", "projects", "portfolio_images",
      "contractor_services", "contractor_profiles", "service_categories", "users"
    RESTART IDENTITY CASCADE
  `)
  console.log('truncated')

  const categoryRepo = AppDataSource.getRepository(ServiceCategory)
  const categories = new Map<string, ServiceCategory>()
  for (const [slug, name, description, icon] of CATEGORIES) {
    const saved = await categoryRepo.save(categoryRepo.create({ slug, name, description, icon }))
    categories.set(slug, saved)
  }
  console.log(`seeded ${categories.size} categories`)

  const userRepo = AppDataSource.getRepository(User)
  const users = new Map<string, User>()
  for (const person of PEOPLE) {
    // The demo password is the first name lower-cased plus `123`. Documented in the app footer and
    // on the sign-in page — throwaway fixtures against a database wiped by `docker compose down -v`.
    const passwordHash = await bcrypt.hash(`${person.first.toLowerCase()}123`, SEED_BCRYPT_ROUNDS)
    const saved = await userRepo.save(
      userRepo.create({
        email: `${person.key}@contractor.test`,
        passwordHash,
        firstName: person.first,
        lastName: person.last,
        phone: person.phone,
        role: person.role,
        avatarUrl: null,
        deleted: false,
      }),
    )
    users.set(person.key, saved)
  }
  console.log(`seeded ${users.size} users`)

  const profileRepo = AppDataSource.getRepository(ContractorProfile)
  const imageRepo = AppDataSource.getRepository(PortfolioImage)
  const profiles = new Map<string, ContractorProfile>()

  for (const spec of PROFILES) {
    const saved = await profileRepo.save(
      profileRepo.create({
        user: users.get(spec.person)!,
        businessName: spec.businessName,
        bio: spec.bio,
        yearsInBusiness: spec.years,
        licenseNumber: spec.license,
        city: spec.city,
        state: spec.state,
        zip: spec.zip,
        serviceRadiusMiles: spec.radius,
        hourlyRateMin: spec.rateMin,
        hourlyRateMax: spec.rateMax,
        // ⚠️ Left at zero deliberately. These are recomputed from the review rows at the end of
        // this script by the same aggregate the app uses — writing a plausible-looking number here
        // would hide a bug in that recompute for as long as anyone only ever looked at seed data.
        ratingAverage: 0,
        reviewCount: 0,
        deleted: false,
        categories: spec.trades.map((slug) => categories.get(slug)!),
      }),
    )
    profiles.set(spec.key, saved)

    await imageRepo.save(
      spec.portfolio.map((caption, index) =>
        imageRepo.create({
          contractorId: saved.id,
          // ⚠️ A generated SVG placeholder rather than a hotlinked photo. It needs no network, it
          // cannot 404, and it is the same technique the frontend's `lib/placeholder.ts` uses.
          url: placeholderUrl(`${spec.key}-${index}`, caption),
          caption,
          sortOrder: index,
        }),
      ),
    )
  }
  console.log(`seeded ${profiles.size} contractor profiles`)

  /* ------------------------------------------------------------------------------------------ */
  /* Projects, quotes and reviews — one project in each interesting state                         */
  /* ------------------------------------------------------------------------------------------ */

  const projectRepo = AppDataSource.getRepository(Project)
  const quoteRepo = AppDataSource.getRepository(Quote)
  const reviewRepo = AppDataSource.getRepository(Review)

  const waterHeater = await projectRepo.save(
    projectRepo.create({
      homeownerId: users.get('maya')!.id,
      categoryId: categories.get('plumbing')!.id,
      title: 'Replace leaking 50-gallon water heater',
      description:
        'The water heater in the garage is weeping from the base and there is rust on the pan. It is the original unit from when the house was built in 2009, so I am assuming replacement rather than repair. Gas, 50 gallon, garage install with decent access.',
      city: 'Austin',
      state: 'TX',
      zip: '78704',
      budgetMin: 1800,
      budgetMax: 3500,
      preferredStartDate: futureDate(5),
      // Two pending quotes, so the homeowner dashboard has a decision waiting on it.
      status: ProjectStatus.QUOTED,
    }),
  )

  await quoteRepo.save([
    quoteRepo.create({
      projectId: waterHeater.id,
      contractorId: profiles.get('rivera')!.id,
      amount: 2450,
      estimatedDays: 1,
      message:
        'Price covers a 50-gallon gas unit, new expansion tank, drain pan and permit. Same-day if you can be home before noon — I keep two units on the truck.',
      status: QuoteStatus.PENDING,
    }),
    quoteRepo.create({
      projectId: waterHeater.id,
      contractorId: profiles.get('northgate')!.id,
      amount: 2890,
      estimatedDays: 2,
      message:
        'Recommending a tankless swap rather than like-for-like. Higher up front, but your gas line is already sized for it and you stop paying to keep 50 gallons hot overnight.',
      status: QuoteStatus.PENDING,
    }),
  ])

  const lighting = await projectRepo.save(
    projectRepo.create({
      homeownerId: users.get('maya')!.id,
      categoryId: categories.get('electrical')!.id,
      title: 'Install recessed lighting in living room',
      description:
        'Living room has one central fixture and is dark at the edges. Looking for six to eight recessed lights on a dimmer. Attic above is accessible. Would like the existing fixture removed and the box patched.',
      city: 'Austin',
      state: 'TX',
      zip: '78704',
      budgetMin: 1500,
      budgetMax: 2500,
      preferredStartDate: futureDate(3),
      // Hired and under way — exercises the contractor's "mark complete" button.
      status: ProjectStatus.IN_PROGRESS,
    }),
  )

  await quoteRepo.save([
    quoteRepo.create({
      projectId: lighting.id,
      contractorId: profiles.get('brightspark')!.id,
      amount: 1850,
      estimatedDays: 2,
      message:
        'Eight 6" LED cans on two dimmable circuits, plus patching and texture. Ceiling is 1970s blown-in insulation, so I have priced in the extra containment.',
      status: QuoteStatus.ACCEPTED,
    }),
    quoteRepo.create({
      projectId: lighting.id,
      contractorId: profiles.get('northgate')!.id,
      amount: 2100,
      estimatedDays: 3,
      message: 'Can do the cans and add a smart switch while the wall is open.',
      // ⚠️ Declined, not pending — accepting one quote declines the others, so a seeded project in
      // the hired state with a pending rival would be a state the app itself cannot produce.
      status: QuoteStatus.DECLINED,
    }),
  ])

  const trim = await projectRepo.save(
    projectRepo.create({
      homeownerId: users.get('maya')!.id,
      categoryId: categories.get('painting')!.id,
      title: 'Repaint exterior trim and soffits',
      description:
        'Cedar trim and soffits all round, single storey, roughly 1,900 sq ft footprint. The paint is failing on the south and west faces. Body of the house is brick and does not need anything.',
      city: 'Austin',
      state: 'TX',
      zip: '78704',
      budgetMin: 2500,
      budgetMax: 4000,
      preferredStartDate: pastDate(90),
      status: ProjectStatus.COMPLETED,
    }),
  )

  const trimQuote = await quoteRepo.save(
    quoteRepo.create({
      projectId: trim.id,
      contractorId: profiles.get('trueline')!.id,
      amount: 3200,
      estimatedDays: 4,
      message:
        'Scrape, spot-prime the bare cedar and two finish coats. The south face will need the most work — that is where the sun has taken the old coat off.',
      status: QuoteStatus.ACCEPTED,
    }),
  )

  const roof = await projectRepo.save(
    projectRepo.create({
      homeownerId: users.get('daniel')!.id,
      categoryId: categories.get('roofing')!.id,
      title: 'Roof inspection after hail storm',
      description:
        'We took golf-ball hail two weeks ago. No visible leak inside but the insurer wants an inspection report before they will open a claim. Two-storey, composition shingle, roughly 12 years old.',
      city: 'Round Rock',
      state: 'TX',
      zip: '78664',
      budgetMin: 200,
      budgetMax: 600,
      preferredStartDate: futureDate(4),
      status: ProjectStatus.QUOTED,
    }),
  )

  await quoteRepo.save(
    quoteRepo.create({
      projectId: roof.id,
      contractorId: profiles.get('summit')!.id,
      amount: 350,
      estimatedDays: 1,
      message:
        'Inspection fee is credited against any repair work you decide to go ahead with. You get photos of every slope and a written report either way.',
      status: QuoteStatus.PENDING,
    }),
  )

  console.log('seeded 4 projects and 6 quotes')

  await reviewRepo.save(
    reviewRepo.create({
      projectId: trim.id,
      projectTitle: trim.title,
      homeownerId: users.get('maya')!.id,
      contractorId: trimQuote.contractorId,
      rating: 5,
      comment:
        'Marco found rot in two soffit boards that I did not know about, showed me the photos, and replaced them for the cost of the lumber rather than repainting over it. Four days, cleaned up every evening.',
    }),
  )

  /**
   * ⚠️ Recomputed with the SAME aggregate `ReviewsService.recomputeRating` uses, rather than
   * hard-coded. If that query is ever wrong, the seed is wrong too and someone notices — which is
   * the entire value of not writing a plausible number here by hand.
   */
  await AppDataSource.query(`
    UPDATE "contractor_profiles" p SET
      "review_count"   = COALESCE(r.count, 0),
      "rating_average" = COALESCE(r.average, 0)
    FROM (
      SELECT "contractor_profile_id" AS id,
             COUNT(*)                AS count,
             ROUND(AVG("rating"), 2) AS average
      FROM "reviews" GROUP BY "contractor_profile_id"
    ) r
    WHERE p."id" = r.id
  `)
  console.log('seeded 1 review and recomputed ratings')

  /**
   * Backdate the rows so the demo reads like a real account rather than one created 30 seconds ago.
   *
   * ⚠️ Done in SQL rather than by assigning `createdAt` on the entities, because `@CreateDateColumn`
   * is populated by the DATABASE default (`now()`), and a value set on the object is overwritten on
   * insert. The symptom without this is every screenshot saying "posted 4 minutes ago" on a job
   * that was supposedly completed in June.
   */
  await AppDataSource.query(`
    UPDATE projects SET created_at = now() - INTERVAL '98 days' WHERE title LIKE 'Repaint exterior%';
  `)
  await AppDataSource.query(`
    UPDATE quotes SET created_at = now() - INTERVAL '96 days'
    WHERE project_id = (SELECT id FROM projects WHERE title LIKE 'Repaint exterior%');
  `)
  await AppDataSource.query(`
    UPDATE reviews SET created_at = now() - INTERVAL '84 days';
  `)
  await AppDataSource.query(`
    UPDATE projects SET created_at = now() - INTERVAL '25 days' WHERE title LIKE 'Install recessed%';
  `)
  await AppDataSource.query(`
    UPDATE quotes SET created_at = now() - INTERVAL '24 days'
    WHERE project_id = (SELECT id FROM projects WHERE title LIKE 'Install recessed%');
  `)
  await AppDataSource.query(`
    UPDATE projects SET created_at = now() - INTERVAL '8 days' WHERE title LIKE 'Replace leaking%';
  `)
  await AppDataSource.query(`
    UPDATE quotes SET created_at = now() - INTERVAL '6 days'
    WHERE project_id = (SELECT id FROM projects WHERE title LIKE 'Replace leaking%');
  `)
  await AppDataSource.query(`
    UPDATE projects SET created_at = now() - INTERVAL '3 days' WHERE title LIKE 'Roof inspection%';
  `)
  await AppDataSource.query(`
    UPDATE quotes SET created_at = now() - INTERVAL '2 days'
    WHERE project_id = (SELECT id FROM projects WHERE title LIKE 'Roof inspection%');
  `)
  console.log('backdated the historical rows')

  await AppDataSource.destroy()
  console.log('\ndone. sign in with maya@contractor.test / maya123 or luis@contractor.test / luis123')
}

/** `YYYY-MM-DD`, n days from now, built from LOCAL parts — `toISOString().slice(0,10)` returns the
 *  UTC day and is a day out all evening for anyone west of Greenwich. */
function futureDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function pastDate(days: number): string {
  return futureDate(-days)
}

/** The same generated-SVG trick as the frontend's `lib/placeholder.ts`, kept deliberately simple
 *  here — the seed only needs a stable, offline image, not a palette. */
function placeholderUrl(seed: string, label: string): string {
  const hues = ['#0f766e', '#475569', '#b45309', '#1d4ed8', '#4d7c0f', '#9f1239']
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const colour = hues[hash % hues.length]
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="${colour}"/><text x="300" y="212" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="600" fill="rgba(255,255,255,0.92)">${escaped}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

seed().catch((error: unknown) => {
  console.error('\nseed failed:', error)
  // ⚠️ A non-zero exit. Without it a failed seed still "succeeds" as far as a shell script or CI
  // step is concerned, and the next command runs against a half-populated database.
  process.exit(1)
})
