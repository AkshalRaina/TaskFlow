'use client';

import { MessageSquare, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/formErrors';
import type { Comment, UserRef } from '@/lib/types';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { ErrorMessage, Spinner } from './ui/Feedback';

type CommentsResponse = { data: Comment[]; mentionable: UserRef[] };

/** Comments under a task. Type "@" to tag someone; tagged people get an email. */
export function Comments({ taskId, canModerate }: { taskId: string; canModerate: boolean }) {
  const { user } = useAuth();
  const comments = useApi<CommentsResponse>(`/tasks/${taskId}/comments`);
  const [error, setError] = useState('');

  async function remove(comment: Comment) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api(`/tasks/${taskId}/comments/${comment.id}`, { method: 'DELETE' });
      comments.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // You can tag anyone who can see the task, except yourself.
  const mentionable = (comments.data?.mentionable ?? []).filter((person) => person.id !== user?.id);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        <MessageSquare size={18} /> Comments
        {comments.data && <span className="font-normal text-slate-400">· {comments.data.data.length}</span>}
      </h2>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      {comments.error ? (
        <ErrorMessage message={comments.error} onRetry={comments.reload} />
      ) : !comments.data ? (
        <Spinner />
      ) : (
        <>
          {comments.data.data.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">No comments yet. Start the conversation below.</p>
          ) : (
            <ul className="mb-6 space-y-4">
              {comments.data.data.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <Avatar user={comment.author} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-medium text-slate-900">{comment.author.name}</span>{' '}
                        <span className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</span>
                      </p>
                      {(comment.author.id === user?.id || canModerate) && (
                        <button
                          onClick={() => remove(comment)}
                          className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete comment"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                      <WithMentions text={comment.body} mentions={comment.mentions} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CommentComposer taskId={taskId} mentionable={mentionable} onPosted={comments.reload} />
        </>
      )}
    </div>
  );
}

/** Highlights "@Name" for each person who was tagged. */
function WithMentions({ text, mentions }: { text: string; mentions: UserRef[] }) {
  if (mentions.length === 0) return <>{text}</>;

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(@(?:${mentions.map((m) => escape(m.name)).join('|')}))`, 'g');

  return (
    <>
      {text.split(pattern).map((part, index) =>
        // split() with a capture group puts the matches at odd positions
        index % 2 === 1 ? (
          <span key={index} className="rounded bg-blue-50 px-1 font-medium text-blue-700">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

type ComposerProps = { taskId: string; mentionable: UserRef[]; onPosted: () => void };

function CommentComposer({ taskId, mentionable, onPosted }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  // People picked from the "@" list while writing this comment.
  const [tagged, setTagged] = useState<UserRef[]>([]);
  // The text typed after "@" (null when the suggestion list is closed).
  const [query, setQuery] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const suggestions =
    query === null ? [] : mentionable.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  function handleChange(value: string, caret: number) {
    setBody(value);
    // Is the caret right after "@something" (at the start, or after a space)?
    const match = value.slice(0, caret).match(/(?:^|\s)@(\w*)$/);
    setQuery(match ? match[1] : null);
    setHighlighted(0);
  }

  function pick(person: UserRef) {
    const textarea = textareaRef.current;
    if (!textarea || query === null) return;

    // Replace "@que" (just before the caret) with "@Full Name ".
    const caret = textarea.selectionStart;
    const start = caret - query.length - 1;
    const inserted = `@${person.name} `;
    const next = body.slice(0, start) + inserted + body.slice(caret);

    setBody(next);
    setTagged((current) => (current.some((p) => p.id === person.id) ? current : [...current, person]));
    setQuery(null);

    // Put the caret after the inserted name.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlighted((index) => (index + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(suggestions[highlighted]);
        return;
      }
      if (event.key === 'Escape') {
        setQuery(null);
        return;
      }
    }
    // Cmd/Ctrl + Enter posts the comment.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;

    // Only keep tags whose "@Name" is still in the text (the user may have deleted some).
    const mentionedUserIds = tagged.filter((person) => body.includes(`@${person.name}`)).map((person) => person.id);

    setPosting(true);
    setError('');
    try {
      await api(`/tasks/${taskId}/comments`, { method: 'POST', body: { body, mentionedUserIds } });
      setBody('');
      setTagged([]);
      onPosted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && <ErrorMessage message={error} />}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          rows={3}
          maxLength={2000}
          placeholder={mentionable.length > 0 ? 'Write a comment. Type @ to tag someone.' : 'Write a comment...'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          aria-label="Write a comment"
        />
        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 z-10 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
            {suggestions.map((person, index) => (
              <li key={person.id} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  // mousedown (not click) so the textarea doesn't lose the caret first
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(person);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${index === highlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <Avatar user={person} />
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Tagged people get an email. Ctrl/⌘ + Enter to post.</p>
        <Button type="submit" loading={posting} disabled={!body.trim()}>
          Comment
        </Button>
      </div>
    </form>
  );
}
