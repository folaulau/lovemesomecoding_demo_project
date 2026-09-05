/**
 * The Hasura metadata: which tables exist, how they relate, and who may read what.
 *
 * This is the whole read side of the app. NestJS owns every write; Hasura owns every read, and the
 * permissions below are what make that safe. Written as JavaScript rather than the YAML the Hasura
 * CLI produces, for one reason: the interesting part of a permission is WHY a filter is shaped the
 * way it is, and YAML has nowhere to put that.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ NO ROLE HAS AN INSERT, UPDATE OR DELETE PERMISSION. ANYWHERE. THAT IS THE DESIGN.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Hasura can generate mutations for every table, and it is genuinely tempting — one line of
 * metadata and the frontend can insert a quote with no backend code at all. It also means:
 *
 *   • accepting a quote no longer declines the others, because that is three writes in a
 *     transaction and a generated mutation is one write;
 *   • a contractor can quote on a trade they do not work in, because "may I see this project"
 *     and "may I bid on it" are different questions and a select permission only answers the first;
 *   • a homeowner can review a job that was never completed;
 *   • a contractor can set their own rating.
 *
 * Every one of those rules lives in a NestJS service. Adding a single insert permission here opens
 * a second path to the same tables that does not go past any of them.
 *
 * Four roles:
 *   anonymous   — not signed in. Browses the public directory and nothing else.
 *   homeowner   — their own projects, and the quotes on them.
 *   contractor  — leads in their trades, and THEIR OWN quotes. Never a competitor's.
 *   staff       — everything, for support.
 *
 * ⚠️ The staff role is called `staff` and NOT `admin`. `admin` is Hasura's own built-in superuser
 * role: it bypasses every permission in this file, and Hasura refuses to let you define
 * permissions for it ("cannot define permission for admin role"). A JWT claiming it would get
 * unrestricted read AND WRITE access to every table — which is exactly the door this file exists
 * to keep shut. See `common/enums.ts` in the backend.
 */

const PUBLIC = ['anonymous', 'homeowner', 'contractor', 'staff']

/** The session variables the JWT carries. See `auth/jwt-payload.ts` — both are strings. */
const USER_ID = 'X-Hasura-User-Id'
const CONTRACTOR_ID = 'X-Hasura-Contractor-Id'

/** Builds the same select permission for several roles at once. */
function selectFor(roles, permission) {
  return roles.map((role) => ({ role, permission }))
}

/**
 * ⚠️ Column allowlists, never `columns: '*'`.
 *
 * A wildcard means "every column this table has NOW and every column anyone adds later". The day
 * somebody adds `internal_notes` to `projects`, a wildcard hands it to every homeowner on the site
 * and nothing in the diff looks like a permission change. Listing columns makes exposing a new one
 * a deliberate act.
 */
const USER_PUBLIC_COLUMNS = ['public_id', 'first_name', 'last_name', 'avatar_url', 'role', 'created_at']

const CONTRACTOR_COLUMNS = [
  'public_id',
  'user_id',
  'business_name',
  'bio',
  'years_in_business',
  'license_number',
  'city',
  'state',
  'zip',
  'service_radius_miles',
  'hourly_rate_min',
  'hourly_rate_max',
  'rating_average',
  'review_count',
  'created_at',
]

const PROJECT_COLUMNS = [
  'public_id',
  'homeowner_id',
  'service_category_id',
  'title',
  'description',
  'city',
  'state',
  'zip',
  'budget_min',
  'budget_max',
  'preferred_start_date',
  'status',
  'created_at',
]

const QUOTE_COLUMNS = [
  'public_id',
  'project_id',
  'contractor_profile_id',
  'amount',
  'estimated_days',
  'message',
  'status',
  'created_at',
]

const REVIEW_COLUMNS = [
  'public_id',
  'project_id',
  // ⚠️ Denormalised onto the review row on purpose. `projects` is NOT readable by `anonymous`,
  // and Hasura hides a relationship field pointing at a table the role cannot select — so
  // `review.project.title` on a public profile fails with "field 'project' not found in type:
  // 'reviews'". See the AddProjectTitleToReviews migration.
  'project_title',
  'homeowner_id',
  'contractor_profile_id',
  'rating',
  'comment',
  'created_at',
]

/**
 * "A project in a trade this contractor works in."
 *
 * Reads across the join table: project → its category → the rows linking that category to a
 * profile → is one of them mine. This is rule 1 expressed as a permission, and it is the same rule
 * `QuotesService` checks before accepting a bid. Both are needed: this one stops the pro from
 * SEEING the job, the service one stops them from quoting on an id they got some other way.
 */
