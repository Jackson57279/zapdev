# Spec Mode Implementation for GPT-5.1 Codex

## Overview
Successfully implemented a **spec/planning mode** that enables AI to perform detailed reasoning and planning before code execution, specifically for the GPT-5.1 Codex model. This feature shows users a nice planning UI with approval/rejection flow.

## Implementation Date
November 16, 2025

## Key Features

### 1. Planning Mode with Reasoning
- AI generates a comprehensive specification before writing code
- Deep reasoning about requirements, architecture, and implementation
- Markdown-formatted spec with clear sections (Requirements, Technical Approach, Implementation Plan, Challenges)
- Only available for GPT-5.1 Codex model to leverage its superior reasoning capabilities

### 2. User Approval Flow
- **Planning State**: Animated loading with "🤔 Planning your project..."
- **Awaiting Approval State**: Beautifully rendered markdown spec with:
  - Approve button: "Looks good, start building"
  - Reject button: "Revise spec" with feedback textarea
- **Approved State**: Confirmation that code generation has started
- **Rejected State**: AI revises based on user feedback

### 3. Enhanced Code Generation
- When approved, the spec content is injected into the code agent's prompt
- Ensures generated code follows the approved architecture and plan
- More predictable and aligned results

## Files Created

### Database Schema
- **`convex/schema.ts`**: Added new fields to messages table:
  - `specMode`: PLANNING | AWAITING_APPROVAL | APPROVED | REJECTED
  - `specContent`: Markdown spec from AI
  - `selectedModel`: Track which model was used
  - Also added `specModeEnum` export

### Backend (Convex)
- **`convex/specs.ts`**: New mutations for spec management
  - `updateSpec()`: Update spec content and status
  - `approveSpec()`: Mark spec as approved and return data for code generation
  - `rejectSpec()`: Mark spec as rejected with user feedback
  - `getSpec()`: Query spec for a message

### Backend (Inngest)
- **`src/inngest/functions.ts`**: 
  - Added `specPlanningAgentFunction`: New Inngest function for spec generation
  - Added `extractSpecContent()`: Helper to extract spec from `<spec>` tags
  - Updated `codeAgentFunction`: Enhanced to check for approved specs and inject them into prompts
  - Imports SPEC_MODE_PROMPT

### Prompts
- **`src/prompts/spec-mode.ts`**: Comprehensive prompt for spec planning
  - Requirements Analysis section
  - Technical Approach section
  - Implementation Plan section
  - Technical Considerations (performance, accessibility, responsive design)
  - Potential Challenges section
  - Instructs AI to wrap output in `<spec>...</spec>` tags

- **`src/prompt.ts`**: Added SPEC_MODE_PROMPT export

### UI Components
- **`src/modules/projects/ui/components/spec-planning-card.tsx`**: Main spec UI component
  - Handles all 4 states (Planning, Awaiting Approval, Approved, Rejected)
  - Uses `react-markdown` for beautiful rendering
  - Custom markdown components for better styling
  - Feedback textarea for rejections
  - Calls approval/rejection mutations
  - Triggers appropriate Inngest events

- **`src/modules/projects/ui/components/message-card.tsx`**: Updated to render SpecPlanningCard
  - Added `messageId`, `specMode`, `specContent` props
  - Passes props to AssistantMessage component
  - Conditionally renders SpecPlanningCard

- **`src/modules/projects/ui/components/messages-container.tsx`**: Pass spec data to MessageCard
  - Added `specMode` and `specContent` to MessageCard props

- **`src/modules/projects/ui/components/message-form.tsx`**: Spec mode toggle
  - Added SparklesIcon import
  - Added `specModeEnabled` state
  - Shows spec mode toggle only when GPT-5.1 Codex is selected
  - Auto-disables spec mode when switching to other models
  - Passes `specMode` flag to Inngest trigger
  - Passes `selectedModel` to message creation

