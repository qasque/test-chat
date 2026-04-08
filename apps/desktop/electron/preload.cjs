const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("supportPortal", { version: "1.0.0" });
