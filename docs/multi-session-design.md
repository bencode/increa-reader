# Multi-Session Management Design

## Background

Currently, the system can only maintain one chat session at a time. Users need to use the `/clear` command to clear the current session before starting a new conversation. However, in practice, learning and reading are often multi-threaded - users need to maintain multiple independent conversation contexts for different topics simultaneously.

## Requirements

- Support managing multiple independent chat sessions simultaneously
- Quick switching between different session contexts
- Session persistence - restore after page refresh
- Each session associated with an independent SDK session

## UI/UX Design

### Approach: Tab-based Multi-Session Management

#### UI Layout

```
┌─────────────────┬──────────────────────────────────────┐
│                 │ [Tab1] [Tab2] [Tab3] [More▼] [+]    │
│                 │ ─────────────────────────────────     │
│   Reading Area  │ Chat History...                      │
│                 │                                      │
│                 │ User Input Box                       │
└─────────────────┴──────────────────────────────────────┘
```

#### Core Interactions

1. **Tab Display**
   - Each tab shows session title (auto-generated from first message or user-defined)
   - Currently active tab is highlighted
   - Fixed tab width: 80-150px

2. **Create New Session**
   - Click `[+]` button to create new session
   - New session is automatically activated

3. **Switch Sessions**
   - Click tab to switch to corresponding session
   - Keyboard shortcut: `Cmd/Ctrl + 1/2/3...` to switch to Nth tab
   - Keyboard shortcut: `Cmd/Ctrl + T` to create new session
   - Keyboard shortcut: `Cmd/Ctrl + W` to close current session

4. **Close Session**
   - Close button displayed on tab (shown on hover)
   - Confirmation dialog before closing (prevent accidental closure)
   - Closed sessions can be restored from history

### Overflow Handling

When tab count exceeds visible area:

```
┌────────────────────────────────────────────────────┐
│ [OCR Model] [PDF Parse] [Architecture] [More(12)▼] [+]    │
│  *Active     Tab2        Tab3                      │
└────────────────────────────────────────────────────┘
```

#### "More" Dropdown Menu

```
┌─────────────────────────┐
│ 🔍 Search sessions...   │
├─────────────────────────┤
│ ✓ OCR Model             │ ← Currently active
│   PDF Parsing           │
│   Architecture Design   │
│ ─────────────────────── │
│   Data Flow Design      │
│   Type System           │
│   ...                   │
├─────────────────────────┤
│ 📋 View All History     │
└─────────────────────────┘
```

**Features:**
- Shows all sessions (including visible tabs)
- Supports search filtering
- Current active session marked with (✓)
- Recently used sessions appear first

### Enhanced Features

1. **Auto-naming**
   - Extract keywords from first user message as tab name
   - Users can manually edit tab name (double-click tab)

2. **Session Persistence**
   - Save all session state to localStorage
   - Auto-save on every state update
   - Auto-restore all tabs on page refresh
   - Restore last active tab

3. **Session Archive**
   - Save closed sessions to history
   - Restore archived sessions via "View All History"

4. **Quick Preview**
   - Hover tab to preview last few messages
   - Show session creation time and message count

5. **Session Grouping** (Optional, Future Enhancement)
   - Support tagging sessions (e.g., "OCR Research", "Architecture")
   - Support "pinning" important sessions to always show in tab bar

## Technical Design

### Data Structure

```typescript
type Session = {
  id: string                    // Unique identifier
  title: string                 // Session title
  messages: Message[]           // Chat history
  sdkSessionId: string          // SDK session ID
  createdAt: number             // Creation timestamp
  updatedAt: number             // Last update timestamp
}
```

### State Management

State will be managed locally within the chat component.

### SDK Session Management

Each UI session corresponds to an independent SDK session.

### Persistence Strategy

Sessions are persisted to localStorage for recovery after page refresh.

## Implementation Priorities

### P0 (Core Features)
- [ ] Tab bar UI component
- [ ] Create/switch/close sessions
- [ ] localStorage persistence
- [ ] SDK session binding

### P1 (UX Improvements)
- [ ] Auto-naming sessions
- [ ] Overflow handling ("More" dropdown)
- [ ] Close confirmation dialog
- [ ] Keyboard shortcuts

### P2 (Enhanced Features)
- [ ] Session search
- [ ] Session archive & restore
- [ ] Hover preview
- [ ] Manual title editing

### P3 (Future Enhancements)
- [ ] Session grouping/tagging
- [ ] Pin sessions
- [ ] Cross-device sync

## Reference Cases

- **Chrome/Edge Browser**: Tab overflow handling, keyboard shortcuts
- **VSCode**: Editor tab management, persistence
- **Slack/Discord**: Session list, search