### API Routes
- **`src/app/api/inngest/trigger/route.ts`**: Route spec vs code agent
  - Extracts `messageId`, `specMode`, `isSpecRevision`, `isFromApprovedSpec` from body
  - Routes to `spec-agent/run` when spec mode enabled and not from approved spec
  - Routes to normal `code-agent/run` otherwise
  - Passes `messageId` and `isSpecRevision` to Inngest event

### Database
- **`convex/messages.ts`**: Updated message creation
  - Added `selectedModel` field to `create` mutation
  - Added `selectedModel` field to `createWithAttachments` action
  - Stores model choice with each message

## Dependencies Added
- **`react-markdown@10.1.0`**: For rendering markdown specs in the UI

## How It Works

### User Flow

```
1. User selects GPT-5.1 Codex model
   ↓
2. Spec Mode toggle appears in model menu
   ↓
3. User enables Spec Mode
   ↓
4. User enters request and submits
   ↓
5. spec-agent/run triggered → AI generates detailed spec
   ↓
6. Spec shown with "Approve" / "Reject" buttons
   ↓
7a. User Approves
    → code-agent/run triggered with spec in context
    → Code generation follows the approved plan
    
7b. User Rejects with feedback
    → spec-agent/run triggered with original request + feedback
    → AI revises spec based on feedback
    → Loop back to step 6
```

### Technical Flow

#### Spec Generation
1. User submits message with spec mode enabled
2. `createMessageWithAttachments` creates message with `selectedModel`
3. `/api/inngest/trigger` receives `specMode: true`
4. Routes to `spec-agent/run` event
5. `specPlanningAgentFunction` executes:
   - Updates message to `PLANNING` status
   - Detects framework (or uses existing)
   - Creates planning agent with GPT-5.1 Codex + SPEC_MODE_PROMPT + framework context
   - Generates comprehensive spec
   - Updates message to `AWAITING_APPROVAL` with spec content
6. UI shows SpecPlanningCard with rendered spec

#### Spec Approval
1. User clicks "Looks good, start building"
2. `approveSpec` mutation marks message as `APPROVED`
3. Returns project/message data to trigger code generation
4. `/api/inngest/trigger` called with `isFromApprovedSpec: true`
5. Routes to `code-agent/run` (normal code generation)
6. `codeAgentFunction` checks for approved spec:
   - Fetches current message
   - If `specMode === "APPROVED"`, injects spec into framework prompt
   - Enhanced prompt includes: "## IMPORTANT: Implementation Specification..."
7. Code agent generates code following the approved spec

#### Spec Rejection
1. User clicks "Revise spec" and provides feedback
2. `rejectSpec` mutation marks message as `REJECTED`
3. Returns feedback and original data
4. `/api/inngest/trigger` called with `isSpecRevision: true` and updated value
5. Routes to `spec-agent/run` again
6. AI regenerates spec with user feedback incorporated
7. Loop back to approval flow

## UI Design

### Color Coding
- **Planning**: Primary gradient with animated spinner
- **Awaiting Approval**: Primary border, prominent approve/reject buttons
- **Approved**: Green gradient with checkmark
- **Rejected**: Orange gradient with revision spinner

### Markdown Rendering
- Syntax-highlighted code blocks (black background, green text)
- Styled headings (h1, h2, h3)
- Proper list formatting (ul, ol)
- Inline code with primary color highlights
- Scrollable content (max height 96)

### Responsive Layout
- Cards adapt to mobile/tablet/desktop
- Buttons stack nicely on small screens
- Textarea resizes appropriately

## Benefits

1. **Better Planning**: GPT-5.1 Codex can reason deeply before coding
2. **User Control**: Review and approve before expensive code execution
3. **Cost Efficiency**: Avoid costly code rewrites by catching issues early
4. **Transparency**: See AI's thinking process and architectural decisions
5. **Iteration**: Refine spec before building, ensuring alignment
6. **Quality**: Generated code follows a reviewed and approved plan

## Future Enhancements (Not Implemented)

