import { Container } from 'react-bootstrap';

export function Footer() {
  return (
    <footer className="bg-pizza-black text-white-50 mt-5 py-4">
      <Container className="d-flex flex-wrap justify-content-between gap-2 small">
        <span>PizzaHub — a demo app for lovemesomecoding.com</span>
        <span>Not a real restaurant. Please do not expect a pizza.</span>
      </Container>
    </footer>
  );
}
