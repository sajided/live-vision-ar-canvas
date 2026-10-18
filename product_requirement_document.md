# Product Requirement Document (PRD)
## Project: Live Vision AR Canvas (Gemma-Powered)

---

## 1. Executive Summary
The **Live Vision AR Canvas** is a web-based, mobile-first augmented reality assistant. By combining a full-screen live camera stream with Gemma’s vision capabilities, the application enables users to point their camera at real-world objects, diagrams, circuits, or math equations, ask a question (via voice or snapshot), and receive step-by-step visual answers drawn dynamically directly onto their screen as reactive UI elements.

Rather than returning plain text or raw SVG paths, the system structures responses into a deterministic **JSON Component Registry**, rendering rich, interactive Tailwind-styled React components (beacons, animated connector lines, step-by-step callout cards) precisely over real-world coordinates.

---

## 2. Product Objectives & Success Metrics

### 2.1 Objectives
- Provide a zero-friction, camera-first multimodal experience in the browser.
- Deliver spatial, step-by-step visual annotations overlaid directly onto user environments.
- Ensure type-safe, resilient rendering by utilizing structured schema decoding over arbitrary code injection.

### 2.2 Key Performance Indicators (KPIs)
- **Time to First Stroke / Visual Response:** $< 2.5 \text{ seconds}$ from query trigger to initial overlay rendering.
- **JSON Schema Validation Rate:** $> 98\%$ valid completions parseable by Zod without fallback errors.
- **Task Completion Rate:** $> 85\%$ of users resolve their visual question without re-prompting.

---

## 3. User Personas & Use Cases

### 3.1 Primary Personas
1. **The STEM Student (Alex, 19):** Points their phone camera at complex textbook geometry problems or chemical structures to understand the intermediate derivation steps visually.
2. **The Hardware Maker / Hobbyist (Devon, 28):** Inspects microcontrollers, breadboards, and wiring harnesses to confirm pinouts and trace circuit connections hands-free.
3. **The Everyday Fixer (Sam, 42):** Diagnoses home appliance parts, car engine bays, or plumbing valves with real-time arrow indicators and explanations.

### 3.2 Key Use Cases
- **Spatial Pinpointing:** Identifying a specific port, switch, or button and drawing a callout beacon.
- **Route / Flow Tracing:** Illustrating the path of an electrical trace, liquid flow, or geometric line.
- **Step-by-Step Problem Solving:** Sequentially displaying cards and arrows explaining a multi-step procedure on an object.

---

## 4. System Architecture & Tech Stack

```
+--------------------------------------------------------------+
| Web Client (Next.js / Vite + React + Tailwind CSS)           |
|  - Fullscreen Camera Feed (<video> with object-fit: cover)    |
|  - Frame Capture (Offscreen Canvas, 768x768 normalization)    |
|  - Overlay Dispatcher (Framer Motion + Lucide Icons)          |
+------------------------------+-------------------------------+
                               | Frame + Prompt
                               v
+--------------------------------------------------------------+
| Edge API / Backend Service                                   |
|  - Prompt Assembly & Constrained JSON Schema                 |
|  - Multimodal Gemma Inference Engine                         |
|  - Zod Schema Validation & Fallback Guardrails               |
+------------------------------+-------------------------------+
                               | Validated JSON Schema
                               v
+--------------------------------------------------------------+
| React Component Registry                                     |
|  - TargetBeacon (Pinpoint marker + Pulse ring)               |
|  - ConnectorLine (Animated SVG stroke)                       |
|  - InfoCard (Step title + Body + Backdrop blur)              |
+--------------------------------------------------------------+
```

### 4.1 Frontend
- **Framework:** React 18+ (TypeScript) with Tailwind CSS.
- **Animation:** Framer Motion (for sequential stroke and card entry).
- **Media Capture:** WebRTC MediaStream API (`navigator.mediaDevices.getUserMedia`).
- **Input:** Web Speech API (`webkitSpeechRecognition`) + Touch Freeze/Capture triggers.

