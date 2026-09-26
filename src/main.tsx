// Copyright (C) 2026 Chijok <chijok2311@outlook.com>
// SPDX-License-Identifier: GPL-3.0-only

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
