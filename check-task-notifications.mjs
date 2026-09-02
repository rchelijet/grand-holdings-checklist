import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { createDbClient } from "./lib/db-client.ts";
import {
  composeTaskNotification,
  getTaskNotificationRecipients,
} from "./lib/task-notifications.ts";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["lib/task-notifications.ts", "u.role = 'manager'"],
  ["lib/task-notifications.ts", "u.access_all = 1"],
  ["lib/task-notifications.ts", "uf.facility_id IS NOT NULL"],
  ["lib/task-notifications.ts", "u.facility_id = ?"],
  ["lib/task-notifications.ts", "Created by"],
  ["lib/task-notifications.ts", "Expected completion"],
  ["php-site/inc/mail.php", "u.role = 'manager'"],
  ["php-site/inc/mail.php", "u.access_all = 1"],
  ["php-site/inc/mail.php", "uf.facility_id IS NOT NULL"],
  ["php-site/inc/mail.php", "u.facility_id = ?"],
  ["php-site/inc/mail.php", "function task_notification_html"],
  ["php-site/inc/mail.php", "Created by"],
  ["php-site/inc/mail.php", "Expected completion"],
  ["php-site/inc/mail.php", "stream_socket_enable_crypto"],
  ["php-site/index.php", "Task created, but manager email notifications could not be sent."],
  [".env.example", "SMTP_PASSWORD=replace-with-the-rotated-smtp-password"],
];

for (const [file, expected] of checks) {
  if (!read(file).includes(expected)) {
    throw new Error(`Missing notification check: ${expected} in ${file}`);
  }
}

if (/\n\s*mail\s*\(/.test(read("php-site/inc/mail.php"))) {
  throw new Error("PHP notifications must not call the insecure mail() transport.");
}

const client = createClient({ url: ":memory:" });
const database = createDbClient(client);
await database.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    role TEXT NOT NULL, facility_id INTEGER, access_all INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE user_facilities (user_id INTEGER NOT NULL, facility_id INTEGER NOT NULL);
`);
await database
  .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(1, "All properties", "all@example.com", "manager", null, 1, 1);
await database
  .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(2, "Legacy property", "legacy@example.com", "manager", 7, 0, 1);
await database
  .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(3, "Assigned property", "assigned@example.com", "manager", 8, 0, 1);
await database
  .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(4, "Other property", "other@example.com", "manager", 8, 0, 1);
await database.prepare("INSERT INTO user_facilities VALUES (?, ?)").run(3, 7);
await database
  .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(5, "Basic user", "basic@example.com", "basic", null, 1, 1);

const recipientIds = (await getTaskNotificationRecipients(database, 7)).map(({ id }) => id);
if (recipientIds.join(",") !== "1,2,3") {
  throw new Error(`Unexpected recipient selection: ${recipientIds.join(",")}`);
}

const message = composeTaskNotification({
  id: 99,
  facilityName: "Property <A>",
  title: "Fix & test",
  description: "Line 1",
  expectedDate: "2026-09-01",
  creatorName: "Manager",
  creatorEmail: "manager@example.com",
});
if (
  !message.subject.startsWith("New task") ||
  !message.html.includes("Property &lt;A&gt;") ||
  !message.html.includes("Fix &amp; test") ||
  !message.html.includes("manager@example.com")
) {
  throw new Error("Task notification composition check failed.");
}

console.log(`Passed ${checks.length + 3} task notification checks.`);
