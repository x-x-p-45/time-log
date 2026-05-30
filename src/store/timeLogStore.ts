import { create } from 'zustand';
import { TimeLog, LogCategory, TimerSettings, RunningTimerCache } from '../types';
import { generateUUID } from '../utils/uuid';
import {
  initializeStorage,
  saveLogs,
  saveCategories,
  saveSettings,
  clearAllLogs as clearStorageLogs,
  loadLogs,
} from '../utils/storageHelper';

// ============================================================
// State
// ============================================================

interface TimeLogState {
  // 持久化数据
  logs: TimeLog[];
  categories: LogCategory[];
  settings: TimerSettings;

  // 运行时内存数据
  runningCache: RunningTimerCache | null;

  // 加载状态
  isLoaded: boolean;

  // ============================================================
  // Actions —— 初始化
  // ============================================================
  loadFromStorage: () => Promise<void>;

  // ============================================================
  // Actions —— 日志 CRUD
  // ============================================================
  addLog: (log: TimeLog) => Promise<void>;
  updateLog: (log: TimeLog) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  clearAllLogs: () => Promise<void>;

  // ============================================================
  // Actions —— 分类管理
  // ============================================================
  addCategory: (name: string, color: string) => Promise<void>;
  updateCategory: (id: string, name: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // ============================================================
  // Actions —— 设置
  // ============================================================
  toggleAutoTimer: (enabled: boolean) => Promise<void>;

  // ============================================================
  // Actions —— 运行时计时器（仅内存）
  // ============================================================
  startTimer: (cache: RunningTimerCache) => void;
  stopTimer: () => RunningTimerCache | null;
  getElapsedMs: () => number;
}

// ============================================================
// Store
// ============================================================

export const useTimeLogStore = create<TimeLogState>((set, get) => ({
  logs: [],
  categories: [],
  settings: { autoTimerEnabled: true },
  runningCache: null,
  isLoaded: false,

  // ============================================================
  // 初始化
  // ============================================================
  loadFromStorage: async () => {
    const data = await initializeStorage();
    set({
      logs: data.logs,
      categories: data.categories,
      settings: data.settings,
      isLoaded: true,
    });
  },

  // ============================================================
  // 日志 CRUD
  // ============================================================

  addLog: async (log: TimeLog) => {
    const { logs } = get();
    const newLogs = [log, ...logs];
    set({ logs: newLogs });
    await saveLogs(newLogs);
  },

  updateLog: async (log: TimeLog) => {
    const { logs } = get();
    const newLogs = logs.map((l) => (l.id === log.id ? log : l));
    set({ logs: newLogs });
    await saveLogs(newLogs);
  },

  deleteLog: async (id: string) => {
    const { logs } = get();
    const newLogs = logs.filter((l) => l.id !== id);
    set({ logs: newLogs });
    await saveLogs(newLogs);
  },

  clearAllLogs: async () => {
    set({ logs: [] });
    await clearStorageLogs();
  },

  // ============================================================
  // 分类管理
  // ============================================================

  addCategory: async (name: string, color: string) => {
    const { categories } = get();
    const newCategory: LogCategory = {
      id: generateUUID(),
      name,
      color,
      isDefault: false,
    };
    const newCategories = [...categories, newCategory];
    set({ categories: newCategories });
    await saveCategories(newCategories);
  },

  updateCategory: async (id: string, name: string, color: string) => {
    const { categories } = get();
    const newCategories = categories.map((c) =>
      c.id === id ? { ...c, name, color } : c
    );
    set({ categories: newCategories });
    await saveCategories(newCategories);
  },

  deleteCategory: async (id: string) => {
    const { categories, logs } = get();

    // 系统分类不可删除
    const target = categories.find((c) => c.id === id);
    if (!target || target.isDefault) return;

    // 移除分类
    const newCategories = categories.filter((c) => c.id !== id);

    // 将该分类下的日志迁移至默认"AI 对话"分类
    const defaultCategory = newCategories.find((c) => c.isDefault && c.name === 'AI 对话') ?? newCategories[0];
    const migratedLogs = logs.map((log) =>
      log.category.id === id
        ? { ...log, category: { ...defaultCategory }, updatedAt: Date.now() }
        : log
    );

    set({ categories: newCategories, logs: migratedLogs });
    await saveCategories(newCategories);
    await saveLogs(migratedLogs);
  },

  // ============================================================
  // 设置
  // ============================================================

  toggleAutoTimer: async (enabled: boolean) => {
    const newSettings: TimerSettings = { autoTimerEnabled: enabled };
    set({ settings: newSettings });
    await saveSettings(newSettings);
  },

  // ============================================================
  // 运行时计时器（仅内存，不持久化）
  // ============================================================

  startTimer: (cache: RunningTimerCache) => {
    // 同一时间仅允许一条运行计时
    const { runningCache } = get();
    if (runningCache) {
      // 自动结束上一条并保存
      const elapsed = Date.now() - runningCache.startTime;
      if (elapsed >= 1000) {
        const { categories, addLog } = get();
        const category = categories.find((c) => c.id === runningCache.categoryId) ?? categories[0];
        const log: TimeLog = {
          id: runningCache.id,
          title: runningCache.title,
          category,
          startTime: runningCache.startTime,
          endTime: Date.now(),
          duration: elapsed,
          note: '',
          isAuto: true,
          sourcePage: runningCache.sourcePage,
          createdAt: runningCache.startTime,
          updatedAt: Date.now(),
        };
        // 异步保存，不阻塞新计时启动
        addLog(log);
      }
    }
    set({ runningCache: cache });
  },

  stopTimer: () => {
    const { runningCache } = get();
    set({ runningCache: null });
    return runningCache;
  },

  getElapsedMs: () => {
    const { runningCache } = get();
    if (!runningCache) return 0;
    return Date.now() - runningCache.startTime;
  },
}));