const IN_MY_TRADES = {
  category: { contractor_services: { contractor_profile_id: { _eq: CONTRACTOR_ID } } },
}

export const metadata = {
  version: 3,
  sources: [
    {
      name: 'default',
      kind: 'postgres',
      configuration: {
        connection_info: {
          /**
           * ⚠️ `from_env`, not a literal connection string. `replace_metadata` overwrites the
           * whole source definition, so a literal here would bake the password into a committed
           * file AND into Hasura's own metadata database. This just points at the variable
           * docker-compose.yml already sets.
           */
          database_url: { from_env: 'HASURA_GRAPHQL_DATABASE_URL' },
          isolation_level: 'read-committed',
          use_prepared_statements: true,
        },
      },

      tables: [
        /* ------------------------------------------------------------------------------------ */
        /* users — deliberately the most restricted table here                                    */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'users' },
          object_relationships: [
            {
              name: 'contractor_profile',
              using: { manual_configuration: {
                remote_table: { schema: 'public', name: 'contractor_profiles' },
                column_mapping: { id: 'user_id' },
              } },
            },
          ],
          array_relationships: [
            {
              name: 'projects',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'projects' },
                column: 'homeowner_id',
              } },
            },
          ],
          /**
           * ⚠️ `email`, `phone` and above all `password_hash` are absent from this list, for every
           * role including admin. A homeowner's own email reaches them through `/auth/login`, not
           * through GraphQL — so there is no query anywhere in this app that can return one, and
           * therefore no permission to get subtly wrong later.
           */
          select_permissions: selectFor(PUBLIC, {
            columns: USER_PUBLIC_COLUMNS,
            // Soft-deleted accounts vanish from every read. The rows stay, because reviews and
            // quotes reference them forever.
            filter: { deleted: { _eq: false } },
          }),
        },

        /* ------------------------------------------------------------------------------------ */
        /* service_categories — fully public, read by the home page before anyone signs in        */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'service_categories' },
          array_relationships: [
            {
              name: 'contractor_services',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'contractor_services' },
                column: 'service_category_id',
              } },
            },
            {
              name: 'projects',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'projects' },
                column: 'service_category_id',
              } },
            },
          ],
          select_permissions: selectFor(PUBLIC, {
            columns: ['public_id', 'slug', 'name', 'description', 'icon'],
            filter: {},
            allow_aggregations: true,
          }),
        },

        /* ------------------------------------------------------------------------------------ */
        /* contractor_profiles — the public directory                                             */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'contractor_profiles' },
          object_relationships: [
            { name: 'user', using: { foreign_key_constraint_on: 'user_id' } },
          ],
          array_relationships: [
            {
              name: 'contractor_services',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'contractor_services' },
                column: 'contractor_profile_id',
              } },
            },
            {
              name: 'portfolio_images',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'portfolio_images' },
                column: 'contractor_profile_id',
              } },
            },
            {
              name: 'reviews',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'reviews' },
                column: 'contractor_profile_id',
              } },
            },
            {
              name: 'quotes',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'quotes' },
                column: 'contractor_profile_id',
              } },
            },
          ],
          select_permissions: selectFor(PUBLIC, {
            columns: CONTRACTOR_COLUMNS,
            filter: { deleted: { _eq: false } },
            // The directory sorts by rating and shows counts, both of which are aggregates.
            allow_aggregations: true,
          }),
        },

        /* ------------------------------------------------------------------------------------ */
        /* contractor_services — the join table                                                   */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'contractor_services' },
          object_relationships: [
            { name: 'contractor_profile', using: { foreign_key_constraint_on: 'contractor_profile_id' } },
            { name: 'category', using: { foreign_key_constraint_on: 'service_category_id' } },
          ],
          /**
           * ⚠️ Readable by everyone, and it has to be — the `IN_MY_TRADES` filter on `projects`
           * traverses this table. Hasura evaluates a permission's relationship hops against the
           * TABLE's permissions too, so a locked-down join table makes the filter that depends on
           * it match nothing, silently. It holds two foreign keys and no secrets.
           */
          select_permissions: selectFor(PUBLIC, {
            columns: ['contractor_profile_id', 'service_category_id'],
            filter: {},
          }),
        },

        /* ------------------------------------------------------------------------------------ */
        /* portfolio_images — public, they are the point of the profile page                      */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'portfolio_images' },
          object_relationships: [
            { name: 'contractor_profile', using: { foreign_key_constraint_on: 'contractor_profile_id' } },
          ],
          select_permissions: selectFor(PUBLIC, {
            columns: ['public_id', 'contractor_profile_id', 'url', 'caption', 'sort_order', 'created_at'],
            filter: {},
          }),
        },

        /* ------------------------------------------------------------------------------------ */
        /* projects — where the roles genuinely diverge                                           */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'projects' },
          object_relationships: [
            { name: 'homeowner', using: { foreign_key_constraint_on: 'homeowner_id' } },
            { name: 'category', using: { foreign_key_constraint_on: 'service_category_id' } },
            {
              name: 'review',
              using: { manual_configuration: {
                remote_table: { schema: 'public', name: 'reviews' },
                column_mapping: { id: 'project_id' },
              } },
            },
          ],
          array_relationships: [
            {
              name: 'quotes',
              using: { foreign_key_constraint_on: {
                table: { schema: 'public', name: 'quotes' },
                column: 'project_id',
              } },
            },
          ],
          select_permissions: [
            /**
             * ⚠️ `anonymous` has NO entry here, and an absent permission is a deny. Someone's
             * home address, budget and schedule are not public, and this is the table where
             * forgetting that would matter most.
             */
            {
              role: 'homeowner',
              permission: {
                columns: PROJECT_COLUMNS,
                // Their own, and only their own. `X-Hasura-User-Id` comes from a signature Hasura
                // verified — it cannot be set by the caller.
                filter: { homeowner_id: { _eq: USER_ID } },
                allow_aggregations: true,
              },
            },
            {
              role: 'contractor',
              permission: {
                columns: PROJECT_COLUMNS,
                /**
                 * Two ways a pro may see a project, and both are needed:
                 *
                 *  1. it is OPEN and in one of their trades — the lead feed;
                 *  2. they have already quoted on it — "My quotes", which must keep working after
                 *     the project is hired, in progress or completed, at which point rule 1 no
                 *     longer matches it.
                 *
                 * Without the second clause a contractor loses sight of a job the moment they win
                 * it, which is precisely when they need it.
                 */
                filter: {
                  _or: [
                    { _and: [{ status: { _in: ['open', 'quoted'] } }, IN_MY_TRADES] },
                    { quotes: { contractor_profile_id: { _eq: CONTRACTOR_ID } } },
                  ],
                },
                allow_aggregations: true,
              },
            },
            {
              role: 'staff',
              permission: { columns: PROJECT_COLUMNS, filter: {}, allow_aggregations: true },
            },
          ],
        },

        /* ------------------------------------------------------------------------------------ */
        /* quotes — the table where a wrong filter would break the marketplace                    */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'quotes' },
          object_relationships: [
            { name: 'project', using: { foreign_key_constraint_on: 'project_id' } },
            { name: 'contractor_profile', using: { foreign_key_constraint_on: 'contractor_profile_id' } },
          ],
          select_permissions: [
            {
              role: 'homeowner',
              permission: {
                columns: QUOTE_COLUMNS,
                // Every quote on a project they own — that is the comparison screen.
                filter: { project: { homeowner_id: { _eq: USER_ID } } },
                allow_aggregations: true,
              },
            },
            {
              role: 'contractor',
              permission: {
                columns: QUOTE_COLUMNS,
                /**
                 * ⚠️ THEIR OWN QUOTES ONLY. Never a competitor's.
                 *
                 * The obvious-looking alternative — "quotes on projects I can see" — reads
                 * naturally and destroys the product: the last pro to bid could read every rival
                 * price and undercut by a dollar, and after that nobody quotes honestly. This is
                 * the single most consequential line in this file.
                 */
                filter: { contractor_profile_id: { _eq: CONTRACTOR_ID } },
                allow_aggregations: true,
              },
            },
            {
              role: 'staff',
              permission: { columns: QUOTE_COLUMNS, filter: {}, allow_aggregations: true },
            },
          ],
        },

        /* ------------------------------------------------------------------------------------ */
        /* reviews — public, because they are the reason the directory is worth reading           */
        /* ------------------------------------------------------------------------------------ */
        {
          table: { schema: 'public', name: 'reviews' },
          object_relationships: [
            { name: 'project', using: { foreign_key_constraint_on: 'project_id' } },
            { name: 'homeowner', using: { foreign_key_constraint_on: 'homeowner_id' } },
            { name: 'contractor_profile', using: { foreign_key_constraint_on: 'contractor_profile_id' } },
          ],
          select_permissions: selectFor(PUBLIC, {
            columns: REVIEW_COLUMNS,
            filter: {},
            allow_aggregations: true,
          }),
        },
      ],
    },
  ],
}
