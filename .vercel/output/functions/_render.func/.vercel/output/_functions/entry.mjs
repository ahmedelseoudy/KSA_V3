import { g as renderers, c as createExports } from './chunks/vendor_LCkWoqkp.mjs';
import { manifest } from './manifest_yb7M3hjK.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/admin.astro.mjs');
const _page2 = () => import('./pages/analytics.astro.mjs');
const _page3 = () => import('./pages/api/auth/setup-password.astro.mjs');
const _page4 = () => import('./pages/api/availability.astro.mjs');
const _page5 = () => import('./pages/api/companies/resend-invite.astro.mjs');
const _page6 = () => import('./pages/api/companies.astro.mjs');
const _page7 = () => import('./pages/api/login.astro.mjs');
const _page8 = () => import('./pages/api/order-items.astro.mjs');
const _page9 = () => import('./pages/api/orders.astro.mjs');
const _page10 = () => import('./pages/api/products.astro.mjs');
const _page11 = () => import('./pages/api/purchase-orders.astro.mjs');
const _page12 = () => import('./pages/auth/setup.astro.mjs');
const _page13 = () => import('./pages/availability.astro.mjs');
const _page14 = () => import('./pages/companies.astro.mjs');
const _page15 = () => import('./pages/dashboard.astro.mjs');
const _page16 = () => import('./pages/deliveries.astro.mjs');
const _page17 = () => import('./pages/login.astro.mjs');
const _page18 = () => import('./pages/orders.astro.mjs');
const _page19 = () => import('./pages/portal/availability.astro.mjs');
const _page20 = () => import('./pages/portal/purchase-orders.astro.mjs');
const _page21 = () => import('./pages/portal.astro.mjs');
const _page22 = () => import('./pages/products.astro.mjs');
const _page23 = () => import('./pages/purchase-orders.astro.mjs');
const _page24 = () => import('./pages/register.astro.mjs');
const _page25 = () => import('./pages/waiting-approval.astro.mjs');
const _page26 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/admin.astro", _page1],
    ["src/pages/analytics.astro", _page2],
    ["src/pages/api/auth/setup-password.ts", _page3],
    ["src/pages/api/availability.ts", _page4],
    ["src/pages/api/companies/resend-invite.ts", _page5],
    ["src/pages/api/companies.ts", _page6],
    ["src/pages/api/login.ts", _page7],
    ["src/pages/api/order-items.ts", _page8],
    ["src/pages/api/orders.ts", _page9],
    ["src/pages/api/products.ts", _page10],
    ["src/pages/api/purchase-orders.ts", _page11],
    ["src/pages/auth/setup.astro", _page12],
    ["src/pages/availability.astro", _page13],
    ["src/pages/companies.astro", _page14],
    ["src/pages/dashboard.astro", _page15],
    ["src/pages/deliveries.astro", _page16],
    ["src/pages/login.astro", _page17],
    ["src/pages/orders.astro", _page18],
    ["src/pages/portal/availability.astro", _page19],
    ["src/pages/portal/purchase-orders.astro", _page20],
    ["src/pages/portal/index.astro", _page21],
    ["src/pages/products.astro", _page22],
    ["src/pages/purchase-orders.astro", _page23],
    ["src/pages/register.astro", _page24],
    ["src/pages/waiting-approval.astro", _page25],
    ["src/pages/index.astro", _page26]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "1b3c9f93-e804-480e-9515-0c1e0e3a57f8",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
