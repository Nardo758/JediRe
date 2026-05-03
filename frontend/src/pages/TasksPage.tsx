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
import { TaskCompletionReview } from '../components/tasks/TaskCompletionReview';
import { BT } from '@/components/deal/bloomberg-ui';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
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

  // Email completion handlers
  const handleApproveCompletion = (taskId: string, emailId: string, completionDate: string) => {
    // Mark task as complete
    tasksService.updateTask(taskId, {
      status: 'complete',
      completedAt: completionDate,
      source: {
        type: 'email',
        referenceId: emailId,
        sourceUrl: `/emails/${emailId}`,
      },
    });
    loadTasks();
  };

  const handleRejectCompletion = (taskId: string, emailId: string) => {
    // Just reload - rejection is logged on backend
    console.log(`Rejected completion suggestion for task ${taskId} from email ${emailId}`);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: BT.bg.terminal }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: BT.text.primary }}>
              <span>🎯</span>
              <span>Global Tasks</span>
            </h1>
            <p className="mt-1" style={{ color: BT.text.secondary }}>
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
              className="px-4 py-2 font-medium transition-colors"
              style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, background: BT.bg.panel }}
            >
              🔄 Reset Data
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 font-semibold flex items-center gap-2 transition-all"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
            >
              <span className="text-xl">+</span>
              Create Task
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-7 gap-4 mb-6">
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Total</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{stats.total}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Open</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.cyan }}>{stats.open}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>In Progress</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.purple }}>{stats.inProgress}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Blocked</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.red }}>{stats.blocked}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Complete</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.green }}>{stats.complete}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Overdue</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.red }}>{stats.overdue}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: BT.text.secondary }}>Due Today</div>
            <div className="text-2xl font-bold" style={{ color: BT.text.amber }}>{stats.dueToday}</div>
          </div>
        </div>

        {/* Email Intelligence - Task Completion Review */}
        <TaskCompletionReview
          onComplete={handleApproveCompletion}
          onReject={handleRejectCompletion}
          onRefresh={loadTasks}
        />

        {/* Filters */}
        <TaskFiltersGrid filters={filters} onChange={setFilters} />

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 p-4 flex items-center justify-between" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold" style={{ color: BT.text.cyan }}>
                {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm underline"
                style={{ color: BT.text.cyan }}
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkComplete}
                className="px-4 py-2 transition-colors text-sm font-medium"
                style={{ background: BT.text.green, color: BT.bg.terminal, borderRadius: 0 }}
              >
                ✅ Mark Complete
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-4 py-2 transition-colors text-sm font-medium"
                  style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, borderRadius: 0 }}
                >
                  More Actions ▼
                </button>
                {showBulkActions && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowBulkActions(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 z-20" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleBulkPriority('high');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm"
                          style={{ color: BT.text.secondary }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          🔴 Set High Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkPriority('medium');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm"
                          style={{ color: BT.text.secondary }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          🟡 Set Medium Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkPriority('low');
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm"
                          style={{ color: BT.text.secondary }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          ⚪ Set Low Priority
                        </button>
                        <button
                          onClick={() => {
                            handleBulkAssign();
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm"
                          style={{ color: BT.text.secondary }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          👤 Bulk Assign
                        </button>
                        <button
                          onClick={() => {
                            handleBulkDelete();
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm"
                          style={{ color: BT.text.red }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
        <div className="mt-6 flex items-center justify-between p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="text-sm" style={{ color: BT.text.secondary }}>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} of{' '}
            {filteredTasks.length} tasks
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, background: BT.bg.panel }}
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
                    className="px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      borderRadius: 0,
                      background: page === pageNum ? BT.text.cyan : 'transparent',
                      color: page === pageNum ? BT.bg.terminal : BT.text.secondary,
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, background: BT.bg.panel }}
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
