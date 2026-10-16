/**
 * Creates a small demo team with projects, tasks and some task history.
 * Safe to run more than once: the demo users (and everything they own) are recreated each time.
 *
 * All passwords: password123
 *   demo@taskflow.dev   Alex Morgan  owner of "Website Redesign", "Mobile App", "Customer Support Portal", "Q4 Planning";
 *                                    member of "Marketing Campaign"
 *   sam@taskflow.dev    Sam Lee      member of "Website Redesign" and "Mobile App"
 *   priya@taskflow.dev  Priya Shah   owner of "Marketing Campaign", admin of "Website Redesign",
 *                                    member of "Customer Support Portal"
 */
import { PrismaClient, type ProjectRole, type TaskPriority, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'password123';

const USERS = {
  alex: { name: 'Alex Morgan', email: 'demo@taskflow.dev' },
  sam: { name: 'Sam Lee', email: 'sam@taskflow.dev' },
  priya: { name: 'Priya Shah', email: 'priya@taskflow.dev' },
};
type UserKey = keyof typeof USERS;

/** A calendar date `offset` days from today (negative = in the past). */
function daysFromToday(offset: number): Date {
  const date = new Date(new Date().toISOString().slice(0, 10));
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type SeedTask = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueInDays: number;
  assignee: UserKey | null;
  createdBy: UserKey;
  /** [author, text, people mentioned] */
  comments?: [UserKey, string, UserKey[]][];
};

const projects: {
  name: string;
  description: string;
  members: Partial<Record<UserKey, ProjectRole>>;
  tasks: SeedTask[];
}[] = [
  {
    name: 'Website Redesign',
    description: 'Modernize the company website with a new design.',
    members: { alex: 'OWNER', sam: 'MEMBER', priya: 'ADMIN' },
    tasks: [
      {
        title: 'Design homepage',
        status: 'TODO',
        priority: 'HIGH',
        dueInDays: 2,
        assignee: 'sam',
        createdBy: 'alex',
        comments: [
          ['alex', '@Sam Lee please use the new brand colors for the hero section.', ['sam']],
          ['sam', '@Alex Morgan will do. I will share a first draft tomorrow.', ['alex']],
        ],
      },
      { title: 'Create wireframes', status: 'DONE', priority: 'MEDIUM', dueInDays: -6, assignee: 'sam', createdBy: 'alex' },
      {
        title: 'Implement UI',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueInDays: 5,
        assignee: 'alex',
        createdBy: 'alex',
        // Alex's own task, but he tags Sam: Sam can open it to read and reply.
        comments: [['alex', '@Sam Lee can you confirm the button styles match your wireframes?', ['sam']]],
      },
      { title: 'Write copy for About page', status: 'TODO', priority: 'LOW', dueInDays: -2, assignee: 'priya', createdBy: 'priya' },
      { title: 'Project setup', status: 'DONE', priority: 'LOW', dueInDays: -10, assignee: 'alex', createdBy: 'alex' },
      { title: 'Accessibility audit', status: 'TODO', priority: 'MEDIUM', dueInDays: 9, assignee: null, createdBy: 'alex' },
    ],
  },
  {
    name: 'Mobile App',
    description: 'iOS and Android companion application.',
    members: { alex: 'OWNER', sam: 'MEMBER' },
    tasks: [
      { title: 'Integrate APIs', status: 'IN_PROGRESS', priority: 'MEDIUM', dueInDays: 1, assignee: 'sam', createdBy: 'alex' },
      { title: 'Design system', status: 'DONE', priority: 'LOW', dueInDays: -4, assignee: 'alex', createdBy: 'alex' },
      { title: 'Push notifications', status: 'TODO', priority: 'MEDIUM', dueInDays: 14, assignee: null, createdBy: 'alex' },
      { title: 'App store screenshots', status: 'TODO', priority: 'LOW', dueInDays: -1, assignee: 'sam', createdBy: 'alex' },
    ],
  },
  {
    name: 'Customer Support Portal',
    description: 'Self-service help center for customers.',
    members: { alex: 'OWNER', priya: 'MEMBER' },
    tasks: [
      { title: 'Collect top 20 support questions', status: 'DONE', priority: 'MEDIUM', dueInDays: -5, assignee: 'priya', createdBy: 'alex' },
      { title: 'Write help articles', status: 'IN_PROGRESS', priority: 'MEDIUM', dueInDays: 3, assignee: 'priya', createdBy: 'alex' },
    ],
  },
  {
    name: 'Q4 Planning',
    description: 'Goals and budget for next quarter.',
    members: { alex: 'OWNER' },
    tasks: [
      { title: 'Draft OKRs', status: 'TODO', priority: 'HIGH', dueInDays: 8, assignee: 'alex', createdBy: 'alex' },
    ],
  },
  {
    name: 'Marketing Campaign',
    description: 'Launch campaign for the product release.',
    members: { priya: 'OWNER', alex: 'MEMBER' },
    tasks: [
      { title: 'Set up analytics', status: 'DONE', priority: 'LOW', dueInDays: -3, assignee: 'priya', createdBy: 'priya' },
      { title: 'Draft launch email', status: 'DONE', priority: 'MEDIUM', dueInDays: -1, assignee: 'alex', createdBy: 'priya' },
      { title: 'Social media plan', status: 'IN_PROGRESS', priority: 'HIGH', dueInDays: 2, assignee: 'alex', createdBy: 'priya' },
      { title: 'Press kit', status: 'TODO', priority: 'MEDIUM', dueInDays: 6, assignee: 'priya', createdBy: 'priya' },
    ],
  },
];

async function main() {
  const emails = Object.values(USERS).map((u) => u.email);

  // Remove previous demo data (projects first: they reference their creator).
  await prisma.project.deleteMany({ where: { createdBy: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids = {} as Record<UserKey, string>;
  for (const [key, user] of Object.entries(USERS)) {
    const created = await prisma.user.create({ data: { ...user, passwordHash } });
    ids[key as UserKey] = created.id;
  }

  for (const project of projects) {
    const creator = (Object.keys(project.members) as UserKey[]).find((key) => project.members[key] === 'OWNER')!;

    const { id: projectId } = await prisma.project.create({
      data: {
        name: project.name,
        description: project.description,
        createdById: ids[creator],
        members: {
          create: Object.entries(project.members).map(([key, role]) => ({ userId: ids[key as UserKey], role })),
        },
      },
    });

    for (const task of project.tasks) {
      const assigneeId = task.assignee ? ids[task.assignee] : null;
      const { id: taskId } = await prisma.task.create({
        data: {
          projectId,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: daysFromToday(task.dueInDays),
          assigneeId,
          createdById: ids[task.createdBy],
          createdAt: daysAgo(7),
          activities: {
            create: [
              { actorId: ids[task.createdBy], action: 'CREATED', createdAt: daysAgo(7) },
              // Give finished/started tasks a status change in their history.
              ...(task.status !== 'TODO'
                ? [
                    {
                      actorId: assigneeId ?? ids[task.createdBy],
                      action: 'UPDATED' as const,
                      changes: [{ field: 'status', from: 'TODO', to: task.status }],
                      createdAt: daysAgo(2),
                    },
                  ]
                : []),
            ],
          },
        },
      });

      for (const [index, [author, body, mentioned]] of (task.comments ?? []).entries()) {
        await prisma.taskComment.create({
          data: {
            taskId,
            authorId: ids[author],
            body,
            mentionedUserIds: mentioned.map((key) => ids[key]),
            createdAt: daysAgo(2 - index * 0.5),
          },
        });
      }
    }
  }

  console.log('Seeded demo users (password: password123):');
  for (const user of Object.values(USERS)) console.log(`  ${user.email}  (${user.name})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
