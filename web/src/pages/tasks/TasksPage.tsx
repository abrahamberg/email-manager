import type { Task } from "../../domain/types";
import { formatDay } from "../../domain/format";
import { Empty, PageHeader } from "../../components/ui";
import { EmailLink } from "../../components/EmailMeta";
import { useAppData, useStore } from "../../state/StoreProvider";
import "./tasks.css";

function TaskRow({ task }: { task: Task }) {
  const { dispatch } = useStore();
  return (
    <li className="task" data-done={task.done}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => dispatch({ type: "task/toggle", id: task.id })}
        aria-label={`Mark "${task.title}" ${task.done ? "not done" : "done"}`}
      />
      <div className="stack-tight">
        <span className="title">{task.title}</span>
        <span className="muted small">
          From {task.email.from.name}: <EmailLink email={task.email} />
          {task.due && ` · due ${formatDay(task.due)}`}
        </span>
      </div>
    </li>
  );
}

function TaskList({ title, hint, tasks }: { title: string; hint: string; tasks: Task[] }) {
  return (
    <section className="stack">
      <div>
        <h2>{title}</h2>
        <p className="muted small">{hint}</p>
      </div>
      {tasks.length === 0 ? <Empty>Nothing here.</Empty> : (
        <ul className="card list">{tasks.map((task) => <TaskRow key={task.id} task={task} />)}</ul>
      )}
    </section>
  );
}

export function TasksPage() {
  const { tasks } = useAppData();
  const open = (owner: Task["owner"]) => tasks.filter((task) => task.owner === owner && !task.done);
  return (
    <>
      <PageHeader title="Tasks" subtitle="Mail that needs real work becomes a task here, linked to the email it came from." />
      <div className="stack-lg">
        <TaskList title="Mine" hint="Sorted by due date. Ticking one off can send the reply it needs." tasks={open("me")} />
        <TaskList title="Waiting on others" hint="I'll draft a nudge on Today if they go quiet." tasks={open("them")} />
        <TaskList title="Done" hint="Kept for 14 days." tasks={tasks.filter((task) => task.done)} />
      </div>
    </>
  );
}
