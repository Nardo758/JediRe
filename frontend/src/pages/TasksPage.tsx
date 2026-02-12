import React, { useState, useEffect } from 'react';
import {
  Task,
  TaskFilters,
  TaskSortConfig,
  TaskStatus,
  TaskPriority,
} from '../types/task.types';
import { tasksService } from '../services/tasks.service';
import { TaskGrid } from '../components/tasks/TaskGrid';
import { TaskFiltersGrid } from '../components/tasks/TaskFiltersGrid';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';

export const TasksPage: React.FC = () => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [sort, setSort] = useState<TaskSortConfig>({ field: 'dueDate', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const TASKS_PER_PAGE = 50;

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const tasks = tasksService.getTasks(filters, sort);
    setFilteredTasks(tasks);
    setPage(1); // Reset to first page when filters change
  }, [filters, sort, allTasks]);

  const loadTasks = () => {
    const tasks = tasksService.getTasks();
    setAllTasks(tasks);
    setFilteredTasks(tasksService.getTasks(filters, sort));
  };

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
  const startIndex = (page - 1) * TASKS_PER_PAGE;
  const endIndex = startIndex + TASKS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Stats
  const stats = {
    total: allTasks.length,
    open: allTasks.filter((t) => t.status === 'open').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    blocked: allTasks.filter((t) => t.status === 'blocked').length,
    complete: allTasks.filter((t) => t.status === 'complete').length,
    overdue: allTasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== 'complete'
    ).length,
    dueToday: allTasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate).toDateString() === new Date().toDateString() &&
        t.status !== 'complete'
    ).length,
  };

  // Selection handlers
  const handleSelectTask = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTasks.map((t) => t.id)));
    }
  };

  // Bulk actions
  const handleBulkComplete = () => {
    if (confirm(`Mark ${selectedIds.size} tasks as complete?`)) {
      tasksService.bulkUpdateStatus(Array.from(selectedIds), 'complete');
      setSelectedIds(new Set());
      loadTasks();
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedIds.size} tasks? This cannot be undone.`)) {
      tasksService.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadTasks();
    }
  };

  const handleBulkPriority = (priority: TaskPriority) => {
    tasksService.bulkUpdatePriority(Array.from(selectedIds), priority);
    setSelectedIds(new Set());
    loadTasks();
  };

  const handleBulkAssign = () => {
    const users = tasksService.getAvailableUsers();
    const userId = prompt(
      `Assign to:\n${users.map((u, i) => `${i + 1}. ${u.name}`).join('\n')}\n\nEnter number:`
    );
    if (userId) {
      const index = parseInt(userId) - 1;
      if (index >= 0 && index < users.length) {
        tasksService.bulkAssign(Array.from(selectedIds), users[index] as any);
        setSelectedIds(new Set());
        loadTasks();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>🎯</span>
              <span>Global Tasks</span>
            </h1>
            <p className="text-gray-600 mt-1">
              Manage all your action items across deals and properties
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (
                  confirm(
                    'Reset all tasks to original mock data? Current data will be lost.'
                  )
                ) {
                  tasksService.resetToMockData();
                  loadTasks();
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              🔄 Reset Data
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <span className="text-xl">+</span>
              Create Task
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Open</div>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">In Progress</div>
            <div className="text-2xl font-bold text-purple-600">{stats.inProgress}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Blocked</div>
            <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Complete</div>
            <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Overdue</div>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Due Today</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.dueToday}</div>
          </div>
        </div>

        {/* Filters */}
        <TaskFiltersGrid filters={filters} onChange={setFilters} />

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-blue-900">
                {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                ✅ Mark Complete
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  More Actions ▼
                </button>
                {showBulkActions && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowBulkActions(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleBulkPriority('high');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          🔴 Set High Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkPriority('medium');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          🟡 Set Medium Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkPriority('low');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          ⚪ Set Low Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkAssign();
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          👤 Bulk Assign
                        </button>
                        <button
                          onClick={() => {
                            handleBulkDelete();
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          🗑️ Delete Selected
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <TaskGrid
        tasks={paginatedTasks}
        selectedIds={selectedIds}
        onSelectTask={handleSelectTask}
        onSelectAll={handleSelectAll}
        onTaskClick={(task) => setSelectedTask(task)}
        onSort={setSort}
        currentSort={sort}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} of{' '}
            {filteredTasks.length} tasks
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            loadTasks();
            // Refresh the selected task
            const updated = tasksService.getTask(selectedTask.id);
            if (updated) setSelectedTask(updated);
          }}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={() => {
          loadTasks();
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
};
