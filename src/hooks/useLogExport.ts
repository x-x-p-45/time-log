import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTimeLogStore } from '../store/timeLogStore';
import { generateCSV, generateExportFileName } from '../utils/csvGenerator';

export function useLogExport() {
  const [isExporting, setIsExporting] = useState(false);
  const logs = useTimeLogStore((s) => s.logs);

  /**
   * 导出指定时间范围内的日志为 CSV 并唤起系统分享面板
   * @param startTime - 可选的时间范围起始时间戳
   * @param endTime - 可选的时间范围结束时间戳
   */
  const exportCSV = useCallback(
    async (startTime?: number, endTime?: number) => {
      if (logs.length === 0) {
        Alert.alert('无日志', '当前没有任何日志数据可以导出。');
        return;
      }

      setIsExporting(true);

      try {
        // 按时间范围筛选
        let exportLogs = logs;
        if (startTime !== undefined && endTime !== undefined) {
          exportLogs = logs.filter(
            (log) => log.startTime >= startTime && log.startTime <= endTime
          );
        }

        if (exportLogs.length === 0) {
          Alert.alert('无日志', '所选时间范围内没有日志数据。');
          setIsExporting(false);
          return;
        }

        // 生成 CSV 字符串
        const csvString = generateCSV(exportLogs);
        const fileName = generateExportFileName();

        // 使用 SDK 56 新版 API 写入文件
        const file = new File(Paths.document, fileName);
        file.write(csvString);
        const fileUri = file.uri;

        // 检查是否支持分享
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('不支持', '当前设备不支持文件分享功能。');
          setIsExporting(false);
          return;
        }

        // 唤起系统分享面板
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: '导出时间日志',
          UTI: 'public.comma-separated-values-text',
        });
      } catch (error) {
        console.error('[useLogExport] Export failed:', error);
        Alert.alert('导出失败', '导出过程中出现错误，请重试。');
      } finally {
        setIsExporting(false);
      }
    },
    [logs]
  );

  return { exportCSV, isExporting };
}

export default useLogExport;
