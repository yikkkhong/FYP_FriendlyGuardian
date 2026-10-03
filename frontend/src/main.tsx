import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import AppCompanionBackup from "./archive/App_CompanionBackup";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    {/* <AppCompanionBackup /> */}
  </React.StrictMode>,
);
