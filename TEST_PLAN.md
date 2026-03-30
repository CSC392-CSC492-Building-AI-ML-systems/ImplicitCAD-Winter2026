# ImplicitCAD Studio — Full End-to-End Test Plan

This document is for QA verification of the `final-polish` branch. Start from a clean clone and work through each section in order.

---

## Prerequisites

- A machine with **Docker 20+** (with Docker Compose v2), **4 GB+ RAM**, **10 GB free disk**
- Internet access (for pulling Docker images and Ollama models)
- A modern browser (Chrome/Firefox/Edge)

---

## Part 1: Clone & Initial Setup

### TC1.1 Clone and configure
```bash
git clone https://github.com/CSC392-CSC492-Building-AI-ML-systems/ImplicitCAD-Winter2026.git
cd ImplicitCAD-Winter2026
git checkout final-polish
cp .env.example .env
```
**Verify:** `.env` file exists with documented defaults. No secrets are pre-filled.

### TC1.2 First-time setup via TUI
```bash
./studio.sh
```
1. Arrow-key to **"First-time setup"**, press Enter.
2. **Expected:**
   - Ollama check/install runs
   - Docker verified: `Docker found (XX.X.X)`
   - Docker Compose verified
   - Message: `Setup complete!`
   - Next steps printed (download a model, start Studio)

### TC1.3 Build & start services
1. From the TUI, select **"Start Studio"**.
2. **Expected:**
   - `docker compose up -d --build` runs (first build takes ~15-20 min)
   - All 3 services start
   - Browser auto-opens to `http://localhost:<dynamic-port>`
   - Studio UI loads with the code editor, 3D viewer, and AI chat panel

### TC1.4 Verify service health
1. From the TUI, select **"View status"**.
2. **Expected output (all green checkmarks):**
   - Docker Compose `ps` shows 3 running containers
   - `Server API: healthy (port 14000)`
   - `Frontend: reachable (port XXXXX)`
   - `ImplicitCAD engine: reachable (port 8080)`
   - Ollama status shown

---

## Part 2: Ollama Model Setup

### TC2.1 Download 0.8B test model
1. From the TUI, select **"Add 0.8B (test)"**.
2. **Expected:**
   - Pulls `qwen3.5:0.8b` (~1 GB download)
   - Creates `implicitcad-dev` app model
   - Message: `0.8B test model ready!`

### TC2.2 Download 9B production model (optional, ~6 GB)
1. From the TUI, select **"Add 9B (production)"**.
2. **Expected:**
   - Pulls from HuggingFace (retries up to 3 times if interrupted)
   - Creates `implicitcad-9b` app model
   - Message: `9B model ready!`

### TC2.3 Verify model in UI
1. In the browser, open the **AI Chat** panel.
2. Click the provider dropdown — select **Local Ollama**.
3. Click the model dropdown.
4. **Expected:** `implicitcad-dev` (and/or `implicitcad-9b`) appears in the model list.
5. Status indicator shows green dot + "Ready".

---

## Part 3: Advanced Tools (TUI)

### TC3.1 Shell into server container
1. TUI → **"Advanced tools"** → **"Shell into server"**
2. **Expected:**
   - Message: `Entering server container`
   - Tools listed: `$EXTOPENSCAD, admesh, node`
   - Shell prompt appears
3. Inside the container, run:
   ```bash
   "$EXTOPENSCAD" --help | head -3    # should print version/usage
   admesh --version                    # should print version
   node --version                      # should print v20.x.x
   ls /workspace                       # should list workspace files
   ```
4. Type `exit` to return.

### TC3.2 Shell into engine container
1. TUI → **"Advanced tools"** → **"Shell into engine"**
2. **Expected:**
   - Message: `Entering ImplicitCAD engine container`
   - Working directory: `/app`
3. Inside:
   ```bash
   extopenscad --help | head -3       # works (on PATH here)
   ls /app/log/                        # access.log, error.log exist
   ```
4. `exit` to return.

### TC3.3 Run smoke tests
1. TUI → **"Advanced tools"** → **"Run smoke tests"**
2. **Expected:**
   ```
   Testing: Simple cube                    PASS (XXXms, XXXXX bytes)
   Testing: Sphere                         PASS
   Testing: Cylinder with rotation         PASS
   Testing: Boolean difference             PASS
   Testing: Parametric                     PASS

   Results: 5 passed, 0 failed
   ```

### TC3.4 Compile a .scad file
1. Create a test file:
   ```bash
   echo 'cube([10,10,10]);' > /tmp/testcube.scad
   ```
2. TUI → **"Advanced tools"** → **"Compile .scad file"** → enter `/tmp/testcube.scad`
3. **Expected:** Output file created, message: `Output: /tmp/testcube.stl`
4. Verify: `ls -la /tmp/testcube.stl` — file exists, size > 0.

