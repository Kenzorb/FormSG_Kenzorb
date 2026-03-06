import express from "express";
import formsg from "@opengovsg/formsg-sdk";
import { google } from "googleapis";

console.log("Starting server...");
console.log("FORMSG mode:", process.env.FORMSG_MODE || "production");
console.log("GSHEET_ID exists:", !!process.env.GSHEET_ID);
console.log("GSHEET_TAB:", process.env.GSHEET_TAB || "Sheet1");
console.log("FORM secret exists:", !!process.env.FORMSG_FORM_SECRET_KEY_PEM);
console.log("Google JSON exists:", !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

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

app.post("/formsg-webhook", async (req, res) => {
  console.log("POST /formsg-webhook hit");
  console.log("Headers received:", req.headers);
  console.log("Body received:", JSON.stringify(req.body).slice(0, 500));

  try {
    const decrypted = await sdk.crypto.decrypt(
      process.env.FORMSG_FORM_SECRET_KEY_PEM,
      req.body
    );

    console.log("Decryption succeeded");
    console.log("Submission ID:", decrypted.submissionId || decrypted.id);

    const answers = new Map();
    for (const r of decrypted.responses || []) {
      const q = r.question;
      let a = r.answer;

      if (Array.isArray(a)) a = a.join(", ");
      if (a && typeof a === "object") a = JSON.stringify(a);

      answers.set(q, a ?? "");
    }

    const submissionId = decrypted.submissionId || decrypted.id || "";
    const created = decrypted.created || new Date().toISOString();

    const row = COLUMNS.map((col) => {
      if (col === "Response ID") return submissionId;
      if (col === "Timestamp") return created;
      if (col === "Download Status") return "Success";
      return answers.get(col) ?? "";
    });

    console.log("Appending row to sheet...");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:AA`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
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
