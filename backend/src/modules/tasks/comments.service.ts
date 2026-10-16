import { config } from '../../config';
import { prisma } from '../../db';
import { sendEmail } from '../../email/mailer';
import { mentionEmail } from '../../email/templates';
import { AppError, notFound } from '../../utils/AppError';
import { isManager, requireMember } from '../projects/projectAccess';
import { findOpenableTask } from './tasks.service';

/**
 * Anyone in the task's project can be @mentioned. Being mentioned lets a member open that task
 * to read and comment, even if it isn't assigned to them (see openableTasksWhere).
 */
async function mentionableUsers(task: { projectId: string }) {
  const members = await prisma.projectMember.findMany({
    where: { projectId: task.projectId },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return members.map((m) => m.user);
}

/** Comments (oldest first) plus who can be mentioned. */
export async function listComments(userId: string, taskId: string) {
  const task = await findOpenableTask(userId, taskId);

  const [comments, mentionable] = await Promise.all([
    prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    }),
    mentionableUsers(task),
  ]);

  // Turn stored mention ids into names, so the UI can highlight "@Name".
  const mentionedIds = [...new Set(comments.flatMap((c) => c.mentionedUserIds))];
  const mentionedUsers = await prisma.user.findMany({ where: { id: { in: mentionedIds } }, select: { id: true, name: true } });
  const nameById = new Map(mentionedUsers.map((u) => [u.id, u]));

  return {
    data: comments.map(({ mentionedUserIds, ...comment }) => ({
      ...comment,
      mentions: mentionedUserIds.map((id) => nameById.get(id)).filter(Boolean),
    })),
    mentionable: mentionable.map(({ id, name }) => ({ id, name })),
  };
}

export async function addComment(userId: string, taskId: string, body: string, mentionedUserIds: string[]) {
  const task = await findOpenableTask(userId, taskId);

  // You can only mention people in this project.
  const mentionable = await mentionableUsers(task);
  const mentioned = mentionable.filter((user) => mentionedUserIds.includes(user.id));
  if (mentioned.length !== new Set(mentionedUserIds).size) {
    throw new AppError(400, 'You can only mention people who are in this project');
  }

  const comment = await prisma.taskComment.create({
    data: { taskId, authorId: userId, body, mentionedUserIds: mentioned.map((u) => u.id) },
    include: { author: { select: { id: true, name: true } } },
  });

  // Email everyone mentioned (except yourself). A failed email doesn't fail the comment.
  const link = `${config.clientUrl}/tasks/${taskId}`;
  for (const user of mentioned.filter((u) => u.id !== userId)) {
    sendEmail(
      mentionEmail({ to: user.email, authorName: comment.author.name, taskTitle: task.title, comment: body, link }),
    ).catch((error) => console.error('Failed to send mention email:', error));
  }

  const { id, authorId, createdAt, author } = comment;
  return { id, taskId, authorId, body, createdAt, author, mentions: mentioned.map((u) => ({ id: u.id, name: u.name })) };
}

/** The author can delete their own comment; project owner/admins can delete any. */
export async function deleteComment(userId: string, taskId: string, commentId: string) {
  const task = await findOpenableTask(userId, taskId);
  const comment = await prisma.taskComment.findFirst({ where: { id: commentId, taskId } });
  if (!comment) throw notFound('Comment');

  const membership = await requireMember(userId, task.projectId);
  if (comment.authorId !== userId && !isManager(membership.role)) {
    throw new AppError(403, 'You can only delete your own comments');
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
}
