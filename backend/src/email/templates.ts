import type { Email } from './mailer';

/** Escapes text before putting it into HTML (names and comments come from users). */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function layout(bodyHtml: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <p style="font-size:20px;font-weight:bold;margin:0 0 16px">TaskFlow</p>
  ${bodyHtml}
</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p>`;
}

export function invitationEmail(params: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  link: string;
}): Email {
  const { to, inviterName, projectName, role, link } = params;
  const roleLabel = role === 'ADMIN' ? 'an admin' : 'a member';

  return {
    to,
    subject: `${inviterName} invited you to "${projectName}" on TaskFlow`,
    text: `${inviterName} invited you to join "${projectName}" as ${roleLabel}.\n\nAccept the invitation: ${link}\n\nThis link expires in 24 hours and can only be used once.`,
    html: layout(`
  <p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(projectName)}</strong> as ${roleLabel}.</p>
  ${button(link, 'Accept invitation')}
  <p style="color:#64748b;font-size:13px">This link expires in 24 hours and can only be used once.<br>If the button doesn't work, open: ${link}</p>`),
  };
}

export function mentionEmail(params: {
  to: string;
  authorName: string;
  taskTitle: string;
  comment: string;
  link: string;
}): Email {
  const { to, authorName, taskTitle, comment, link } = params;

  return {
    to,
    subject: `${authorName} mentioned you on "${taskTitle}"`,
    text: `${authorName} mentioned you in a comment on "${taskTitle}":\n\n"${comment}"\n\nOpen the task: ${link}`,
    html: layout(`
  <p>${escapeHtml(authorName)} mentioned you in a comment on <strong>${escapeHtml(taskTitle)}</strong>:</p>
  <blockquote style="border-left:3px solid #cbd5e1;margin:0;padding:8px 12px;color:#334155">${escapeHtml(comment)}</blockquote>
  ${button(link, 'Open task')}`),
  };
}
