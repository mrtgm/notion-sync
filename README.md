# notion-gcal-sync

A simple script to do 2 way-sync between Notion calendar and Google Calendar, run on Cloudflare Workers.

By default, it will sync all events in the next week, and run every minute. You can change the behavior by modifying `wrangler.toml`.

## Prerequisites

- Google Calendar
- Notion
- Cloudflare Workers
  - KV
  - Cron

## Usage

1. Create a new Google Calendar.
2. Create a new Notion database with the following properties:
   - `Name` (title)
   - `Date` (start / end date with time)
   - `Event Id` (text)
3. Create a new integration in Notion and get the token.
4. Create a new service account in Google Cloud Console and download the JSON key.
5. In Google Calendar, go to `Settings and sharing` -> `Share with specific people` and add the service account email with `Make changes to events` permission.
6. Create a new Cloudflare Worker, and set the following secrets:
   - `notion_token`: Notion integration token
   - `notion_database_id`: Notion database ID
   - `google_calendar_id`: Google Calendar ID
   - `google_private_key`: Google service account private key
   - `google_client_email`: Google service account email
7. Deploy the worker and set a cron job to run it periodically.
