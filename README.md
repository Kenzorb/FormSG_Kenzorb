# FormSG → Google Sheets Webhook Sync

This project automatically syncs **FormSG submissions** to **Google Sheets** in real time using a webhook hosted on Render.

Instead of manually exporting CSV files from FormSG, every new submission is decrypted and inserted directly into a Google Sheet. This reduces the hassel for both attendees and organizers doing attendance
1. After users submits their attendance, they can check through the google sheet to ensure it has been submitted. Only users with defence mail can access formSG
2. Organizers do not have to manually log in to formsg to view the responses
 - Before (8 steps): Open formSG -> Enter whitelisted defence mail -> Open email for OTP -> Back to formSG to key in OTP -> Navigate to results/responses -> use secret key to unlock -> Download responses in CSV -> View attendance
 - After (2 steps): Open google sheet -> View attendance

---

# Architecture

```
FormSG submission
        ↓
FormSG Webhook
        ↓
Render Node.js server
        ↓
Decrypt submission (FormSG SDK)
        ↓
Google Sheets API
        ↓
Google Sheet updated instantly
```

To prevent the Render free-tier service from sleeping, **UptimeRobot** periodically pings the server.

```
UptimeRobot (every 5 minutes)
        ↓
Render server stays active
```

---

# Features

- Real-time sync from FormSG to Google Sheets
- Automatic decryption of FormSG Storage Mode submissions
- Duplicate submission protection
- Inserts newest submissions at the **top of the sheet**
- Automatic timestamp formatting
- Works on **Render free tier**
- Server kept awake using UptimeRobot

---

# Tech Stack

- Node.js
- Express
- FormSG SDK
- Google Sheets API
- Render (hosting)
- UptimeRobot (keep-alive monitor)

---

# Project Structure

```
.
├── server.js
├── package.json
├── .gitignore
└── README.md
```

---

# Environment Variables

Set these in **Render → Environment Variables**

```
FORMSG_FORM_SECRET_KEY_PEM=your_form_secret_key
GOOGLE_SERVICE_ACCOUNT_JSON=service_account_json
GSHEET_ID=google_sheet_id
GSHEET_TAB=Sheet1
WEBHOOK_URL=https://your-render-app.onrender.com/formsg-webhook
```

### Explanation

| Variable | Description |
|--------|--------|
| FORMSG_FORM_SECRET_KEY_PEM | FormSG storage mode secret key |
| GOOGLE_SERVICE_ACCOUNT_JSON | Google Cloud service account credentials |
| GSHEET_ID | Google spreadsheet ID |
| GSHEET_TAB | Sheet tab name |
| WEBHOOK_URL | Webhook endpoint used for signature verification |

---

# Setup

## 1. Enable Google Sheets API

Go to Google Cloud Console and enable:

```
Google Sheets API
```

## 2. Create Service Account

Create a service account and download the JSON key.

Share your Google Sheet with the service account email as **Editor**.

---

## 3. Install dependencies

```
npm install
```

---

## 4. Run locally

```
npm start
```

Server runs on:

```
http://localhost:3000
```

---

# Deployment (Render)

1. Push repository to GitHub
2. Create new **Web Service** on Render
3. Connect repository
4. Set start command

```
node server.js
```

5. Add environment variables
6. Deploy

Your webhook endpoint will be:

```
https://your-render-app.onrender.com/formsg-webhook
```

---

# FormSG Configuration

In your FormSG form:

```
Settings → Webhooks
```

Add:

```
https://your-render-app.onrender.com/formsg-webhook
```

FormSG will now send encrypted submissions to your server.

---

# Preventing Render Sleep

Render free services sleep after **15 minutes of inactivity**.

To keep the server awake, create an **UptimeRobot HTTP monitor**:

```
Monitor Type: HTTP(s)
URL: https://your-render-app.onrender.com/
Interval: 5 minutes
```

This keeps the webhook server ready for instant FormSG submissions.

---

# Example Log Output

```
POST /formsg-webhook hit
Decryption succeeded
Row appended successfully
```

---

# Google Sheet Output

New submissions are inserted below the header row:

```
Response ID | Timestamp | Name | Department | Status
----------------------------------------------------
69acbeaf... | 8/3/2026 09:19 | Kenzie Chua | Artiste | Present
```

---

# Security Notes

- Do **not** commit secrets to the repository
- Store credentials only in environment variables
- `.gitignore` should exclude:

```
.env
*.json
node_modules
```

---

# License

MIT License