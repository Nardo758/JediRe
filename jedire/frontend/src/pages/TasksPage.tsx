import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskStats, CreateTaskInput } from '../types/task';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskModal } from '../components/tasks/TaskModal';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { api } from '../services/api';

const statusColumns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'blocked', label: 'Blocked', color: 'bg-red-100' },
  { id: 'done', label: 'Done', color: 'bg-green-100' },
];

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, [filters]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks', { params: filters });
      setTasks(response.data.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/tasks/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateTask = async (taskData: CreateTaskInput) => {
    try {
      await api.post('/tasks', taskData);
      await loadTasks();
      await loadStats();
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const handleUpdateTask = async (taskId: number, updates: Partial<Task>) => {
    try {
      await api.patch(`/tasks/${taskId}`, updates);
      await loadTasks();
      await loadStats();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      await handleUpdateTask(draggedTask.id, { status: newStatus });
    }
    setDraggedTask(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const tasksByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="text-gray-600 mt-1">Manage all your action items across deals</p>
          </div>
          <button
            onClick={() => {
              setSelectedTask(undefined);
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Create Task
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">Total</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">To Do</div>
              <div className="text-2xl font-bold text-gray-600">{stats.byStatus.todo}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">In Progress</div>
              <div className="text-2xl font-bold text-blue-600">{stats.byStatus.in_progress}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">Overdue</div>
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-1">Due Today</div>
              <div className="text-2xl font-bold text-orange-600">{stats.dueToday}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <TaskFilters filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {statusColumns.map((column) => (
          <div
            key={column.id}
            className="bg-white rounded-lg shadow-sm"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={`${column.color} px-4 py-3 rounded-t-lg`}>
              <h2 className="font-semibold text-gray-900 flex items-center justify-between">
                <span>{column.label}</span>
                <span className="bg-white px-2 py-0.5 rounded-full text-sm">
                  {tasksByStatus[column.id]?.length || 0}
                </span>
              </h2>
            </div>

            {/* Column Content */}
            <div className="p-4 min-h-[500px]">
              {loading ? (
                <div className="text-center text-gray-500 py-8">Loading...</div>
              ) : tasksByStatus[column.id]?.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  No tasks
                </div>
              ) : (
                tasksByStatus[column.id]?.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={handleTaskClick}
                    draggable
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(undefined);
        }}
        onSubmit={selectedTask
          ? async (data) => await handleUpdateTask(selectedTask.id, data)
          : handleCreateTask
        }
        task={selectedTask}
      />
    </div>
  );
};
