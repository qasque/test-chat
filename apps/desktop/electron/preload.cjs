/** Зарезервировано под безопасный IPC при расширении функций */
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("supportPortal", { version: "1.0.0" });
