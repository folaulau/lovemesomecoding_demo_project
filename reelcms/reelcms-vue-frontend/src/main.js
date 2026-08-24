import { createApp } from "vue";
import { createPinia } from "pinia";

// The navbar toggle and any other data-bs-* behaviour need Bootstrap's JS. The
// bundle includes Popper, which the dropdown and tooltip plugins depend on.
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import App from "./App.vue";
import router from "./router";
import "./assets/styles.css";

createApp(App).use(createPinia()).use(router).mount("#app");
