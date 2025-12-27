# Spec Mode Quick Start Guide

## What is Spec Mode?

Spec Mode is a new feature that makes GPT-5.1 Codex create a detailed implementation plan **before** writing any code. You get to review and approve (or revise) the plan, ensuring the AI builds exactly what you want.

## Why Use Spec Mode?

✅ **Better Results**: AI thinks through the architecture before coding  
✅ **Your Control**: Approve or request changes before code generation  
✅ **Save Credits**: Catch issues early, avoid costly rewrites  
✅ **Transparency**: See exactly what the AI plans to build  
✅ **Alignment**: Ensure the implementation matches your vision  

## How to Use

### Step 1: Enable Spec Mode

1. Click the **model icon** (bottom-left of message input)
2. Select **GPT-5.1 Codex**
3. Toggle **"Spec Mode"** ON
4. You'll see: _"AI will create a detailed plan for your approval before building"_

### Step 2: Submit Your Request

Type your project idea as usual:
```
Build a todo app with user authentication, dark mode, 
and the ability to share lists with other users
```

### Step 3: Wait for Planning

You'll see an animated card:
```
🤔 Planning Your Project
AI is analyzing your requirements and creating a detailed 
implementation plan...
```

This takes **10-30 seconds**.

### Step 4: Review the Spec

The AI will show you a detailed specification with:

#### 📋 Requirements Analysis
- Core features to implement
- User interactions and flows
- Data requirements
- Edge cases to handle

#### 🏗️ Technical Approach
- Component architecture
- State management strategy
- Styling approach
- Data flow patterns

#### 📝 Implementation Plan
- Step-by-step breakdown
- Components to create
- Dependencies needed
- Order of implementation

#### ⚠️ Potential Challenges
- Complex areas requiring attention
- Technical trade-offs
- Alternative approaches

### Step 5: Approve or Revise

**Option A: Approve ✅**
- Click **"Looks good, start building"**
- Code generation begins immediately
- AI follows the approved spec closely

**Option B: Revise 🔄**
- Click **"Revise spec"**
- Enter feedback (e.g., "Add dark mode support" or "Use Tailwind instead of CSS modules")
- AI regenerates the spec with your changes
- Review again until satisfied

## Example Workflow

### User Input:
```
Create a weather dashboard with current conditions and 5-day forecast
```

### AI Spec (Summary):
```markdown
# Specification: Weather Dashboard

## Requirements
- Display current weather (temp, conditions, humidity, wind)
- Show 5-day forecast with daily highs/lows
- Location search with autocomplete
- Responsive design (mobile, tablet, desktop)

## Technical Approach
- Next.js 15 with App Router
- Shadcn UI components (Card, Input, Button)
- Weather API integration (OpenWeatherMap or WeatherAPI)
- Client-side state for location selection
- Tailwind CSS for styling

## Implementation Plan
1. Create components/weather-card.tsx for current conditions
2. Create components/forecast-card.tsx for 5-day view
3. Implement API route app/api/weather/route.ts
4. Add location search with debounced input
5. Style with Tailwind, ensure responsive breakpoints

## Challenges
- API rate limiting: cache recent searches
- Location accuracy: validate coordinates
- Error handling: graceful fallback for failed requests
```

### User Feedback (If Revising):
```
Add hourly forecast for the next 24 hours
```

### Revised Spec Includes:
```markdown
+ Hourly forecast component (next 24 hours)
+ Updated API integration for hourly data
+ Scroll/carousel for hourly view on mobile
```

## When to Use Spec Mode

✅ **Use For:**
- Complex multi-feature apps
- Projects with specific architectural requirements
- When you want to validate the approach first
- Learning how to structure a project
- Important production code

❌ **Skip For:**
- Simple single-component tasks
- Quick prototypes where speed matters
- When you trust the default AI approach
- Tiny bug fixes or tweaks

## Tips for Best Results

### 1. Be Specific in Your Request
**Good:**
```
Build an e-commerce product page with image gallery, 
size/color selection, add to cart, and related products
```

**Too Vague:**
```
Make a product page
```

### 2. Mention Important Details
- Preferred libraries (e.g., "Use React Hook Form")
- Design style (e.g., "Minimalist, Airbnb-style")
- Special requirements (e.g., "Must be accessible")

### 3. Use Revision Effectively
**Good Feedback:**
```
Change the authentication to use email magic links 
instead of passwords
```

**Too Vague:**
```
Make it better
```

### 4. Review the Spec Carefully
- Check component names make sense
- Verify file structure aligns with framework conventions
- Ensure all features are covered
- Look for any missing error handling

## FAQ

**Q: Does spec mode cost extra credits?**  
A: No, you use 1 credit for the entire flow (spec + code generation).

**Q: Can I use spec mode with other models?**  
A: No, currently only GPT-5.1 Codex supports spec mode due to its superior reasoning capabilities.

**Q: What if I approve but don't like the code?**  
A: You can always chat with the AI to request changes after code generation. The spec just guides the initial implementation.

**Q: Can I see old specs?**  
A: Currently, specs are stored with each message. Future versions may add spec history.

**Q: How long does spec generation take?**  
A: Typically 10-30 seconds, depending on request complexity and model availability.

**Q: Can I edit the spec directly?**  
A: Not yet. You can only approve or reject with feedback. Inline editing may come in future versions.

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter` to submit request
- Model selection opens with click (no shortcut yet)

## Troubleshooting

### Spec Mode Toggle Doesn't Appear
- Make sure you've selected **GPT-5.1 Codex** model
- Refresh the page if model menu doesn't update

### Spec Generation Stuck
- Check your internet connection
- Wait up to 60 seconds (model might be slow)
- If still stuck, refresh and try again

### Approval Button Not Working
- Check browser console for errors
- Make sure you're logged in
- Try refreshing the page

### Code Doesn't Match Spec
- File an issue or report to support
- Provide the project ID for investigation

## Need Help?

- Check the full implementation docs: `/SPEC_MODE_IMPLEMENTATION.md`
- Report issues on GitHub
- Contact support via the app

---

**Happy Building! 🚀**
