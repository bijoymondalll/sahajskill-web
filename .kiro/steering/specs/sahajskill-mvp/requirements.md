# Requirements Document: SahajSkill Dynamic Platform

## 1. Dynamic Class & Subject Architecture
- **REQ-1.1:** WHEN a student visits the dashboard, THE SYSTEM SHALL fetch all classes (`Class 11`, `Class 12`, etc.) dynamically from Turso DB.
- **REQ-1.2:** IF a class status is set to `COMING_SOON` by the Admin, THE SYSTEM SHALL display a locked Liquid Glass card with a badge and disable navigation until the Admin toggles it to `ACTIVE`.
- **REQ-1.3:** WHEN an Admin adds or edits a Class or Subject (e.g., ETIT, EDCA, Electrical, Civil) and uploads an icon, THE SYSTEM SHALL upload the image via the ImgBB API and store the returned CDN URL in Turso DB.

## 2. Smart Study Materials (Notes & Suggestions)
- **REQ-2.1:** WHEN an Admin pastes a Google Drive or GitHub PDF link under a Subject, THE SYSTEM SHALL automatically sanitize Google Drive `/view` links into `/preview` embed URLs.
- **REQ-2.2:** WHEN a student opens a Note or Exam Suggestion, THE SYSTEM SHALL render it inside an in-app glassmorphic iframe viewer without leaving the platform.

## 3. Live Classes & Video Hub
- **REQ-3.1:** WHEN an Admin sets a Live Class status to `LIVE`, THE SYSTEM SHALL display a pulsing "LIVE NOW" banner on the student dashboard with embedded YouTube Live or Google Meet launch support.

## 4. AI Doubt Solver (Custom Failover Router)
- **REQ-4.1:** WHEN a student submits a vocational question in Bengali or English, THE SYSTEM SHALL forward the prompt along with the Admin-configured `system_prompt` to the custom Cloudflare Worker Multi-API Router URL.

## 5. Gamified Mock Tests & Real-Time Leaderboard
- **REQ-5.1:** WHEN a student completes a timed MCQ Mock Test created by the Admin, THE SYSTEM SHALL evaluate scores, show explanations, and automatically increment the student's XP points on the global Leaderboard.

## 6. Force Update & Remote System Control
- **REQ-6.1:** WHEN the application initializes, THE SYSTEM SHALL compare `NEXT_PUBLIC_APP_VERSION` with `min_required_version` in Turso DB (`app_config`). IF `force_update_active` is `1` and the client version is outdated, THE SYSTEM SHALL block UI access with a full-screen Liquid Glass Force Update modal redirecting to the new update link.