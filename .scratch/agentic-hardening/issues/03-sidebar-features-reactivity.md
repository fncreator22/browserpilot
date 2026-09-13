# Issue 03: Sidebar Features Reactivity & Lifecycle Alerts

Status: resolved
Role: ui-ux, discovery-engine
Blocked-by: 02

## Resolution
1. Dynamic source summary displayed in empty and partial search states.
2. Immediate refreshSearchHistory() on search completion with window events.
3. AutonomousWatchCard triggers background baseline scan via POST /api/discovery/run immediately upon watch creation.
4. UIStateProvider listens for global browserai: events and syncs notification and saved badges reactively.

## Symptom
User clicks search; Search History, Saved Opportunities, and Notifications do not update reactively. Autonomous watch clicks do not trigger immediate baseline scan.

## Scope
1. Dynamic source summary instead of hardcoded text in search results.
2. Immediate fetchSearchHistory() on search completion.
3. Trigger baseline scan on Autonomous Watch creation.
4. Reactively sync sidebar badges.
