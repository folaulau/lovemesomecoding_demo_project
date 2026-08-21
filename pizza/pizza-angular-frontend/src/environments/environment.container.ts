/**
 * Build-time configuration for the container image.
 *
 * <p>The CLI substitutes this for `environment.ts` when the build runs with
 * `--configuration container` — see `fileReplacements` in `angular.json`, and the `RUN npm run
 * build` line in the Dockerfile.
 *
 * <p>The only difference from production is that <b>`apiBaseUrl` is empty</b>. That makes every
 * request relative — `/api/products` rather than `http://localhost:8085/api/products` — so it goes
 * to whatever origin served the app. In the container that is nginx, which proxies `/api/` to the
 * API container over the Docker network (see `nginx.conf`).
 *
 * <p>Two things fall out of that, and both are the reason to do it this way:
 * <ul>
 *   <li>the browser makes no cross-origin request, so CORS never applies;</li>
 *   <li>the image does not care what host port the API is published on, or whether it is published
 *       at all.</li>
 * </ul>
 *
 * <p>⚠️ This file exists because Angular has <b>no runtime environment mechanism</b>. The value is
 * compiled into the bundle, so it cannot be set with `docker run -e`. The React app reaches the
 * same result with a Docker build arg (`VITE_API_BASE_URL`); Angular needs a whole extra file and
 * a build configuration to say the same thing.
 */
export const environment = {
  production: true,
  apiBaseUrl: '',
  stripePublishableKey:
    'pk_test_51U5Wc3BeMrxmFducR7hlZ3YwT770EF2DFj8VPmEmqZ7r2sVasfWDRjWMQBvEqdWOSuIGg6RSd8oIcjQ9RblgJxRq00ThBQPY9F',
};