### Possible Additions
- Extend spec mode to other reasoning-capable models
- Save spec history for reference
- Export specs as documentation
- Estimate complexity/build time from spec
- Show spec diffs when revising
- Add spec templates for common app types
- Collaborative spec editing (team members can comment)

## Testing Recommendations

### Manual Testing Flow
1. **Enable Spec Mode**:
   - Select GPT-5.1 Codex model
   - Toggle "Spec Mode" on
   - Submit a request (e.g., "Build a todo app with authentication")

2. **Verify Planning State**:
   - Check for animated loading state
   - Confirm message shows "Planning your project..."

3. **Review Spec**:
   - Wait for spec generation to complete
   - Verify markdown renders correctly
   - Check all sections are present (Requirements, Technical Approach, etc.)
   - Ensure code blocks are syntax-highlighted

4. **Test Approval**:
   - Click "Looks good, start building"
   - Verify status changes to "Approved"
   - Confirm code generation starts
   - Check generated code aligns with spec

5. **Test Rejection**:
   - Click "Revise spec"
   - Enter feedback (e.g., "Add dark mode support")
   - Submit feedback
   - Verify AI revises spec with changes
   - Check feedback is incorporated

### Edge Cases to Test
- Switch models after enabling spec mode (should auto-disable)
- Multiple rapid spec rejections
- Very long specs (scrolling works)
- Network failures during spec generation
- Unauthorized access to spec mutations
- Missing or malformed spec content

## Known Limitations

1. **Model Restriction**: Only works with GPT-5.1 Codex (intentional design)
2. **No Streaming**: Spec generation doesn't stream (could be added)
3. **No History**: Previous specs aren't saved (could add versioning)
4. **Single Iteration**: Can only revise, not edit inline (could add rich editor)

## Migration Notes

- **Backward Compatible**: Existing messages without spec fields work normally
- **Opt-In**: Spec mode must be explicitly enabled
- **No Breaking Changes**: All existing flows continue to work
- **Database Migration**: Schema changes are additive (optional fields)

## Performance Considerations

- Spec generation adds ~10-30 seconds before code generation
- Uses GPT-5.1 Codex which may have higher latency than other models
- Markdown rendering is client-side (minimal server load)
- No impact on users not using spec mode

## Security Considerations

- All spec mutations check user authentication via `requireAuth`
- Project ownership verified before any spec operations
- Feedback is sanitized before being sent to AI
- No sensitive data exposed in specs (user-controlled content only)

## Deployment Checklist

- [x] Database schema updated (convex/schema.ts)
- [x] New mutations created (convex/specs.ts)
- [x] Inngest functions added (src/inngest/functions.ts)
- [x] UI components created (SpecPlanningCard, updated MessageCard/MessageForm)
- [x] API routes updated (api/inngest/trigger)
- [x] Dependencies installed (react-markdown)
- [x] Build successful
- [ ] Run Convex deployment: `bun run convex:deploy`
- [ ] Deploy to Vercel/production
- [ ] Monitor Inngest dashboard for spec-agent/run executions
- [ ] Test in production with real GPT-5.1 Codex API calls

## Support & Troubleshooting

### Spec not generating
- Check Inngest dashboard for `spec-agent/run` events
- Verify GPT-5.1 Codex is available in AI Gateway
- Check `messageId` is being passed correctly

### Approval not working
- Check browser console for mutation errors
- Verify user is authenticated
- Check Convex logs for mutation failures

### Code not following spec
- Verify spec content is being injected into prompt
- Check code agent logs for spec context
- Ensure `specMode === "APPROVED"` before code generation

## Documentation References

- Original Spec: `/home/dih/.factory/specs/2025-11-16-spec-mode-for-gpt-5-1-codex-with-planning-ui.md`
- Convex Docs: https://docs.convex.dev
- Inngest Docs: https://www.inngest.com/docs
- React Markdown: https://github.com/remarkjs/react-markdown

---

**Implementation Status**: ✅ Complete and Build-Tested
**Build Status**: ✅ Passing
**Ready for Deployment**: ✅ Yes (after `convex:deploy`)
