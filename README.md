# Personal expense tracker

A local, single-user expense tracker built with Nuxt 3, its server routes, and SQLite. Amounts are in Indian rupees; the database stores integer paise to avoid floating-point rounding errors.

## Run

Requires Node.js 22.13 or newer and npm; verified with Node.js 22.14.0 and npm 10.9.2. Node's built-in SQLite API is experimental in Node 22 and may print a warning.

```bash
git clone https://github.com/rizwyy/Riafy-challenge.git
cd Riafy-challenge
npm install
npm run dev
```

Open the local URL printed in the terminal (normally http://127.0.0.1:3000). To choose a different port, run `npm run dev -- --port 3101`. Stop the server with Ctrl+C. Data is saved in `expenses.sqlite` in the project directory and remains after a restart. Keep that file if you want to preserve your data.

## Verify

1. Add expenses with different dates and categories. Check that every field appears and the newest dates appear first. Leave the note empty on one expense and confirm the date initially shows today.
2. Edit an expense, save it, then delete it. Reload the page and confirm the changes persist.
3. Add expenses dated this month and another month. Check that the current-month total and category breakdown include only this month's entries. The summary does not change with list filters.
4. Filter by category, inclusive from/to dates, and part of a title, individually and together. Clear the filters; search for text that matches nothing to see the empty state.
5. Try a blank title, zero or negative amount, more than two decimal places, and a from date later than the to date. The form or API rejects invalid input.

Automated tests cover storage operations, validation, monthly summaries, filters, sorting, persistence, and client handlers (including failed saves and duplicate-submission protection). Client-handler tests are not browser tests:

```sh
npm test
```

For HTTP checks, start the app on port 3101 in one terminal (`npm run dev -- --port 3101`), then in a second terminal run:

```sh
node tests/http-check.mjs
```

The HTTP check creates and deletes its own test expense. Use `BASE_URL=http://127.0.0.1:3000 node tests/http-check.mjs` for a different running port.

## Choices and limitations

- Nuxt keeps the UI and API together; SQLite needs no separate database service. Built-in SQLite avoids an additional database package but ties the app to a recent Node version and currently emits an experimental warning.
- All requested features are implemented. Authentication, multiple users, and deployment are omitted because the brief does not require them. Multi-currency is outside the requested scope. The app is intended for local use, not exposure to the internet.
- Title searches use JavaScript lowercase conversion for case-insensitive partial matches, including accented letters. They do not perform accent removal or locale-specific collation. Category/date filters use SQL; title matching runs in Node for this small local dataset. Title and note limits are 100 and 2,000 characters; amounts must be positive with up to two decimal places.
- The month uses the computer's local date and time. Browser and server should use the same local timezone.
- `npm install` reported dependency security advisories; run `npm audit` for the current details. The local development server should not be exposed publicly.

## Data flow

`app.vue` holds the form and filter state and calls the Nuxt API routes with `$fetch`. The routes read requests and choose HTTP responses. `server/utils/store.mjs` validates inputs, converts rupees to integer paise, and uses parameterized SQLite queries. Responses convert paise back to rupees; after a change, the page reloads the list and monthly summary.

## Date validation

On both creation and editing, omitting the date defaults it to today. If a date is supplied, it must be a nonempty `YYYY-MM-DD` string representing a valid calendar date. Non-string values (including `null`, `false`, `0`, arrays, and objects), empty strings, and impossible dates are rejected with HTTP 400.
