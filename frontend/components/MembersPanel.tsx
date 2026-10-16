'use client';

import { Check, Mail, Minus, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, ROLE_LABELS } from '@/lib/format';
import { errorMessage } from '@/lib/formErrors';
import type { Invitation, Member, ProjectRole } from '@/lib/types';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { RoleBadge } from './ui/Display';
import { ErrorMessage, Spinner } from './ui/Feedback';
import { Select } from './ui/FormFields';

type MembersPanelProps = {
  projectId: string;
  /** True for the project's owner and admins. */
  canManage: boolean;
  /** Called when membership changes (member count, or your own role). */
  onChanged: () => void;
};

/**
 * "Members & roles" tab.
 * Owner/admins invite people by email, change roles and remove members. Everyone can see the team.
 */
export function MembersPanel({ projectId, canManage, onChanged }: MembersPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const members = useApi<{ data: Member[] }>(`/projects/${projectId}/members`);
  const invitations = useApi<{ data: Invitation[] }>(canManage ? `/projects/${projectId}/invitations` : null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action: () => Promise<unknown>) {
    setError('');
    setNotice('');
    try {
      await action();
      members.reload();
      invitations.reload();
      onChanged();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  function changeRole(member: Member, role: ProjectRole) {
    run(() => api(`/projects/${projectId}/members/${member.userId}`, { method: 'PATCH', body: { role } }));
  }

  async function remove(member: Member) {
    const isSelf = member.userId === user?.id;
    const question = isSelf
      ? 'Leave this project? You will lose access to it.'
      : `Remove ${member.name} from this project? Their tasks here become unassigned.`;
    if (!window.confirm(question)) return;

    const ok = await run(() => api(`/projects/${projectId}/members/${member.userId}`, { method: 'DELETE' }));
    if (ok && isSelf) router.push('/projects');
  }

  async function invite(email: string, role: ProjectRole) {
    const ok = await run(() => api(`/projects/${projectId}/invitations`, { method: 'POST', body: { email, role } }));
    if (ok) setNotice(`Invitation sent to ${email}. The link expires in 24 hours.`);
    return ok;
  }

  function revoke(invitation: Invitation) {
    if (!window.confirm(`Cancel the invitation for ${invitation.email}? The link will stop working.`)) return;
    run(() => api(`/projects/${projectId}/invitations/${invitation.id}`, { method: 'DELETE' }));
  }

  return (
    <div className={canManage ? 'grid gap-6 lg:grid-cols-5' : 'max-w-3xl'}>
      <div className="space-y-4 lg:col-span-3">
        {error && <ErrorMessage message={error} />}
        {notice && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {notice}
          </p>
        )}

        {canManage && <InviteForm onInvite={invite} />}

        {canManage && invitations.data && invitations.data.data.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              Pending invitations <span className="font-normal text-slate-400">· {invitations.data.data.length}</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {invitations.data.data.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Mail size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{invitation.email}</p>
                    <p className={`text-xs ${invitation.status === 'expired' ? 'text-red-600' : 'text-slate-500'}`}>
                      {invitation.status === 'expired'
                        ? 'Link expired, send it again'
                        : `Invited by ${invitation.invitedBy} · expires ${formatDateTime(invitation.expiresAt)}`}
                    </p>
                  </div>
                  <RoleBadge role={invitation.role} />
                  <button
                    onClick={() => invite(invitation.email, invitation.role)}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => revoke(invitation)}
                    className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
            Team {members.data && <span className="font-normal text-slate-400">· {members.data.data.length}</span>}
          </h3>
          {members.error ? (
            <div className="p-4">
              <ErrorMessage message={members.error} onRetry={members.reload} />
            </div>
          ) : !members.data ? (
            <Spinner />
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.data.data.map((member) => {
                const isSelf = member.userId === user?.id;
                const isOwner = member.role === 'OWNER';
                return (
                  <li key={member.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar user={{ id: member.userId, name: member.name }} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {member.name} {isSelf && <span className="font-normal text-slate-400">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {member.email} · joined {formatDate(member.joinedAt)}
                      </p>
                    </div>
                    {/* The owner's role is fixed; owner/admins can switch others between Admin and Member. */}
                    {canManage && !isOwner ? (
                      <div className="w-28 shrink-0">
                        <Select
                          value={member.role}
                          onChange={(e) => changeRole(member, e.target.value as ProjectRole)}
                          aria-label={`Role of ${member.name}`}
                          className="py-1"
                        >
                          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                          <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                        </Select>
                      </div>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                    {!isOwner && (canManage || isSelf) && (
                      <button
                        onClick={() => remove(member)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        {isSelf ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Only the people who manage roles need the permissions overview. */}
      {canManage && <PermissionsTable />}
    </div>
  );
}

function InviteForm({ onInvite }: { onInvite: (email: string, role: ProjectRole) => Promise<boolean> }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const ok = await onInvite(email.trim(), role);
    setSending(false);
    if (ok) setEmail('');
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-semibold text-slate-900">Invite someone</h3>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          aria-label="Email address to invite"
        />
        <div className="sm:w-32">
          <Select value={role} onChange={(e) => setRole(e.target.value as ProjectRole)} aria-label="Role">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <Button type="submit" loading={sending}>
          <Send size={16} /> Send invite
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        We&apos;ll email them a link to join. It works once and expires in 24 hours. They can sign up from the link if they don&apos;t have an account.
      </p>
    </form>
  );
}

// [permission, owner, admin, member]
const PERMISSIONS: [string, boolean, boolean, boolean][] = [
  ['See the project and the team', true, true, true],
  ['See every task in the project', true, true, false],
  ['See tasks assigned to you', true, true, true],
  ['Change the status of your tasks', true, true, true],
  ['Comment and @mention on tasks', true, true, true],
  ['Create tasks for yourself, edit and delete them', true, true, true],
  ['Assign tasks to others', true, true, false],
  ['Edit or delete any task', true, true, false],
  ['Edit or delete the project', true, true, false],
  ['Invite people, change roles, remove members', true, true, false],
  ["Can't be removed or demoted", true, false, false],
];

function PermissionsTable() {
  const mark = (allowed: boolean) =>
    allowed ? <Check size={16} className="mx-auto text-green-600" aria-label="Yes" /> : <Minus size={16} className="mx-auto text-slate-300" aria-label="No" />;

  return (
    <div className="h-fit rounded-xl border border-slate-200 bg-white lg:col-span-2">
      <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">What each role can do</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="px-4 py-2 text-left font-medium">Permission</th>
            <th className="px-1 py-2 font-medium">Owner</th>
            <th className="px-1 py-2 font-medium">Admin</th>
            <th className="px-1 py-2 font-medium">Member</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {PERMISSIONS.map(([label, owner, admin, member]) => (
            <tr key={label}>
              <td className="px-4 py-2 text-slate-700">{label}</td>
              <td className="px-1 py-2">{mark(owner)}</td>
              <td className="px-1 py-2">{mark(admin)}</td>
              <td className="px-1 py-2">{mark(member)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-start gap-1 px-4 py-3 text-xs text-slate-500">
        <X size={12} className="mt-0.5 shrink-0" /> The owner is whoever created the project. People outside the project can&apos;t see it at all.
      </p>
    </div>
  );
}
