/**
 * Unit tests: pure functions, no database or HTTP.
 * (Everything else in tests/ is an integration test that goes through the real API.)
 */
import { describe, expect, it } from 'vitest';
import { invitationEmail, mentionEmail } from '../src/email/templates';
import { diffTask } from '../src/modules/tasks/taskHistory';
import { progressPercent } from '../src/utils/progress';

const before = {
  title: 'Design homepage',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: new Date('2030-01-15'),
  assignee: { id: 'u1', name: 'Sam' },
};

describe('diffTask (what goes into the task history)', () => {
  it('records only fields that actually changed', () => {
    expect(diffTask(before, { status: 'TODO', priority: 'HIGH', title: 'Design homepage' }, null)).toEqual([
      { field: 'priority', from: 'MEDIUM', to: 'HIGH' },
    ]);
  });

  it('returns nothing when nothing changed', () => {
    expect(diffTask(before, {}, null)).toEqual([]);
    expect(diffTask(before, { dueDate: new Date('2030-01-15') }, null)).toEqual([]);
  });

  it('stores due dates as calendar days', () => {
    expect(diffTask(before, { dueDate: new Date('2030-02-01') }, null)).toEqual([
      { field: 'dueDate', from: '2030-01-15', to: '2030-02-01' },
    ]);
  });

  it('stores assignee names (not ids) so the timeline stays readable', () => {
    expect(diffTask(before, { assigneeId: 'u2' }, 'Priya')).toEqual([{ field: 'assignee', from: 'Sam', to: 'Priya' }]);
    expect(diffTask(before, { assigneeId: null }, null)).toEqual([{ field: 'assignee', from: 'Sam', to: null }]);
    expect(diffTask(before, { assigneeId: 'u1' }, 'Sam')).toEqual([]);
  });
});

describe('email templates', () => {
  it('escapes user-written text in the HTML, so names and comments cannot inject markup', () => {
    const email = mentionEmail({
      to: 'sam@example.com',
      authorName: '<b>Alex</b>',
      taskTitle: 'Fix "quotes" & <tags>',
      comment: '<script>alert(1)</script>',
      link: 'http://localhost:3000/tasks/1',
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('&lt;b&gt;Alex&lt;/b&gt;');
    expect(email.html).toContain('Fix &quot;quotes&quot; &amp; &lt;tags&gt;');
  });

  it('puts the invitation link and the 24-hour expiry in the email', () => {
    const email = invitationEmail({
      to: 'new@example.com',
      inviterName: 'Alex',
      projectName: 'Launch',
      role: 'ADMIN',
      link: 'http://localhost:3000/invite/abc',
    });
    expect(email.subject).toBe('Alex invited you to "Launch" on TaskFlow');
    expect(email.text).toContain('http://localhost:3000/invite/abc');
    expect(email.text).toContain('as an admin');
    expect(email.text).toContain('expires in 24 hours');
  });
});

describe('progressPercent', () => {
  it('rounds to a whole number and handles empty projects', () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(2, 3)).toBe(67);
    expect(progressPercent(4, 4)).toBe(100);
  });
});
