import nodemailer from "nodemailer";

// ---------- Transporter (lazy-initialised) ----------

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

// ---------- Shared HTML shell ----------

function htmlShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduConnect</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">EduConnect</h1>
              <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Connected Learning Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                You're receiving this email because you have an account on EduConnect.<br/>
                © ${new Date().getFullYear()} EduConnect. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------- Template helpers ----------

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#64748b;font-weight:600;width:130px;">${label}</td>
    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${value}</td>
  </tr>`;
}

// ---------- Public API ----------

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

/** Fire-and-forget wrapper — never throws. Returns true on success. */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[email] SMTP not configured — skipping email to",
        Array.isArray(opts.to) ? opts.to.join(", ") : opts.to
      );
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

// ---------- Pre-built templates ----------

/** Welcome email sent right after signup */
export function buildWelcomeEmail(opts: {
  name: string;
  email: string;
  role: string;
  dashboardUrl: string;
}): string {
  const roleLabel = opts.role === "teacher" ? "Teacher 🧑‍🏫" : "Student 🎓";
  return htmlShell(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">Welcome to EduConnect, ${opts.name}! 🎉</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Your account has been successfully created. Here are your details:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
      <tbody>
        ${infoRow("Name", opts.name)}
        ${infoRow("Email", opts.email)}
        ${infoRow("Account Type", roleLabel)}
      </tbody>
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
      Keep your login credentials safe. You can now explore your dashboard, join or create subjects, and start learning or teaching.
    </p>
    ${ctaButton("Go to Dashboard", opts.dashboardUrl)}
  `);
}

/** Class scheduled email sent to enrolled students */
export function buildClassScheduledEmail(opts: {
  studentName: string;
  subjectName: string;
  teacherName: string;
  classTitle: string;
  startsAt: string;
  durationMin: number;
  classesUrl: string;
}): string {
  return htmlShell(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">New Class Scheduled 📅</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${opts.studentName}, a new live class has been scheduled in <strong>${opts.subjectName}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
      <tbody>
        ${infoRow("Class", opts.classTitle)}
        ${infoRow("Subject", opts.subjectName)}
        ${infoRow("Teacher", opts.teacherName)}
        ${infoRow("Scheduled At", opts.startsAt)}
        ${infoRow("Duration", `${opts.durationMin} minutes`)}
      </tbody>
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
      Join a few minutes early using the link in the Classes tab.
    </p>
    ${ctaButton("View Classes", opts.classesUrl)}
  `);
}
