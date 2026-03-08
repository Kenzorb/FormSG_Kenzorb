import express from "express";
import formsg from "@opengovsg/formsg-sdk";
import { google } from "googleapis";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.status(200).send("FormSG webhook running");
});

app.get("/formsg-webhook", (req, res) => {
  res.status(200).send("Webhook endpoint is live. Use POST only.");
});

const sdk = formsg({ mode: process.env.FORMSG_MODE || "production" });

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = process.env.GSHEET_ID;
const SHEET_TAB = process.env.GSHEET_TAB || "Sheet1";
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "https://formsg-kenzorb.onrender.com/formsg-webhook";

const COLUMNS = [
  "Response ID",
  "Timestamp",
  "Download Status",
  "[MyInfo] Name",
  "Department",
  "Status",
  "Do you have an MA/AL/OIL/WFH?",
  "Is your status for AM or PM?",
  "What is your AM Status",
  "What is your PM Status",
  "Medical Appointment (MA) Time",
  "IS Duties",
  "Roles",
  "Remarks (NSC/IS)",
  "Remarks (Event Name)",
  "Remarks (Location & Reporting Time)",
  "Date of Birth",
  "Remarks (OIL/PHIL)",
  "Date of Deployment",
  "Start Date (AL/OL)",
  "End Date (AL/OL)",
  "Start Date (OIL/PHIL/Birthday Off)",
  "End Date (OIL/PHIL/Birthday Off)",
  "Acknowledgement of Status",
  "Acknowledgement of Status",
  "Acknowledgment of MC Process",
  "Acknowledgement of HL",
];

// Convert ISO 8601 UTC Format to Singapore Time
function formatDate(isoString) {
  const date = new Date(isoString)

  const sg = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Singapore" }))

  const month = sg.getMonth() + 1
  const day = sg.getDate()
  const year = sg.getFullYear()
  const hours = sg.getHours().toString().padStart(2, "0")
  const minutes = sg.getMinutes().toString().padStart(2, "0")

  return `${month}/${day}/${year} ${hours}:${minutes}`
}

app.post("/formsg-webhook", async (req, res) => {
  console.log("POST /formsg-webhook hit");
  console.log("Headers received:", req.headers);
  console.log("Body received:", JSON.stringify(req.body).slice(0, 500));

  try {
    // 1) Verify webhook signature
    sdk.webhooks.authenticate(
      req.get("X-FormSG-Signature"),
      WEBHOOK_URL
    );

    // 2) Decrypt ONLY req.body.data
    const decrypted = sdk.crypto.decrypt(
      process.env.FORMSG_FORM_SECRET_KEY_PEM,
      req.body.data
    );

    if (!decrypted) {
      console.error("Decryption failed: sdk.crypto.decrypt returned null");
      return res.status(400).send("Could not decrypt submission");
    }

    console.log("Decryption succeeded");

    const answers = new Map();
    for (const r of decrypted.responses || []) {
      const q = r.question;
      let a = r.answer ?? r.answerArray ?? "";

      if (Array.isArray(a)) a = a.join(", ");
      if (a && typeof a === "object") a = JSON.stringify(a);

      answers.set(q, a);
    }

    // submissionId and created are on req.body.data, not decrypted
    const submissionId = req.body.data?.submissionId || "";
    const created = formatDate(req.body.data?.created) || new Date().toISOString();

    // Check if Response ID already exists in column A
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:A`,
    });

    const existingIds = (existing.data.values || []).flat();

    if (existingIds.includes(submissionId)) {
      console.log(`Duplicate submission detected: ${submissionId}`);
      return res.status(200).send("duplicate ignored");
    }

    const row = COLUMNS.map((col) => {
      if (col === "Response ID") return submissionId;
      if (col === "Timestamp") return created;
      if (col === "Download Status") return "Success";
      return answers.get(col) ?? "";
    });

    // 1️⃣ Insert a new row below the header
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: 1,
                endIndex: 2
              },
              inheritFromBefore: false
            }
          }
        ]
      }
    });

    // 2️⃣ Write the new data into row 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A2:AA`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row]
      }
    });

    console.log("Row appended successfully");
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send("error");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Webhook server running");
});
