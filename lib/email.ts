import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendInvitationEmail({
  to,
  inviterName,
  companyName,
  signUpUrl,
}: {
  to: string;
  inviterName: string;
  companyName: string;
  signUpUrl: string;
}) {
  const subject = `You've been invited to join ${companyName} on Cloud Timer`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0;">Cloud Timer</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
          You're invited!
        </h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
          <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Cloud Timer,
          a time tracking platform for teams.
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
          Create your account to get started. Make sure to sign up with this email address: <strong>${to}</strong>
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${signUpUrl}"
             style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Create Account
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
        Cloud Timer &mdash; cloudtimer.dk
      </p>
    </div>
  `;

  const fromEmail = process.env.RESEND_FROM_EMAIL || "Cloud Timer <onboarding@resend.dev>";
  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[EMAIL] Failed to send invitation:", error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  return data;
}
