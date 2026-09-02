import nodemailer from "nodemailer";
import type { DbClient } from "./db";

const DEFAULT_SMTP_HOST = "smtp.melohospitality.co.za";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_USER = "noreply@meloshospitality.co.za";
const DEFAULT_SMTP_FROM = "noreply@meloshospitality.co.za";

export interface TaskNotificationRecipient {
  id: number;
  name: string;
  email: string;
}

export interface TaskNotificationTask {
  id: number;
  facilityName: string;
  title: string;
  description?: string | null;
  expectedDate?: string | null;
  creatorName: string;
  creatorEmail: string;
}

export interface TaskNotificationMessage {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeSubjectPart(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim() || "Task";
}

export async function getTaskNotificationRecipients(
  database: DbClient,
  facilityId: number
): Promise<TaskNotificationRecipient[]> {
  return (await database
    .prepare(
      `SELECT DISTINCT u.id, u.name, u.email
       FROM users u
       LEFT JOIN user_facilities uf
         ON uf.user_id = u.id AND uf.facility_id = ?
       WHERE u.role = 'manager'
         AND u.active = 1
         AND (u.access_all = 1 OR u.facility_id = ? OR uf.facility_id IS NOT NULL)
         AND TRIM(u.email) <> ''
       ORDER BY u.id`
    )
    .all(facilityId, facilityId)) as unknown as TaskNotificationRecipient[];
}

export function composeTaskNotification(
  task: TaskNotificationTask
): TaskNotificationMessage {
  const description = task.description?.trim() || "No description provided.";
  const expectedDate = task.expectedDate?.trim() || "Not specified";
  const subject = `New task for ${safeSubjectPart(task.facilityName)}: ${safeSubjectPart(task.title)}`;
  const text = [
    `New task for ${task.facilityName}`,
    "",
    `Task: ${task.title}`,
    `Property: ${task.facilityName}`,
    `Created by: ${task.creatorName} <${task.creatorEmail}>`,
    `Expected completion: ${expectedDate}`,
    `Description: ${description}`,
  ].join("\n");
  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f7f3ec;color:#193228;font-family:Arial,sans-serif">
        <div style="max-width:620px;margin:24px auto;padding:28px;background:#fff;border:1px solid #e4dac8">
          <p style="margin:0 0 8px;color:#a17a35;font-size:12px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase">Grand Holdings</p>
          <h1 style="margin:0 0 24px;font-size:26px">New task created</h1>
          <table role="presentation" style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;font-weight:bold;width:180px">Property</td><td style="padding:8px 0">${escapeHtml(task.facilityName)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold">Task</td><td style="padding:8px 0">${escapeHtml(task.title)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold">Created by</td><td style="padding:8px 0">${escapeHtml(task.creatorName)} &lt;${escapeHtml(task.creatorEmail)}&gt;</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold">Expected completion</td><td style="padding:8px 0">${escapeHtml(expectedDate)}</td></tr>
          </table>
          <h2 style="margin:24px 0 8px;font-size:16px">Description</h2>
          <p style="margin:0;white-space:pre-wrap;line-height:1.6">${escapeHtml(description)}</p>
        </div>
      </body>
    </html>
  `.trim();

  return { subject, text, html };
}

function envBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}

function smtpConfig() {
  const password = process.env.SMTP_PASSWORD?.trim();
  if (!password) {
    throw new Error("SMTP notifications are not configured: SMTP_PASSWORD is missing.");
  }

  const port = Number.parseInt(
    process.env.SMTP_PORT?.trim() || String(DEFAULT_SMTP_PORT),
    10
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP notifications are not configured: SMTP_PORT is invalid.");
  }

  return {
    host: process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST,
    port,
    secure: envBoolean("SMTP_SECURE", port === 465),
    requireTLS: envBoolean("SMTP_REQUIRE_TLS", port !== 465),
    auth: {
      user: process.env.SMTP_USER?.trim() || DEFAULT_SMTP_USER,
      pass: password,
    },
    from: process.env.SMTP_FROM?.trim() || DEFAULT_SMTP_FROM,
  };
}

export async function sendTaskCreatedNotifications(
  database: DbClient,
  facilityId: number,
  task: TaskNotificationTask
): Promise<number> {
  const recipients = await getTaskNotificationRecipients(database, facilityId);
  if (recipients.length === 0) return 0;

  const message = composeTaskNotification(task);
  const config = smtpConfig();
  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from: config.from,
    to: "undisclosed-recipients:;",
    bcc: recipients.map((recipient) => recipient.email),
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return recipients.length;
}
