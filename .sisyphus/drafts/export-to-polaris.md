# Draft: Export to Polaris Feature

## Project Overview
- **Project**: Polaris (ZapDev) - AI-powered browser-based IDE
- **Tech Stack**: Next.js 16, React 19, Convex (real-time DB), TypeScript
- **Current State**: GitHub export functionality already implemented

## Current Export Capabilities

### GitHub Export (Already Implemented)
**Files:**
- `convex/githubExports.ts` - Convex mutations/queries for GitHub export
- `src/modules/projects/ui/components/github-export-modal.tsx` - UI modal
- `src/modules/projects/ui/components/github-export-button.tsx` - Button component
- `src/app/api/projects/[projectId]/export/github/route.ts` - API route

**Features:**
- Export to new or existing GitHub repository
- Choose branch (create new or use existing)
- Custom commit message
- Include README (auto-generated)
- Include .gitignore (framework-specific)
- Track export status in database
- Shows commit SHA and file count after export

**Database Schema:**
- `githubExports` table tracks export history
- Status enum: pending, processing, complete, failed
- Stores repository URL, branch, commit SHA

## Data Model

### Projects
- Stored in Convex `projects` table
- Fields: name, userId, framework, databaseProvider, modelPreference, createdAt, updatedAt

### Files
- Files are stored in `fragments` table (linked to messages)
- Files stored as Record<string, string> (path → content)
- Latest fragment files are what gets exported

### Import (Already Exists)
- `imports` table for importing from GitHub/Figma
- `importSourceEnum`: FIGMA, GITHUB
- Status tracking: PENDING, PROCESSING, COMPLETE, FAILED

## Clarification Received

**User's Goal**: Export projects FROM ZapDev (no-code AI platform) TO Polaris (AI IDE for experienced developers)

This is a funnel strategy:
- **ZapDev** (zapdev.link) = No-code platform for beginners/non-technical users to generate apps with AI
- **Polaris** = AI IDE for experienced developers who want to write/edit code directly
- **Export Flow**: User creates in ZapDev → Exports to Polaris for advanced editing

## Decisions Made

### Architecture: **Separate Everything**
- ZapDev and Polaris are completely separate apps/deployments
- No shared database or codebase
- Need API-based integration between them

### User Experience: **Export with Redirect**
1. User clicks "Export to Polaris" in ZapDev
2. Shows progress/status while exporting
3. Automatically redirects to Polaris when ready
4. Opens the newly imported project in Polaris

### Data Scope: **Everything Including Chat History**
Transfer to Polaris:
- ✅ Generated code files (from fragments)
- ✅ Project settings (framework, database provider, etc.)
- ✅ Full conversation/message history
- ✅ Message attachments (images, Figma files)
- ✅ Project metadata (name, created date)

### Export Strategy: **One-Way Fork**
- ZapDev → Polaris only (not bidirectional)
- Creates independent copy in Polaris
- ZapDev project remains unchanged
- User continues working in Polaris from that point

## Technical Design

### Data Flow
```
ZapDev                          Polaris
   |                                |
   |-- 1. Initiate Export --------->|
   |   (POST /api/export/import)    |
   |                                |
   |<-- 2. Return Import Token -----|
   |                                |
   |-- 3. Transfer Project Data --->|
   |   (POST /api/export/project)   |
   |   - Files                      |
   |   - Messages                   |
   |   - Settings                   |
   |                                |
   |<-- 4. Return Project URL ------|
   |                                |
   |-- 5. Redirect User ----------->|
   |   (to Polaris project URL)     |
```

### API Design

**ZapDev Side (Export):**
- `POST /api/polaris/export` - Initiate export
- Export progress tracking in ZapDev DB
- Background job to transfer data

**Polaris Side (Import):**
- `POST /api/import/zapdev` - Receive imported project
- Create project, messages, fragments in Polaris DB
- Return new project ID/URL

### Authentication
Option 1: **API Keys**
- ZapDev has Polaris API key
- Simple but no user identity transfer

Option 2: **User Account Linking**
- Users have accounts on both platforms
- OAuth or token-based user mapping
- Better UX but more complex

Option 3: **Temporary Transfer Token**
- ZapDev generates temporary token
- Polaris creates account/project from token
- Email-based claim if no existing account

### Database Changes Needed

**Polaris Side:**
- Add `source` field to projects table (zapdev, github, direct)
- Add `sourceId` field to track original ID
- Add `importedAt` timestamp
- Maybe `importMetadata` object for extra info

### UI Components Needed

**ZapDev Side:**
- "Export to Polaris" button (in project card/menu)
- Export progress modal/dialog
- Success state with redirect countdown
- Error handling with retry

**Polaris Side:**
- Handle import API endpoint
- Maybe "Imported from ZapDev" badge on projects
- Welcome/onboarding for imported projects

## Open Questions for Metis Review

## Potential Export Destinations

Based on StackBlitz/CodeSandbox patterns:
1. **GitHub** - ✅ Already implemented
2. **ZIP Download** - Download project as .zip file
3. **Vercel** - Deploy directly to Vercel
4. **Netlify** - Deploy directly to Netlify (partially exists via deployments table)
5. **CodeSandbox** - Export to CodeSandbox
6. **StackBlitz** - Export to StackBlitz
7. **GitLab** - Export to GitLab
8. **Bitbucket** - Export to Bitbucket

## Research Findings

### StackBlitz Export Options
- Fork to GitHub
- Download as ZIP
- Shareable URLs (already have preview URLs)

### CodeSandbox Export Options
- Export to GitHub
- Download as ZIP
- Deploy to Vercel/Netlify
- Create template

## Technical Considerations

### For ZIP Export
- Use JSZip library to create archive client-side
- Filter files (exclude AI metadata, system files)
- Include README and .gitignore options
- Trigger browser download

### For Platform Exports (Vercel, etc.)
- OAuth integration required
- API endpoints for deployment
- Status tracking similar to GitHub export

### For Import (if that's what's needed)
- Already have GitHub import framework
- Could extend to support ZIP upload
- GitLab/Bitbucket APIs similar to GitHub

## Next Steps

1. Get clarification from user on exact requirements
2. Determine export source and destination
3. Choose implementation approach
4. Create detailed work plan

## Notes

- Polaris already has a deployment feature (deployments table) for Netlify
- GitHub import/export is mature and can serve as template
- File filtering logic already exists in `filterFilesForDownload`
- Default files logic exists in `withDefaultFiles`
