# AI expense tracker

## Cloudflare Access

The deployed app sits behind one Cloudflare Access application. Access signs you in and turns everyone else away at Cloudflare's edge. The Worker also checks the token Access adds to every request, so a route to the Worker that Access does not cover is still closed (ADR-0011). Local `alchemy dev` needs none of this: requests to `localhost` and `127.0.0.1` are exempt.

### 1. Create the Access application

1. In the Cloudflare dashboard, open **Zero Trust**. If this is your first time, pick a team name. Your team domain is `<team name>.cloudflareaccess.com`.
2. Go to **Access** > **Applications** > **Add an application** > **Self-hosted**.
3. Name it (for example `Expense tracker`) and add the app's hostname, for example `expenses.example.com`. Leave the path empty so the whole hostname is covered: the SPA and `/api/*`.
4. Set the session duration you want, for example 24 hours or 1 month.
5. Under **Advanced settings** > **Cookie settings**, set **SameSite attribute** to **Strict** (or **Lax**) and turn on **HTTP Only**. Then other sites can't get the browser to send your Access cookie with their requests, and scripts on the page can't read it. The Worker also refuses writes that don't come from the app's own pages (`403 CROSS_SITE_REQUEST`); the cookie settings are a second layer.
6. Save. Open the application again and copy its **Application Audience (AUD) Tag** from the **Overview** tab.

### 2. Add the login policy

1. On the application, add a policy named `Owner`, action **Allow**.
2. Add one include rule: **Emails** equals your email address. Nothing else.
3. Under **Login methods**, keep **One-time PIN** (Access emails you a code) or pick an identity provider you have set up.

Anyone who is not you then sees the Access login page and can never reach the app.

### 3. Give the Worker the team domain and AUD tag

The Worker reads two settings. If either is missing, every API route except `/api/health` answers `401`.

| Variable             | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| `ACCESS_TEAM_DOMAIN` | Your team domain, for example `myteam.cloudflareaccess.com` |
| `ACCESS_AUD`         | The AUD tag from step 1                                   |

Put both in `.env` (copy `.env.example`) or in the environment you run `pnpm deploy` in. `alchemy.run.ts` binds them to the Worker on deploy. They identify the application; they are not secrets.

### 4. Turn off the `workers.dev` address and preview URLs

Access protects a hostname. The Worker is also reachable on `<worker>.<account>.workers.dev` and on per-version preview URLs, which Access does not cover. The Worker refuses requests there without a valid token anyway, but turn them off so the app has one way in:

- **In `alchemy.run.ts`**, on the `Api` Worker, set `workersDev: { enabled: false, previewsEnabled: false }` once the custom domain is attached (issue #5), then deploy.
- **Or in the dashboard**: **Workers & Pages** > the Worker > **Settings** > **Domains & Routes**. Disable `workers.dev` and **Preview URLs**.

If you ever add another hostname for the Worker, add it to the same Access application first.

### 5. Use a service token for scripts

Scripts and other non-browser callers cannot sign in through a login page. Give them an Access service token:

1. In **Zero Trust**, go to **Access** > **Service credentials** > **Service Tokens** > **Create Service Token**. Name it, choose how long it lasts, and copy the **Client ID** and **Client Secret**. The secret is shown only once.
2. On the Access application, add a second policy named `Scripts`, action **Service Auth**, with an include rule **Service Token** equals the token you created.
3. Send both values as headers on every request:

   ```sh
   curl https://expenses.example.com/api/expenses \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
   ```

Access checks the pair and passes the request on with the same signed `Cf-Access-Jwt-Assertion` header a browser gets, so the Worker needs nothing extra. A script that writes (POST, PATCH, PUT or DELETE) must also send the app's own origin, or the Worker answers `403 CROSS_SITE_REQUEST`:

```sh
curl -X POST https://expenses.example.com/api/expenses/<id>/confirm \
  -H "Origin: https://expenses.example.com" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

Keep the secret out of the repository. To revoke a script's access, delete its service token.

### When your session expires

The app does not show an error. Its next API call gets Access's login redirect instead of data, so the app reloads the page and you land on the Access login. Sign in and carry on.

## Backups

The database is Cloudflare D1, and its backup is D1 Time Travel: you can restore it to any minute in the last 7 days on the Workers Free plan, or the last 30 days on Workers Paid. For a copy you keep yourself, `wrangler d1 export <database> --remote --output backup.sql` writes a SQL dump. There is no other backup.
