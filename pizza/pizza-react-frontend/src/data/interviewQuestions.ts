/**
 * Senior-level interview questions, every one of them drawn from a real decision or a real bug in
 * this codebase.
 *
 * That constraint is the point. Question banks are usually assembled from blog posts, so they
 * reward recall. These reward having actually shipped something: each answer names the trade-off
 * that was made here, and several of them describe a bug that reached a running app before anyone
 * noticed. `progress_report.md` in the project root is the primary source for all of it.
 */

export type QuestionCategory =
  | 'JPA & Hibernate'
  | 'SQL & data modelling'
  | 'API & security'
  | 'React'
  | 'State management'
  | 'Testing';

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  /** Paragraphs. Kept as plain text so the page stays dependency-free — no markdown renderer. */
  answer: string[];
  code?: { caption: string; language: string; source: string };
  /** What separates a good answer from a senior one. */
  seniorSignal: string;
}

export const CATEGORIES: QuestionCategory[] = [
  'JPA & Hibernate',
  'SQL & data modelling',
  'API & security',
  'React',
  'State management',
  'Testing',
];

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ------------------------------------------------------------ JPA & Hibernate
  {
    id: 'multiple-bag-fetch',
    category: 'JPA & Hibernate',
    question:
      'An entity graph that fetches two List collections at once throws MultipleBagFetchException. Why, and what are your options?',
    answer: [
      'Hibernate calls an unordered List a "bag". Join-fetching two collections in one query produces a cartesian product — every order item multiplied by every topping — and for a Set it can de-duplicate that back to the truth, because a Set has no positional identity to preserve. A bag must keep duplicates, so Hibernate cannot tell a genuine duplicate from a join artefact. Rather than silently return wrong counts it refuses to build the query.',
      'Three ways out, and they are not equivalent. Switch one side to a Set: cheapest, but it changes ordering semantics and equals/hashCode behaviour. Fetch one collection in the graph and initialise the second separately with @BatchSize: keeps List semantics, costs roughly one extra query rather than one per row. Or split into two queries and stitch in memory, which is the most control and the most code.',
      'This app takes the second route: the graph fetches items, OrderItem.toppings carries @BatchSize(25), and the DAO touches the collection inside the transaction so callers can safely map after it closes.',
    ],
    code: {
      caption: 'The version that throws, and the version that ships',
      language: 'java',
      source: `// Throws at query time — two bags in one fetch
@EntityGraph(attributePaths = {"items", "items.toppings"})
Optional<CustomerOrder> findWithItemsByPublicId(UUID publicId);

// Works: one collection in the graph, the other batched
@EntityGraph(attributePaths = "items")
Optional<CustomerOrder> findWithItemsByPublicId(UUID publicId);

// ...then, still inside the transaction:
order.ifPresent(o -> o.getItems().forEach(item -> item.getToppings().size()));`,
    },
    seniorSignal:
      'Naming the cartesian product as the real cause, rather than reciting "use a Set" — and knowing that the Set fix silently changes ordering and equality semantics.',
  },
  {
    id: 'sqlrestriction-native',
    category: 'JPA & Hibernate',
    question:
      'Your entities carry @SQLRestriction("deleted = false"). Does a native SQL query honour it? What class of bug does the answer create?',
    answer: [
      'No. @SQLRestriction is applied by Hibernate when it builds a query from the entity model. Native SQL never goes near the entity model, so the predicate is simply absent.',
      'The bug this creates is dangerous because it is quiet. In this app the reporting queries were native SQL and did not filter deleted rows, so every soft-deleted order still counted toward revenue. Nothing crashed and no test failed — the dashboard showed plausible, internally consistent, wrong numbers. It was found by soft-deleting a $28.91 order and observing that reported revenue did not move.',
      'The fix is to spell out deleted = 0 in every hand-written query and to guard it with a test that deletes a row and asserts the total drops. The general lesson is that a framework-level invariant stops being an invariant the moment you step outside the framework.',
    ],
    code: {
      caption: 'The regression test that makes the invariant real',
      language: 'java',
      source: `@Test
void softDeletedOrdersAreExcluded() {
    var before = reportService.getDashboard(30).summary();

    victim.setDeleted(true);
    orderRepository.saveAndFlush(victim);

    var after = reportService.getDashboard(30).summary();
    assertThat(after.totalRevenue())
        .isEqualByComparingTo(before.totalRevenue().subtract(victim.getTotal()));
}`,
    },
    seniorSignal:
      'Recognising that the failure mode is "plausible but wrong" rather than an exception — and proposing a test that would actually catch it.',
  },
  {
    id: 'insert-before-delete',
    category: 'JPA & Hibernate',
    question:
      'Updating a product by clearing its sizes and re-adding them fails with a unique-constraint violation. Explain the flush ordering, and give the better fix.',
    answer: [
      'Hibernate does not execute statements in the order you wrote them. At flush it groups by operation type and runs inserts before deletes. So clear() plus re-add sends the new rows first, and they collide with the old ones that have not been removed yet — Duplicate entry \'42-SMALL\' for key \'uk_product_size\'.',
      'A flush between the two halves fixes the ordering and is the answer most candidates give. It is not the best one here, because the size rows carry their own public UUID. Deleting and recreating mints new identifiers, so editing a price would silently invalidate ids already handed out to clients.',
      'Reconciling in place is better on both counts: update the rows that persist, insert only what is genuinely new, remove only what is genuinely gone. One fewer round trip and stable identity.',
    ],
    code: {
      caption: 'Reconcile rather than replace',
      language: 'java',
      source: `for (SizeDTO requested : validated(dto)) {
    product.getSizes().stream()
        .filter(existing -> existing.getSize() == requested.size())
        .findFirst()
        .ifPresentOrElse(
            existing -> existing.setPrice(requested.price()),
            () -> product.addSize(ProductSize.builder()
                    .size(requested.size()).price(requested.price()).build()));
}
List<SizeName> keep = requested.stream().map(SizeDTO::size).toList();
product.getSizes().removeIf(existing -> !keep.contains(existing.getSize()));`,
    },
    seniorSignal:
      'Getting past "add a flush" to the identity argument — that recreating rows breaks any id you have already published.',
  },
  {
    id: 'timezone-localdatetime',
    category: 'JPA & Hibernate',
    question:
      'Rows written as 2026-01-01 00:00 read back as 2025-12-31 17:00. Walk through the diagnosis.',
    answer: [
      'Seven hours is a timezone offset, so the value is being converted somewhere between the column and the object. The culprit was serverTimezone=UTC on the JDBC URL together with hibernate.jdbc.time_zone=UTC: the driver treats the stored DATETIME as UTC and re-expresses it in the JVM zone.',
      'What makes it corruption rather than presentation is the Java type. Every timestamp column maps to LocalDateTime, which carries no zone at all. There is no offset recorded anywhere, so a conversion cannot be undone — the shifted value simply becomes the value.',
      'The fix was connectionTimeZone=LOCAL&preserveInstants=false and removing the Hibernate property, guarded by a test asserting a seeded literal reads back byte-for-byte. The deeper rule: if you genuinely need zone-aware storage, use Instant or OffsetDateTime and store the offset. Do not put a zoneless type in a pipeline that converts zones.',
    ],
    seniorSignal:
      'Identifying that the choice of LocalDateTime is what turns a conversion into data loss, not just the driver setting.',
  },
  {
    id: 'surrogate-plus-public-id',
    category: 'SQL & data modelling',
    question:
      'Why keep a BIGINT primary key and add a separate UUID public_id, rather than making the UUID the primary key?',
    answer: [
      'Two different jobs. The primary key is an internal, physical concern: it is what every foreign key stores and what the clustered index orders. The public identifier is an API concern: it must be unguessable so nobody can walk /api/orders/1, /2, /3 and read other people\'s receipts.',
      'A random UUID primary key does that job badly on InnoDB. The table is clustered on the key, so random inserts scatter across the B-tree instead of appending, causing page splits and fragmentation, and every secondary index carries the full 16 bytes. A BIGINT stays sequential and narrow.',
      'So: BIGINT for storage and joins, indexed UUID for the outside world, and nothing above the DAO layer ever sees the numeric id. As a bonus, seeded demo rows here get deterministic UUIDs so fixtures and tests can hard-code them.',
    ],
    seniorSignal:
      'Explaining the clustered-index cost concretely, and framing it as two identifiers with two different jobs rather than one being "better".',
  },
  {
    id: 'n-plus-one-admin-list',
    category: 'SQL & data modelling',
    question:
      'An admin list ran 1 + 3N queries. Two of the three per-row queries loaded full entity lists only to call .size(). How do you fix it, and why not a LEFT JOIN with GROUP BY?',
    answer: [
      'Push the counting into the database and return a read model rather than entities. One query with correlated scalar subqueries answers the whole page in a single round trip, and the counts are never materialised as objects nobody reads a field of.',
      'The obvious alternative — LEFT JOIN across orders, addresses and payment methods with a GROUP BY — is wrong here, and wrong in a way that looks right. Joining three one-to-many tables multiplies their rows together. A user with 2 addresses and 3 cards produces 6 combined rows, so COUNT reports 6 of each. You can paper over it with COUNT(DISTINCT ...), but you are still paying for the fan-out.',
      'Worth saying out loud: counts do not belong on the User entity. Loading a user to check their email should not run three aggregates. This is a separate read model, and that is a feature.',
    ],
    code: {
      caption: 'Scalar subqueries — no fan-out to correct for',
      language: 'sql',
      source: `SELECT u.public_id, u.email, u.role, u.created_at,
       (SELECT COUNT(*) FROM customer_order o
         WHERE o.user_id = u.id AND o.deleted = 0) AS order_count,
       (SELECT COUNT(*) FROM user_address a
         WHERE a.user_id = u.id AND a.deleted = 0) AS address_count
FROM app_user u
WHERE u.deleted = 0
ORDER BY u.created_at DESC`,
    },
    seniorSignal:
      'Spotting the join fan-out unprompted. Most candidates reach for LEFT JOIN + GROUP BY and never notice the counts are multiplied.',
  },
  {
    id: 'snapshot-vs-join',
    category: 'SQL & data modelling',
    question:
      'Order lines store product_name and unit_price as columns instead of joining to product. Is that denormalisation a mistake?',
    answer: [
      'No — it is the difference between a reference and a record. An order is a historical fact about what someone was charged. If the line joined to the live product, editing tomorrow\'s menu price would silently rewrite last month\'s receipts, and deleting a product would erase it from history entirely.',
      'So order lines snapshot the name and the price at the moment of purchase. The FK stays for analytics, but nothing user-facing depends on it resolving. The reports group by the snapshotted product_name for exactly the same reason: a product retired from the menu must still appear in the sales it generated, and by then its FK may be null.',
      'The test for whether snapshotting is right: ask whether the value is describing something as it is now, or as it was then. "Now" joins. "Then" snapshots.',
    ],
    seniorSignal:
      'Framing it as record-versus-reference rather than as a normalisation trade-off, and applying the same test to the reporting query.',
  },
  {
    id: 'server-side-pricing',
    category: 'API & security',
    question:
      'A client POSTs an order claiming total: 0.01. What stops it, and where exactly is the boundary?',
    answer: [
      'The request record has no price fields at all, so Jackson discards them before any code runs. The server then prices the whole order from the database — product_size, crust, topping — and that computed figure is what reaches Stripe. Verified live: a request claiming one cent was charged $18.43.',
      'The important part is architectural. Validating a client-supplied price is a losing game, because it means the number exists in the system and something must be trusted to check it. Not accepting the field is categorically stronger: there is nothing to validate, and no future code path can accidentally trust it.',
      'That makes PricingService the security boundary, and it is worth saying so in a comment, because the next developer will otherwise "helpfully" add a price field to the DTO.',
    ],
    seniorSignal:
      'The distinction between rejecting bad input and never accepting the field — designing so the vulnerability cannot be reintroduced.',
  },
  {
    id: '404-vs-403',
    category: 'API & security',
    question:
      'Requesting another user\'s saved address returns 404, not 403. Is that a bug?',
    answer: [
      'It is deliberate. A 403 says "this exists, you may not have it", which confirms the identifier is real. Iterate a bit and you have enumerated how many addresses or orders exist and which ids are live, without ever reading one.',
      '404 leaks nothing: indistinguishable from an id that never existed. The same reasoning drives the deliberately vague login failure — "invalid email or password" for both an unknown account and a wrong password, so the endpoint cannot be used to discover who has an account.',
      'The structural companion is that /api/me/** takes no user id in the path at all. The owner is resolved from the verified token, which removes the entire class of "read someone else\'s data" bug by construction rather than by remembering to check ownership on every handler.',
    ],
    seniorSignal:
      'Generalising to the pattern — that resolving identity from the token instead of the path eliminates the bug rather than guarding against it.',
  },
  {
    id: 'webhook-idempotency',
    category: 'API & security',
    question: 'What are the two non-negotiables for a payment webhook?',
    answer: [
      'Verify the signature, and be idempotent.',
      'Without signature verification the endpoint is an open "mark my order paid" API — anyone who learns the URL can POST a success. The Stripe-Signature header is checked against the signing secret before the body is trusted for anything.',
      'Idempotency matters because delivery is at-least-once by design. Stripe retries on non-2xx and can deliver duplicates anyway, so markPaid must be safe to run repeatedly: check the current status, do nothing if it is already paid. If the handler appended a payment row or incremented a total instead, retries would corrupt the books.',
      'A third practical point specific to local development: webhooks do not reach localhost without stripe listen, so the confirmation page also polls the payment status. That is an honest limitation worth explaining rather than hiding — and note the client never tells the server an order is paid; the server asks Stripe.',
    ],
    seniorSignal:
      'Treating at-least-once delivery as the normal case rather than an edge case, and never trusting the client\'s claim of payment.',
  },
  {
    id: 'card-data',
    category: 'API & security',
    question:
      'The app offers saved cards. What exactly is in your database, and what must never be?',
    answer: [
      'Stored: Stripe\'s opaque pm_... token, plus brand, last4 and expiry as display metadata so a customer can recognise "Visa ending 4242". Never stored: the card number, the CVC, or the cardholder name. Holding a PAN drags the application into PCI-DSS scope for no product benefit.',
      'Cards are collected by Stripe Elements against a SetupIntent — store without charging — so the details never touch our backend at all. The token is useless to anyone without our secret key.',
      'Two details people miss. Deleting a saved card must also detach it at Stripe, or the row disappears while the card stays chargeable. And not every payment method is a card: Link, Cash App Pay and Klarna have no card object on either the PaymentMethod or the Charge, so code that assumes one silently records nothing. Fall back to the method type and show "Link" rather than inventing a last4.',
    ],
    seniorSignal:
      'The wallet case. Almost everyone assumes payment_method.card is always populated, and the failure is silent.',
  },
  {
    id: 'privilege-lockout',
    category: 'API & security',
    question:
      'An admin console lets you change roles and delete accounts. What is the failure mode nobody thinks about?',
    answer: [
      'Locking yourself out. With a single administrator — the normal case for a small system — demoting or deleting your own account removes the last admin, and there is no route back in through the UI. Recovery means a support ticket and a SQL console.',
      'So both operations refuse when the target is the acting admin. Enforced on the server, because that is the real boundary; the UI additionally disables the controls on your own row so the refusal is visible before you click rather than after.',
      'The generalisation is that destructive administrative actions need a guard against removing the last capable actor. The same shape appears in "delete the last owner of an organisation" and "revoke the last API key".',
    ],
    seniorSignal:
      'Generalising to "never remove the last capable actor", and enforcing server-side with the UI as usability rather than security.',
  },

  // --------------------------------------------------------------------- React
  {
    id: 'memo-referential-identity',
    category: 'React',
    question:
      'A developer wraps a list item in React.memo and sees no improvement. Why, and when does memo actually pay?',
    answer: [
      'Almost always because a prop is a fresh reference on every render. memo does a shallow comparison, so an inline arrow function or an object literal in JSX is a new value each time and the comparison fails before it starts. The parent must stabilise those with useCallback and useMemo, or memo is pure overhead — an extra comparison that never succeeds.',
      'That is the trap: memo, useCallback and useMemo are a package. Applying one without the others is a common way to make code slower and harder to read at the same time.',
      'And it only pays when re-rendering is genuinely expensive — a long list, a chart, a heavy subtree. For a component rendering a few DOM nodes, React\'s own reconciliation is cheaper than the memo bookkeeping. Measure before reaching for it; the default answer to "should I memoise this" is no.',
    ],
    seniorSignal:
      'Saying "no" is the default, and treating memo/useCallback/useMemo as one decision rather than three independent optimisations.',
  },
  {
    id: 'two-step-checkout',
    category: 'React',
    question:
      'Checkout creates the order before the card form renders. Why can it not be one step?',
    answer: [
      'Stripe Elements confirms a PaymentIntent, and that intent does not exist until the server has priced the order. So the sequence is forced: collect details, POST the order, receive a clientSecret, then mount Elements against it and confirm.',
      'This has a useful side effect. The moment the order exists, the summary switches from the browser\'s arithmetic to the server\'s figures. The client-side total was only ever a preview; once there is an authoritative number, that is what the customer sees on the Pay button.',
      'The cost is an order row in PENDING_PAYMENT for every abandoned checkout. That is a real operational consequence — those rows accumulate and pollute reporting unless the status filter excludes them, which is why revenue counts only PAID, PREPARING and COMPLETED.',
    ],
    seniorSignal:
      'Volunteering the abandoned-order consequence and how reporting has to account for it.',
  },
  {
    id: 'code-splitting-verification',
    category: 'React',
    question:
      'You lazy-load the admin bundle so customers do not download it. How do you verify that actually happened?',
    answer: [
      'Read the build output — do not assume. lazy() plus a dynamic import is necessary but not sufficient: one stray static import from a shared module pulls the whole thing back into the entry chunk, and nothing warns you.',
      'In this app the admin section carries Recharts and the entire Redux store. Checking meant confirming a separate store-*.js chunk exists, then grepping the entry chunk for references to it. There was exactly one — inside the lazy route\'s preload manifest, which is a string in a dynamic import, not a static dependency. That distinction is the whole answer.',
      'The same discipline applies to the Provider placement question: putting <Provider> in main.tsx would have dragged Redux into the entry bundle for every visitor, and the only way to notice is to look at the chunks.',
    ],
    seniorSignal:
      'Distinguishing a preload-manifest reference from a static import, and treating bundle composition as something to verify rather than infer.',
  },

  // ----------------------------------------------------------- State management
  {
    id: 'context-vs-redux',
    category: 'State management',
    question:
      'This app uses Context for customer pages and Redux for admin. Defend the split — or argue it is arbitrary.',
    answer: [
      'The customer side has four small, mostly-read, independent concerns: auth, menu, cart, toasts. Context plus useReducer covers that without ceremony. Reaching for Redux there would be boilerplate in search of a problem.',
      'The admin side is a different shape. Several screens share a growing amount of server state, updates are genuinely asynchronous, and state needs to outlive the component — switching to Products and back should not throw away a fetched report and show a spinner again. Redux Toolkit gives caching across unmounts, a uniform loading/error triple from createAsyncThunk, and an action log that makes "why does this report disagree with the orders table" a tractable question.',
      'The honest counter-argument: a server-cache library like React Query fits admin CRUD better than Redux does, because almost all of this state is server state rather than client state. Redux is the right answer here partly because the split is itself the teaching material.',
    ],
    seniorSignal:
      'Volunteering the React Query counter-argument. A candidate who cannot argue against their own architecture has not really chosen it.',
  },
  {
    id: 'dispatch-resolves',
    category: 'State management',
    question:
      'A try/catch around dispatch(someThunk()) never enters the catch, and every failure is reported to the user as a success. Explain.',
    answer: [
      'dispatch of a createAsyncThunk resolves rather than rejects. It hands back the resulting action object — fulfilled or rejected, both are just actions. From the caller\'s point of view nothing was thrown, so the catch block is unreachable and execution continues straight into the success path.',
      'The fix is .unwrap(), which re-throws the rejection so ordinary try/catch works again. It is easy to omit and produces the worst possible failure mode: the user is told their change was saved when it was not.',
      'A second, subtler trap: an ApiError does not survive the trip. Redux Toolkit runs thrown errors through miniSerializeError, keeping name, message and stack and discarding everything else — including the structured body that puts a validation message under the right input. Flatten the error into a plain serialisable object at the edge and pass it to rejectWithValue, which also keeps the store free of class instances.',
    ],
    code: {
      caption: 'Without unwrap this catch is dead code',
      language: 'ts',
      source: `try {
  await dispatch(saveProduct({ id, body: form })).unwrap();
  showToast(\`\${form.name} saved\`);
} catch (err) {
  // The ApiError was flattened into { message, fieldErrors } before it
  // ever reached an action, so the field errors are still here.
  setFieldErrors((err as ApiFailure)?.fieldErrors ?? {});
  setFormError(failureMessage(err, 'Could not save.'));
}`,
    },
    seniorSignal:
      'Knowing miniSerializeError exists and why it matters — that "make actions serialisable" has a concrete cost you must design around.',
  },
  {
    id: 'shared-error-state',
    category: 'State management',
    question:
      'One shared error string per slice sounds tidy. Where does it break down?',
    answer: [
      'When one failure has more than one right place to be shown. In this app the catalog slice set its shared error on every rejected thunk, including a form validation failure. The result was the same "a product named X already exists" rendered twice: under the form field where it belonged, and in a page-level banner behind the modal where it did not.',
      'A test caught it, but only incidentally — it asserted the message was visible and failed on a strict-mode violation because the locator resolved to two elements. It is exactly the kind of duplication a human reviewer skims past.',
      'The fix was to narrow what the shared error means: only a failed fetch becomes page-level state. Save and delete failures are reported where they happened, through unwrap, by the component that initiated them. The general principle is that shared state should represent something genuinely shared — "this screen could not load" is; "this form field is invalid" is not.',
    ],
    seniorSignal:
      'Articulating the principle — that state belongs in a shared store only if its meaning is genuinely shared, not merely because it is convenient.',
  },

  // -------------------------------------------------------------------- Testing
  {
    id: 'test-passing-wrong-reason',
    category: 'Testing',
    question:
      'A UI test has passed for months. It turns out it was never exercising the feature. How does that happen, and what do you change?',
    answer: [
      'Here, getByRole(\'link\', { name: \'Pizzas\' }) had been clicking the navbar rather than the menu tab it was written for — react-bootstrap renders Nav.Link as an anchor, and the navbar happened to contain a link with the same label. The assertion passed because the navbar navigates somewhere valid. The menu tabs had never been tested at all.',
      'The general failure is that a passing test proves an assertion held, not that the intended code ran. Broad, unscoped locators are the usual vector, and they get worse over time as the UI grows — adding demo credentials to the site footer here broke three unrelated tests overnight by duplicating text that had been unique.',
      'What to change: scope locators to a container rather than the page, use exact matching where labels overlap ("Pepsi" matches "Diet Pepsi", "Total" matches "Subtotal", "primary" matches "Make primary"), and when a test is written, break the feature deliberately once to confirm the test fails. A test never observed failing is a hypothesis.',
    ],
    seniorSignal:
      '"A test never observed failing is a hypothesis" — plus recognising that global UI changes can silently break locator uniqueness everywhere.',
  },
  {
    id: 'serial-integration-tests',
    category: 'Testing',
    question:
      'Your Playwright suite runs workers: 1 against a real backend and database. Defend that, and say what it costs.',
    answer: [
      'These are integration tests sharing one database. Run in parallel, an admin test creating a product raced a menu test counting them — "expected 14, received 15". Nothing was wrong with either test; they were describing a moving world.',
      'Serial execution removes that whole class of flake. The cost is wall-clock: the suite takes about three minutes where parallel workers would take well under one, and that gap grows with every test added.',
      'The honest alternative is isolation instead of serialisation — a database per worker, or per-test transactional rollback, or namespacing every fixture so tests cannot collide. That is the right investment once the suite is slow enough to matter. Until then, serial plus disciplined cleanup is the cheaper trade, and cleanup is not optional: a failed test that leaves a row behind poisons every later run, so teardown deletes anything matching the fixture prefix whether the test passed or not.',
    ],
    seniorSignal:
      'Naming the real alternative (isolation) and the condition under which you would switch, rather than defending serial execution as simply correct.',
  },
];
