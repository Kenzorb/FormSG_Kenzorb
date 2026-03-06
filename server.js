import express from "express";
import formsg from "@opengovsg/formsg-sdk";
import { google } from "googleapis";

const app = express();
app.use(express.json({ limit: "2mb" }));

// FormSG SDK (used to verify+decrypt webhook submissions)
const sdk = formsg({ mode: process.env.FORMSG_MODE || "production" });

// Google Sheets client
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = process.env.GSHEET_ID;
const SHEET_TAB = process.env.GSHEET_TAB || "Sheet1";

// Column order (matches your CSV header)
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
  "Acknowledgement of Status", // duplicate column in your CSV
  "Acknowledgment of MC Process",
  "Acknowledgement of HL",
];

app.post("/formsg-webhook", async (req, res) => {
  try {
    // Decrypt with your form secret key (from FormSG)
    const decrypted = await sdk.crypto.decrypt(
      process.env.FORMSG_FORM_SECRET_KEY_PEM,
      req.body
    );

    // Build map: question -> answer
    // (Different field types may structure answer differently; this handles common cases.)
    const answers = new Map();
    for (const r of decrypted.responses || []) {
      const q = r.question;
      let a = r.answer;

      // Some answers can be objects/arrays; flatten to something Sheets-friendly
      if (Array.isArray(a)) a = a.join(", ");
      if (a && typeof a === "object") a = JSON.stringify(a);

      answers.set(q, a ?? "");
    }

    // Fill row in CSV order
    const submissionId = decrypted.submissionId || decrypted.id || "";
    const created = decrypted.created || new Date().toISOString();

    const row = COLUMNS.map((col) => {
      if (col === "Response ID") return submissionId;
      if (col === "Timestamp") return created;
      if (col === "Download Status") return "Success"; // like your CSV export
      return answers.get(col) ?? "";
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:AA`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return res.status(200).send("ok");
  } catch (err) {
    console.error(err);
    return res.status(500).send("error");
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Webhook server running"));