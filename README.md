# AI expense tracker


https://github.com/user-attachments/assets/448ad15e-e6c4-4de0-b9af-9f38c2cc7dc4


## Local development

### What you need

- **Node 24.11.1 or newer** (`.node-version`). Alchemy refuses to start on older versions, 24.9 included.
- **pnpm 10.17.0.** `corepack enable` gives you the version `package.json` pins.
- **The Infisical CLI**, signed in with `infisical login`. `pnpm dev` reads the model provider's key, `API_PROVIDER_KEY`, from the `dev` environment of the Infisical project that `.infisical.yaml` links. Your account needs access to it.

### First run

```sh
pnpm install
cp .env.example .env
```

`alchemy dev` reads nothing Access-related from `.env`: requests to `localhost` skip the Access check. `.env` still turns OpenUI telemetry off, and `pnpm run deploy` reads the owner's email from it.

### Run it

```sh
pnpm dev
```

This runs `alchemy dev` under `infisical run`. It applies the D1 migrations to a local database, creates a local R2 bucket, builds the SPA and starts the Worker. It also starts the Vite dev server. Two URLs come up:

| URL                     | What it is                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `http://localhost:5173` | Vite with hot reload. `/api/*` is proxied to the local Worker. Use this while working on the SPA.                       |
| `http://localhost:1337` | The Worker serving the built SPA, set up the way production is. It shows SPA changes only after you restart `pnpm dev`. |

Port 5173 must be free: Vite does not fall back to another port.

### Other commands

| Command          | What it does                                                                |
| ---------------- | --------------------------------------------------------------------------- |
| `pnpm test`      | Unit tests in every package                                                 |
| `pnpm test:e2e`  | Playwright against the built SPA, with the API mocked; needs no backend     |
| `pnpm check`     | Format check, lint, typecheck and tests                                     |

## Deploy

Production is one Cloudflare Worker on its `workers.dev` URL, behind Cloudflare Access. `pnpm run deploy` creates everything: the Worker and its static assets, the D1 database (and applies the migrations), the R2 bucket, the `API_PROVIDER_KEY` secret and the Access application.

### Once per machine

1. **Node 24.11.1 or newer** on your `PATH` (`nvm use`). Alchemy refuses older versions.
2. **Connect Alchemy to Cloudflare.** Alchemy keeps its own login, separate from Wrangler and the `cf` CLI:

   ```sh
   pnpm exec alchemy profile edit --profile default --add Cloudflare
   ```

   It opens a browser to authorise the account.
3. **Enable R2 and Zero Trust once per Cloudflare account**, in the dashboard: **R2 Object Storage** (accept the terms; the free tier needs a payment method on file) and **Zero Trust** (pick the Free plan and a team name). The API refuses both until then.
4. **Infisical**: `API_PROVIDER_KEY` must exist in the `prod` environment.
5. **`.env`**: set `ACCESS_OWNER_EMAIL` to the one address allowed to sign in (see `.env.example`). It is not in `alchemy.run.ts` because the repository is public.

### Every deploy

```sh
pnpm run plan     # what would change, nothing applied
pnpm run deploy   # apply it; prints the app's URL
```

Both use the `prod` stage. Alchemy's state is local (`.alchemy/`, gitignored), so deploy from the machine that made the first deploy, or move that folder with you.

## Cloudflare Access

The deployed app sits behind one Cloudflare Access application. Access signs you in and turns everyone else away at Cloudflare's edge. The Worker also checks the token Access adds to every request, so a route to the Worker that Access does not cover is still closed (ADR-0011). Local `alchemy dev` needs none of this: requests to `localhost` and `127.0.0.1` are exempt.

### What `pnpm run deploy` sets up

The Zero Trust organization is the one exception: it was enabled in the dashboard, team `hanlabs` (login page `hanlabs.cloudflareaccess.com`), and `alchemy.run.ts` only names its team domain. Rename the team there and change `teamDomain` in `alchemy.run.ts` together. `alchemy.run.ts` declares the rest:

- **One-time PIN login.** Access emails a code to the address that signs in.
- **The Access application** `Expense tracker`. It covers the Worker's `workers.dev` URL and its version preview URLs, so the SPA and `/api/*` are both behind it. Sessions last 30 days. Its cookie is `SameSite=Lax` and `HttpOnly`, so other sites can't get the browser to send it with a form POST or an embedded request, and page scripts can't read it. Not `Strict`: sign-in ends in a redirect chain that starts on `cloudflareaccess.com`, the browser withholds a Strict cookie from it, and Access redirects in a loop. The Worker also refuses writes that don't come from the app's own pages (`403 CROSS_SITE_REQUEST`); the cookie settings are a second layer.
- **The `Owner` policy**: allow, if the email equals `ACCESS_OWNER_EMAIL`. Nothing else. Anyone else sees the login page and never reaches the app.
- **The Worker's `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`**, taken from the organization and application. If either is missing, every API route except `/api/health` answers `401`. They identify the application; they are not secrets.

### Adding a custom domain later

Add the domain to Cloudflare, set `domain` on the `Api` Worker, and set `workersDev: false` so the app has one way in. The Worker's Access enrollment covers every hostname the Worker serves, so the custom domain is behind the same application.

### Use a service token for scripts

Scripts and other non-browser callers cannot sign in through a login page. Give them an Access service token:

1. In **Zero Trust**, go to **Access** > **Service credentials** > **Service Tokens** > **Create Service Token**. Name it, choose how long it lasts, and copy the **Client ID** and **Client Secret**. The secret is shown only once.
2. On the Access application, add a second policy named `Scripts`, action **Service Auth**, with an include rule **Service Token** equals the token you created.
3. Send both values as headers on every request:

   ```sh
   curl https://<app-url>/api/expenses \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
   ```

Access checks the pair and passes the request on with the same signed `Cf-Access-Jwt-Assertion` header a browser gets, so the Worker needs nothing extra. A script that writes (POST, PATCH, PUT or DELETE) must also send the app's own origin, or the Worker answers `403 CROSS_SITE_REQUEST`:

```sh
curl -X POST https://<app-url>/api/expenses/<id>/confirm \
  -H "Origin: https://<app-url>" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

Keep the secret out of the repository. To revoke a script's access, delete its service token.

### When your session expires

The app does not show an error. Its next API call gets Access's login redirect instead of data, so the app reloads the page and you land on the Access login. Sign in and carry on.

## Backups

The database is Cloudflare D1, and its backup is D1 Time Travel: you can restore it to any minute in the last 7 days on the Workers Free plan, or the last 30 days on Workers Paid. For a copy you keep yourself, `wrangler d1 export <database> --remote --output backup.sql` writes a SQL dump. There is no other backup.
