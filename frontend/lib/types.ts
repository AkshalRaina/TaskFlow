// Shapes of the data returned by the TaskFlow API.

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

/** Just enough of a user to show a name/avatar. */
export type UserRef = { id: string; name: string };

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type Project = {
  id: string;
  name: string;
  description: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  myRole: ProjectRole;
  memberCount: number;
  totalTasks: number;
  doneTasks: number;
  progress: number;
};

export type Member = {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt: string;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  project: UserRef;
  assignee: UserRef | null;
  createdBy: UserRef;
};

export type FieldChange = { field: string; from: string | null; to: string | null };

export type Activity = {
  id: string;
  action: 'CREATED' | 'UPDATED';
  changes: FieldChange[];
  createdAt: string;
  actor: UserRef;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type DashboardStats = {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByStatus: Record<TaskStatus, number>;
  attention: { total: number; tasks: Task[] };
  /** Latest comments that @mention you. */
  mentions: Mention[];
};

export type InvitationStatus = 'pending' | 'expired' | 'accepted';

/** A pending invitation, as shown to project admins. */
export type Invitation = {
  id: string;
  email: string;
  role: ProjectRole;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  status: InvitationStatus;
};

/** What the invite page shows for a link (public). */
export type InvitationInfo = {
  email: string;
  role: ProjectRole;
  project: { name: string };
  invitedBy: string;
  expiresAt: string;
  status: InvitationStatus;
  accountExists: boolean;
};

export type JoinedProject = { project: { id: string; name: string }; role: ProjectRole };

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
  mentions: UserRef[];
};

export type Mention = {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
  task: { id: string; title: string; project: { name: string } };
};
