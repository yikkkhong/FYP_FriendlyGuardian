# Friendly Guardian AI Anti Scam

An AI-powered anti-scam assistant that helps users assess suspicious messages and images

## Features

- **Multi-Modal Verification**: Supports manual text queries, voice input, and image uploads.
- **Document & Invoice OCR**: Extracts text from suspicious invoices, payment slips, and screenshots using OCR.
- **Structured Threat Analysis**: Evaluates scam indicators and provides clear, actionable countermeasures (WHY & WHAT TO DO NEXT).
- **Session History**: Maintains individual check sessions in a clean sidebar view for easy review.

## System Architecture

### Frontend

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend Services**: Node.js (Express)
- **OCR Engine**: Python (PaddleOCR)
- **AI Core**: Groq API (LLM analysis), Qwen2.5-0.5B

## Getting Started

### 1. Frontend Setup

```bash
cd frontend
npm install
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. API Setup

1. Create a ".env" file in the backend/ folder

```bash
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
```

2. Go to https://console.groq.com/ to get an API key for free
3. Replace "your_groq_api_key_here" with tour API key

### Setting up Python Virtual Environment

```bash
cd backend\\python
python -m venv .venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

## Start the System

### 1. Start Frontend

```bash
cd frontend
npm run dev
```

### 2. Start Backend

```bash
cd backend
node server.js
```

### 3. Activate Python Virtual Environment (Optional)

**Note:** Activating the Python virtual environment is not required to run the system. Only activate it when you need to run Python scripts manually, such as for testing or debugging.

### 4. Open Website

On the computer running the frontend, open `http://localhost:5173/`.

To open it from a phone on the same Wi-Fi network:

1. Find the computer's local IPv4 address with `ipconfig` on Windows.
2. Start both the backend (`node server.js`) and frontend (`npm run dev`) on the computer.
3. On the phone, open `http://<computer-local-ip>:5173/` (for example, `http://192.168.1.23:5173/`).

The frontend proxies API, uploaded-file, and Socket.IO requests to the backend on port 5000. If the phone cannot connect, allow Node.js through the computer's firewall for private networks.

## Project Status

This project is currently in development. Some features are experimental or not yet implemented.