### TC3.5 Compile via CLI (hidden subcommand)
```bash
./studio.sh compile /tmp/testcube.scad -o /tmp/cli-output.stl
```
**Expected:** `/tmp/cli-output.stl` created.

### TC3.6 Compile from stdin
```bash
echo 'sphere(r=5);' | ./studio.sh compile - -o /tmp/sphere.stl
```
**Expected:** `/tmp/sphere.stl` created.

### TC3.7 Tail logs
1. TUI → **"Advanced tools"** → **"Tail service logs"**
2. **Expected:** Live Docker Compose log output streams. Press Ctrl+C to stop.

---

## Part 4: Frontend — Basic Functionality

### TC4.1 Code editor and compile
1. In the browser, type in the code editor: `cube([20,20,20]);`
2. Press **Cmd/Ctrl + Enter**.
3. **Expected:**
   - Output console shows: `Compiling...` then `Compiled (X.X KB, Y faces)`
   - 3D viewer renders a cube
   - No error toasts

### TC4.2 Auto-render on code change
1. Modify the code to `sphere(r=15);`
2. Wait ~1 second (debounce).
3. **Expected:** 3D viewer updates to show a sphere. Output console logs the compile.

### TC4.3 Viewport controls
1. Click **Front / Top / Iso** buttons in the viewer toolbar.
2. Toggle **XY / XZ / YZ** grid planes.
3. Toggle **W** for wireframe.
4. Click **Reset** to reset camera.
5. **Expected:** Each control works as labeled. Camera snaps to preset angles.

### TC4.4 STL export
1. With a model rendered, click **Download** (arrow-down icon) in viewer toolbar.
2. **Expected:** Browser downloads an `.stl` file.

### TC4.5 Keyboard shortcuts
| Shortcut | Expected Action |
|----------|----------------|
| Cmd/Ctrl + Enter | Compiles and renders |
| Cmd/Ctrl + S | Saves current file (if folder open) |
| Cmd/Ctrl + B | Toggles file explorer sidebar |
| Cmd/Ctrl + Shift + P | Opens command palette |

---

## Part 5: Frontend — Error Visibility

### TC5.1 Compile error shows toast + log
1. Paste invalid code: `this is not valid openscad!!!`
2. Press Cmd/Ctrl + Enter.
3. **Expected:**
   - **Toast** appears bottom-right: "Compilation failed" (red background, white text)
   - **Output console** shows: `Compile error: [error details]` in red
   - Error markers appear in the code editor

### TC5.2 Toast auto-dismisses after 8 seconds
1. Trigger a compile error (toast appears).
2. Wait 8 seconds.
3. **Expected:** Toast fades away automatically.

### TC5.3 Toast manual dismiss
1. Trigger a compile error.
2. Click the **X** button on the toast.
3. **Expected:** Toast closes immediately.

### TC5.4 Toast deduplication within 30s
1. Trigger a compile error → toast shows "Compilation failed".
2. Immediately trigger the same error again (within 30s).
3. **Expected:** Same toast updates to show "Compilation failed (2)" — no second toast created.