### 4.2 Backend & AI Engine
- **Model:** Multimodal Gemma (PaliGemma / Gemma Vision variants).
- **Format:** Structured JSON response adhering to a strict Zod contract.
- **Protocol:** HTTP POST with Server-Sent Events (SSE) or WebSockets for progressive overlay streaming.

---

## 5. Functional Requirements

### 5.1 Camera Viewfinder & Frame Acquisition
- **FR-1.1:** The app must automatically request rear-camera permissions (`facingMode: 'environment'`) on launch.
- **FR-1.2:** The video stream must fill the viewport without margins, letterboxing, or distortion (`object-fit: cover`).
- **FR-1.3:** The user can freeze the feed manually or upon query initiation to prevent misalignment due to hand shake.

### 5.2 Multimodal Query Triggering
- **FR-2.1:** **Hold-to-Talk:** Users can press and hold an on-screen microphone button to capture speech and snap the frame upon release.
- **FR-2.2:** **Snapshot & Type:** Users can tap a shutter icon and type a text query via a floating search bar.

### 5.3 Gemma JSON Component Registry
- **FR-3.1:** Gemma outputs must strictly follow the normalized 0–100% Cartesian coordinate grid schema:
  - `TargetBeacon`: `{ id, type, position: { x, y }, label, color }`
  - `ConnectorLine`: `{ id, type, from: { x, y }, to: { x, y }, variant, color }`
  - `InfoCard`: `{ id, type, position: { x, y }, title, body, stepIndex? }`
- **FR-3.2:** The frontend must parse all payloads through `ARResponseSchema.safeParse()`. If parsing fails, it must trigger a graceful retry or surface a compact error toast.

### 5.4 Overlay Presentation & Animations
- **FR-4.1:** SVG lines must render on a dedicated lower z-index layer below interactive HTML cards.
- **FR-4.2:** Elements must enter using staggered Framer Motion transitions (connectors draw via `pathLength`, beacons scale up, cards slide up).
- **FR-4.3:** Cards and beacons must feature a "Clear" and "Dismiss" action to restore an unhindered viewfinder.

---

## 6. Non-Functional Requirements

### 6.1 Performance & Latency
- Camera feed initialization must occur within $< 1.0 \text{ s}$ of permission grant.
- Offscreen image compression to WebP/JPEG (768×768 resolution, 0.8 quality) must take $< 100 \text{ ms}$.

### 6.2 Security & Data Privacy
- No persistent storage of raw camera frames on remote disks without explicit user opt-in.
- Strictly prohibited use of `eval()` or un-sanitized `dangerouslySetInnerHTML`; all output maps to pre-compiled React components.

### 6.3 Browser & Device Support
- Responsive across iOS Safari (15+), Android Chrome (100+), and modern desktop browsers (Chrome, Edge, Safari).

---

## 7. Release Milestones

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Foundation (Weeks 1–2)** | Viewfinder & Camera Rig | Fullscreen WebRTC feed, frame snapshotting, responsive viewport logic. |
| **Phase 2: Registry & Mocking (Weeks 3–4)** | UI Component Registry | Implementation of `TargetBeacon`, `ConnectorLine`, and `InfoCard` using Framer Motion and Zod validation. |
| **Phase 3: Gemma Integration (Weeks 5–6)** | Multimodal Backend Pipeline | Gemma vision inference integration, system prompt tuning for coordinate normalization, speech-to-text trigger. |
| **Phase 4: Optimization & Polish (Weeks 7–8)** | Calibration & Testing | Frame-freeze stabilization, haptic/audio feedback, edge-case handling, and mobile browser benchmarking. |

---

## 8. Open Questions & Future Considerations
1. **Spatial Tracking / ARCore WebXR:** Should we incorporate lightweight feature-point tracking (e.g., via WebXR or OpenCV.js) so annotations lock to physical coordinates when the phone moves?
2. **Offline Inference:** Can we provide a fallback for lightweight on-device WebGPU models when internet connectivity drops?