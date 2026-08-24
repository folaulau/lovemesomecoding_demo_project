import { HomeScreen } from '@/features/home/screens/HomeScreen';

/**
 * Route files stay one line.
 *
 * <p>The route's job is to say WHICH screen lives at this path; the screen's job is to render it.
 * Keeping them separate means the screen can be rendered in a test without a router, and moving a
 * screen to a different path is a file rename rather than a refactor.
 */
export default function HomeRoute() {
  return <HomeScreen />;
}