### TC5.5 Toast dedup resets after 30s
1. Trigger a compile error → toast appears.
2. Wait 31+ seconds (toast auto-dismisses after 8s, that's fine).
3. Trigger the same error again.
4. **Expected:** A fresh new toast appears (count resets to 1).

### TC5.6 Error badge on Output tab
1. Switch to a tab other than **Output** (e.g., click **Code** tab in the same zone).
2. Trigger a compile error.
3. **Expected:** A red pulsing dot appears next to the "Output" tab label.

### TC5.7 Error badge clears on tab click
1. With the red badge visible on the Output tab, click the **Output** tab.
2. **Expected:** Badge disappears immediately. Output console shows the error log.

### TC5.8 Error badge hidden when Output tab is already active
1. Make sure the Output tab is the active tab.
2. Trigger a compile error.
3. **Expected:** No badge appears (the user is already looking at the Output console).

### TC5.9 Connection error toast
1. Stop the server: `docker stop implicitcad-server`
2. Try to compile code in the browser.
3. **Expected:**
   - Toast: "Connection error — is the server running?" (red)
   - Output log: `Connection error: Failed to fetch`
4. **Cleanup:** `docker start implicitcad-server`

---

## Part 6: Frontend — AI Provider Error Handling

### TC6.1 Provider status polling (no toast spam)
1. Stop the server: `docker stop implicitcad-server`
2. Open the AI Chat panel.
3. Wait 60+ seconds (2 poll cycles at 30s each).
4. **Expected:**
   - Provider status indicator shows red dot + "Cannot reach server"
   - **NO toast notifications appear** (polling failures are silent, shown inline only)
   - Output console shows warning: "Failed to load AI provider config"
5. **Cleanup:** `docker start implicitcad-server`

### TC6.2 Provider switch failure shows toast
1. Stop the server: `docker stop implicitcad-server`
2. Try changing the provider dropdown (e.g., Ollama → OpenAI).
3. **Expected:**
   - **One toast appears:** "Failed to switch AI provider" (red)
   - Output console logs the error
   - Provider dropdown reverts / stays unchanged
4. **Cleanup:** `docker start implicitcad-server`

### TC6.3 Provider status recovers
1. With server stopped (showing "Cannot reach server"), start it: `docker start implicitcad-server`
2. Wait up to 30 seconds (next poll cycle).
3. **Expected:** Status indicator returns to green dot + "Ready" (or "Key set" for cloud providers).

### TC6.4 AI chat works end-to-end
1. Ensure Ollama is running with a model loaded.
2. Select the model in the Chat panel dropdown.
3. Type: "Create a simple cube" and press Enter.
4. **Expected:**
   - Typing indicator appears ("Generating code...")
   - AI response arrives with generated OpenSCAD code
   - "Apply to Editor" button available on the response
5. Click **"Apply to Editor"**.
6. **Expected:** Code appears in the editor as a diff review.

---

## Part 7: STL Export Error Handling

### TC7.1 Export with no model
1. Clear the editor (empty code), don't compile.
2. Click the **Download** button in the viewer toolbar.
3. **Expected:** Nothing happens (no crash, button may be disabled or silently no-op).

### TC7.2 Export failure toast
1. If export fails for any reason (e.g., geometry not available).
2. **Expected:** Toast: "Failed to export STL" (red). Logged to Output console.

---

## Part 8: Error Boundary

### TC8.1 App doesn't crash on normal use
1. Use the app normally for 5 minutes — edit code, compile, chat, switch tabs, drag panels.
2. **Expected:** No "Something went wrong" screen appears. App is stable.

### TC8.2 Error boundary recovery (if triggered)
1. If the error boundary ever appears:
   - **Expected UI:** Alert triangle icon, "Something went wrong", error message, "Reload Application" button.
   - Click **"Reload Application"**.
   - **Expected:** Page reloads, app returns to normal.

---

## Part 9: Cross-Platform & Deployment

### TC9.1 .env configuration works
1. Edit `.env`: set `SERVER_HOST_PORT=15000`
2. Run `docker compose down && docker compose up -d`
3. **Expected:** Server now accessible on port 15000 instead of 14000.
4. **Reset:** Change back to 14000.

### TC9.2 Vite dev server respects env
1. Stop Docker frontend: `docker stop implicitcad-frontend`
2. Create `frontend/.env.local` with:
   ```
   VITE_API_URL=http://localhost:14000
   VITE_RENDER_URL=http://localhost:8080
   ```
3. Run: `cd frontend && npm install --legacy-peer-deps && npm run dev`
4. **Expected:** Vite starts on port 3000, proxies work to Docker backends.

### TC9.3 Docker healthcheck
```bash
docker inspect implicitcad-server --format='{{.State.Health.Status}}'
```
**Expected:** `healthy` (after the 10s start period).

### TC9.4 Clean shutdown and restart
```bash
docker compose down
./studio.sh    # Select "Start Studio"
```
**Expected:** All services come back up. Frontend loads. Previous code restored from localStorage.

---

## Part 10: Final Checklist

| # | Check | Pass? |
|---|-------|-------|
| 1 | Clone + setup works from scratch | |
| 2 | TUI menu has 9 items including "Advanced tools" | |
| 3 | All 5 smoke tests pass | |
| 4 | Shell into server: `$EXTOPENSCAD`, `admesh`, `node` all work | |
| 5 | Shell into engine: `extopenscad`, logs accessible | |
| 6 | CLI compile produces valid STL | |
| 7 | Browser: code editor + 3D viewer work | |
| 8 | Browser: compile errors show toast + Output log | |
| 9 | Browser: toast auto-dismisses (8s error, 5s success) | |
| 10 | Browser: toast deduplicates within 30s | |
| 11 | Browser: Output tab shows red error badge when not active | |
| 12 | Browser: badge clears when Output tab viewed | |
| 13 | Browser: server offline → inline "Cannot reach server" (no toast spam) | |
| 14 | Browser: manual provider switch failure → one toast | |
| 15 | Browser: AI chat generates code and "Apply to Editor" works | |
| 16 | Docker healthcheck reports healthy | |
| 17 | `.env` port override works | |
| 18 | App stable under normal use (no error boundary triggered) | |
| 19 | `./studio.sh --help` or unknown flag shows usage | |
| 20 | README instructions match actual behavior | |
