# Personal expense tracker

A local, single-user expense tracker built with Nuxt 3, its server routes, and SQLite. Amounts are in Indian rupees; the database stores integer paise to avoid floating-point rounding errors.

## Run

Requires Node.js 22.13 or newer and npm. Node's built-in SQLite API is experimental in Node 22 and may print a warning.

```sh
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

Automated storage tests cover the operations, validation, monthly summary, filters, sorting, and persistence:

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
- All requested features are implemented. Authentication, multiple users, deployment, and multi-currency are deliberately omitted because the brief excludes them. The app is intended for local use, not exposure to the internet.
- Title searches use SQLite's built-in case conversion, which is case-insensitive for ASCII characters but not necessarily for all Unicode characters. Title and note limits are 100 and 2,000 characters; amounts must be positive with up to two decimal places.
- The month uses the computer's local date and time. Browser and server should use the same local timezone.
- `npm install` reported dependency security advisories; run `npm audit` for the current details. The local development server should not be exposed publicly.
