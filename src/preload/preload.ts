import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  openBookFile: () => ipcRenderer.invoke('open-book-file'),
  readBookFile: (path: string) => ipcRenderer.invoke('read-book-file', path),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  saveRecentFile: (entry) => ipcRenderer.invoke('save-recent-file', entry),
  getProgress: (bookId: string) => ipcRenderer.invoke('get-progress', bookId),
  saveProgress: (bookId: string, progress) => ipcRenderer.invoke('save-progress', bookId, progress),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme)
}

contextBridge.exposeInMainWorld('electronAPI', api)
