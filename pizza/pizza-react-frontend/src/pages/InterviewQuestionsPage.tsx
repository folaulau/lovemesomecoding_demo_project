import { useDeferredValue, useMemo, useState } from 'react';
import { Accordion, Badge, Button, Col, Container, Form, Row } from 'react-bootstrap';
import {
  CATEGORIES,
  INTERVIEW_QUESTIONS,
  type InterviewQuestion,
  type QuestionCategory,
} from '../data/interviewQuestions';

/**
 * Senior interview questions, drawn from this codebase.
 *
 * <p>This page is the odd one out in a pizza app, and deliberately so: the whole project exists to
 * produce teaching material for lovemesomecoding.com, and the most valuable thing it has produced
 * is the list of things that went wrong. Every question here has a real commit behind it.
 *
 * <p>REACT CONCEPTS ON SHOW
 *
 * <ul>
 *   <li><b>useDeferredValue</b> — the search box stays responsive while the (larger) filtered list
 *       re-renders behind it. React keeps the previous list on screen until the new one is ready
 *       rather than blocking each keystroke. This is the concurrent-rendering feature that earns
 *       its place most obviously on a filter-as-you-type screen.
 *   <li><b>useMemo</b> — filtering runs on two inputs, not on every render. Note it is memoised
 *       against the DEFERRED query, not the live one; memoising against the live value would defeat
 *       the point by recomputing on every keystroke anyway.
 *   <li><b>Derived state, not stored state</b> — the visible list and the counts are computed from
 *       the query and the category. Storing them in useState would create two things that can
 *       disagree, which is the same argument the Redux slices make about derived data.
 * </ul>
 *
 * <p>No Context and no Redux: nothing here is shared with another screen, so this is exactly the
 * case for plain local state. See {@code CLAUDE.md} — customer-facing pages use Context where state
 * is shared, and nothing at all where it is not.
 */

/** Bootstrap variants per category, so a badge is never colour-alone — the label carries it. */
const CATEGORY_VARIANT: Record<QuestionCategory, string> = {
  'JPA & Hibernate': 'danger',
  'SQL & data modelling': 'dark',
  'API & security': 'primary',
  React: 'info',
  'State management': 'success',
  Testing: 'secondary',
};

function matches(question: InterviewQuestion, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    question.question,
    question.category,
    question.seniorSignal,
    ...question.answer,
    question.code?.source ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function InterviewQuestionsPage() {
  const [category, setCategory] = useState<QuestionCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  /*
   * The deferred copy lags the input by a render when React is busy. The <input> reads `query` so
   * typing is always immediate; the list reads `deferredQuery` and is allowed to fall behind.
   */
  const deferredQuery = useDeferredValue(query);
  const stale = query !== deferredQuery;

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return INTERVIEW_QUESTIONS.filter(
      (q) => (category === 'all' || q.category === category) && matches(q, needle),
    );
  }, [category, deferredQuery]);

  const countsByCategory = useMemo(() => {
    const counts = new Map<QuestionCategory, number>();
    for (const q of INTERVIEW_QUESTIONS) {
      counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  return (
    <Container className="py-4 py-lg-5">
      <Row className="mb-4">
        <Col lg={9}>
          <h1 className="h3 fw-bold mb-2">Senior interview questions</h1>
          <p className="text-muted mb-0">
            Twenty questions taken from real decisions and real bugs in this application — not from
            a list of definitions. Several describe something that reached a running app before
            anyone noticed. Each answer ends with what separates a good answer from a senior one.
          </p>
        </Col>
      </Row>

      <Row className="g-2 align-items-center mb-4">
        <Col md={5}>
          <Form.Label htmlFor="question-search" className="visually-hidden">
            Search questions
          </Form.Label>
          <Form.Control
            id="question-search"
            type="search"
            placeholder="Search — try 'deleted', 'unwrap', 'cartesian'"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Col>
        <Col md={7}>
          {/*
            A labelled group, so tests (and screen readers) can address the filters as a unit. Every
            accordion header's accessible name begins with its category badge, so an unscoped
            getByRole('button', {name: /^Testing/}) matches these buttons AND the questions.
          */}
          <div className="d-flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <Button
              size="sm"
              variant={category === 'all' ? 'primary' : 'outline-secondary'}
              onClick={() => setCategory('all')}
              aria-pressed={category === 'all'}
            >
              All {INTERVIEW_QUESTIONS.length}
            </Button>
            {CATEGORIES.map((name) => (
              <Button
                key={name}
                size="sm"
                variant={category === name ? 'primary' : 'outline-secondary'}
                onClick={() => setCategory(name)}
                aria-pressed={category === name}
              >
                {name} {countsByCategory.get(name) ?? 0}
              </Button>
            ))}
          </div>
        </Col>
      </Row>

      <p className="text-muted small" aria-live="polite">
        Showing {visible.length} of {INTERVIEW_QUESTIONS.length}
      </p>

      {visible.length === 0 ? (
        <p className="py-5 text-center text-muted">
          Nothing matches that. Try a broader term, or clear the category filter.
        </p>
      ) : (
        /*
         * `stale` dims the list while the deferred value catches up, so a slow filter reads as
         * "working" rather than "frozen". Without it the only signal is that nothing changed yet.
         */
        <Accordion alwaysOpen className={stale ? 'opacity-50' : undefined}>
          {visible.map((question, index) => (
            <Accordion.Item key={question.id} eventKey={question.id}>
              <Accordion.Header>
                <span className="d-flex flex-wrap align-items-baseline gap-2 pe-3">
                  <Badge bg={CATEGORY_VARIANT[question.category]}>{question.category}</Badge>
                  <span className="fw-semibold">
                    {index + 1}. {question.question}
                  </span>
                </span>
              </Accordion.Header>

              <Accordion.Body>
                {question.answer.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}

                {question.code && (
                  <figure className="mb-3">
                    <figcaption className="small text-muted mb-1">
                      {question.code.caption}
                    </figcaption>
                    <pre className="bg-light border rounded p-3 mb-0 overflow-auto">
                      <code>{question.code.source}</code>
                    </pre>
                  </figure>
                )}

                <div className="border-start border-4 border-primary ps-3 py-1">
                  <div className="small fw-semibold text-uppercase text-muted">
                    What a senior answer adds
                  </div>
                  <div>{question.seniorSignal}</div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Container>
  );
}
