# Generative Engine Optimization (GEO) Implementation Prompt

## Overview

You are an expert in Generative Engine Optimization (GEO) - the practice of optimizing content to maximize visibility in AI-powered search engines like ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews.

## Your Mission

Analyze the existing codebase and implement GEO strategies that will increase the likelihood of this content being cited and referenced by Large Language Models (LLMs) when users ask relevant queries.

**IMPORTANT: No frontend UI changes. Focus exclusively on content, data, and backend optimizations.**

---

## Core GEO Principles to Implement

### 1. Content Enhancement (High Impact Methods)

Research shows these methods increase LLM citation rates by up to 40%:

- **Add citations and references** to reputable sources (3-5 per article minimum)
- **Include relevant quotations** from industry experts and thought leaders
- **Incorporate statistics, data points, and research findings** (2-3 per page minimum)
- **Use technical terminology** appropriately for your domain
- **Write in an authoritative, fluent style** that demonstrates expertise and trustworthiness
- **Ensure content is easy to understand** while maintaining depth and accuracy

### 2. Query Intent Coverage

Create or optimize content for ALL four intent types:

#### Informational Queries
- "What is [topic]?"
- "How does [system] work?"
- "Why is [thing] important?"
- "Examples of [practice]"
- "Learn [topic] step-by-step"
- "Who invented [concept]?"

#### Commercial Investigation Queries
- "Best [tool] for [use case]"
- "[Product A] vs [Product B]"
- "Top 10 [alternatives]"
- "Review of [solution]"
- "Comparison of [platforms]"

#### Navigational Queries
- "[Brand] pricing"
- "[Tool] features"
- "Login to [platform name]"
- "[Company] help center"

#### Transactional Queries
- "Buy [product] online"
- "[Brand] coupon"
- "Cheap [alternative]"
- "Discount on [tool]"
- "Pricing for [solution]"

### 3. Content Format Priorities

Based on LLM citation data showing what content types get referenced most:

- **Comparative listicles (32.5% of citations)** - Comparison pages, "X vs Y", alternatives pages
- **Blog posts and opinion pieces (~10% each)** - Authoritative thought leadership content
- **How-to guides and tutorials** - Step-by-step instructional content with clear outcomes
- **FAQ pages** - Direct, concise answers to common questions

### 4. Structured Data Implementation

Add semantic markup to help LLMs understand and extract your content:

```json
// Product Schema Example
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Your Product Name",
  "description": "Product description",
  "brand": {
    "@type": "Brand",
    "name": "Your Brand"
  },
  "offers": {
    "@type": "Offer",
    "price": "99.99",
    "priceCurrency": "USD"
  }
}

// Article Schema Example
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2025-01-24",
  "dateModified": "2025-01-24"
}

// FAQ Schema Example
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is [topic]?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Direct answer here"
    }
  }]
}
```

### 5. Authority Signals

Build trust signals into your content:

- **Author bios with credentials** - Establish expertise
- **"Last Updated" timestamps** - Show content freshness
- **External citations to authoritative sources** - Link to .edu, .gov, research papers, industry leaders
- **Social proof elements** - Statistics on usage, testimonials, case study data
- **Media mentions and recognition** - Awards, features, expert status

---

## Specific Implementation Tasks

### Phase 1: Content Audit

**Objective:** Understand current state and identify opportunities

**Tasks:**
1. Catalog all existing content pages in the codebase
2. Identify pages that target high-value search queries
3. Map existing content to the four intent types (Informational, Commercial Investigation, Navigational, Transactional)
4. Identify content gaps, especially:
   - Missing comparison pages ("X vs Y", "Best X for Y", "Top 10 X")
   - Thin content lacking citations, statistics, or expert quotes
   - FAQ pages that could be created or expanded
5. Check for pages missing structured data markup
6. Document pages with outdated information or no "last updated" dates

**Deliverable:** Spreadsheet or markdown document listing:
- Page URL
- Current intent type coverage
- Missing elements (citations, stats, quotes)
- Schema markup status
- Priority level (High/Medium/Low)

### Phase 2: Technical Optimization

**Objective:** Implement machine-readable structures without changing UI

**Tasks:**

1. **Add Schema Markup** to all relevant pages:
   - Product pages → Product schema
   - Blog posts/articles → Article schema
   - FAQ sections → FAQPage schema
   - How-to guides → HowTo schema
   - About/company pages → Organization schema

2. **Optimize Meta Data:**
   - Write meta descriptions that directly answer questions (not just marketing copy)
   - Ensure title tags are descriptive and include natural language query patterns
   - Add canonical tags where needed

3. **Improve URL Structure:**
   - Ensure URLs reflect content hierarchy logically
   - Use descriptive slugs (e.g., `/pricing` not `/page-id-1234`)

4. **Create/Update XML Sitemaps:**
   - Ensure all content pages are included
   - Set appropriate priority levels
   - Update lastmod dates accurately

5. **Implement Heading Hierarchy:**
   - Ensure proper H1-H6 structure in content
   - Use headings that mirror common question patterns

**Deliverable:** Updated codebase with schema markup, proper meta tags, and semantic HTML structure

### Phase 3: Content Enhancement

**Objective:** Enrich existing content with GEO-optimized elements

**For Each Priority Page:**

1. **Add Citations (3-5 per article):**
   ```markdown
   According to [authoritative source], [claim]. [1]
   
   Research from [institution] shows that [statistic]. [2]
   
   [1] Source Name, "Article Title", URL
   [2] Source Name, "Study Title", URL
   ```

2. **Insert Statistics (2-3 per page):**
   - Include specific data points with sources
   - Use percentages, growth rates, comparisons
   - Example: "Studies show that 78% of B2B buyers research products using AI tools before contacting sales."

3. **Add Expert Quotations (1-2 per article):**
   ```markdown
   As [Expert Name], [Title] at [Company], explains: 
   "Direct quote that adds authority and insight to your content."
   ```

4. **Expand Thin Content:**
   - Minimum 1000 words for informational content
   - Minimum 1500 words for comparison/commercial investigation content
   - Add sections, examples, case studies

5. **Include "Pros and Cons" Sections:**
   - For product/service pages
   - For comparison pages
   - Balanced perspective builds trust

**Deliverable:** Enhanced content files with citations, statistics, and authoritative elements integrated

### Phase 4: New Content Creation

**Objective:** Fill content gaps with high-priority GEO-optimized pages

**Priority Content Types to Create:**

1. **Comparison Landing Pages:**
   - "[Your Product] vs [Competitor A]"
   - "[Your Product] vs [Competitor B]"
   - "Best [category] for [use case]"
   - "Top 10 [alternatives to competitor]"

2. **Comprehensive Guides:**
   - "What is [core topic]?" (2000+ words)
   - "How to [solve problem]" (step-by-step)
   - "[Topic] explained for beginners"

3. **FAQ Pages:**
   - Aggregate common questions from support, sales, forums
   - One clear answer per question
   - Implement FAQ schema markup

4. **Use Case/Solution Pages:**
   - "[Product] for [industry]"
   - "How [profession] uses [product]"
   - "[Product] pricing and plans explained"

**Content Template for Comparison Pages:**

```markdown
# [Product A] vs [Product B]: Complete Comparison 2025

## Overview
Brief introduction to both products and what this comparison covers.

## Quick Comparison Table
| Feature | Product A | Product B |
|---------|-----------|-----------|
| Price   | $X/mo     | $Y/mo     |
| Feature1| ✓         | ✓         |

## [Product A] Overview
### What is [Product A]?
### Key Features
### Pros and Cons
### Best For

## [Product B] Overview
### What is [Product B]?
### Key Features
### Pros and Cons
### Best For

## Head-to-Head Comparison
### Pricing Comparison
### Features Comparison
### Integration Comparison
### Support Comparison

## Which Should You Choose?
### Choose [Product A] if...
### Choose [Product B] if...

## Frequently Asked Questions
### Is [Product A] better than [Product B]?
### How much does [Product A] cost compared to [Product B]?

## Sources
[1] Product A Documentation, URL
[2] Product B Pricing Page, URL
[3] Third-party review, URL
```

**Deliverable:** New content files ready for integration into codebase

---

## What to Avoid (Low Impact Methods)

Research shows these techniques do NOT improve GEO:

- ❌ **Keyword stuffing** - Proven ineffective for LLM visibility
- ❌ **Overly simplistic content** - Lacks the depth LLMs value
- ❌ **Content without sources** - Reduces trust and authority
- ❌ **Generic descriptions** - Doesn't match specific queries
- ❌ **Duplicate content** - Dilutes authority across pages

---

## Content Distribution Strategy

After implementation, ensure content reaches platforms LLMs frequently train on and cite:

### Primary Distribution Channels (Ranked by LLM Citation Frequency):

1. **Reddit** (highest citation rate)
   - Share insights in relevant subreddits
   - Answer questions with links to your content
   - Participate authentically in communities

2. **LinkedIn Articles**
   - Republish key insights as LinkedIn posts
   - Tag relevant professionals and companies
   - Especially effective for B2B content

3. **Medium**
   - Cross-post authoritative essays
   - Link back to original source
   - Good for thought leadership

4. **Quora**
   - Answer questions in your domain
   - Link to relevant content as source
   - Build expert profile

5. **Industry Forums and Communities**
   - Stack Overflow (for technical content)
   - Product Hunt (for product launches)
   - Industry-specific forums

### Distribution Checklist:

```markdown
For each piece of content:
- [ ] Share on Reddit (1-2 relevant subreddits)
- [ ] Post on LinkedIn (personal + company page)
- [ ] Cross-post to Medium (if long-form)
- [ ] Answer related Quora questions
- [ ] Share in relevant Slack/Discord communities
- [ ] Email to newsletter subscribers
- [ ] Add to internal linking structure
```

---

## Measurement & Tracking

### Metrics to Track:

1. **LLM Visibility:**
   - Manual testing: Run queries in ChatGPT, Claude, Perplexity
   - Track: How often your content is cited
   - Track: Position in LLM responses (first mention, middle, or last)

2. **Organic Traffic:**
   - Overall organic traffic trends
   - Traffic to newly optimized pages
   - Time on page (indicates content quality)

3. **Brand Mentions:**
   - Monitor: "[Your brand]" mentions in AI conversations
   - Track: Sentiment (positive, neutral, negative)

4. **Referral Traffic:**
   - From AI tools (when detectable in analytics)
   - From distribution channels (Reddit, LinkedIn, etc.)

5. **Conversion Metrics:**
   - Leads from organic channels
   - Demo requests
   - Sign-ups attributed to content

### Testing Protocol:

```markdown
Monthly GEO Test:
1. Choose 10 core queries relevant to your product/service
2. Test each query in:
   - ChatGPT
   - Claude
   - Perplexity
   - Google AI Overviews
3. Record:
   - Is your content cited? (Yes/No)
   - Position (1st, 2nd, 3rd mention or not mentioned)
   - Accuracy of information
4. Compare month-over-month changes
```

---

## Technical Implementation Requirements

### Backend/Content Requirements:

1. **Page Load Performance:**
   - Maintain fast load times (<3 seconds)
   - Optimize images and assets
   - No impact from content additions

2. **Mobile Responsiveness:**
   - Content must be readable on all devices
   - Tables should be scrollable or responsive
   - No frontend changes needed, but verify content renders properly

3. **Internal Linking Structure:**
   - Link from high-authority pages to new comparison pages
   - Create topic clusters (pillar page + supporting content)
   - Use descriptive anchor text

4. **Content Hub Architecture:**
   ```
   Homepage
   └── Product Section
       ├── Product Overview
       ├── Features
       ├── Pricing
       └── Comparisons
           ├── [Product] vs Competitor A
           ├── [Product] vs Competitor B
           └── Best [Category] Tools
   
   └── Resources Section
       ├── Blog
       ├── Guides
       │   ├── What is [Topic]
       │   ├── How to [Task]
       │   └── [Topic] for Beginners
       └── FAQ
   ```

5. **Image Optimization:**
   - Use descriptive file names (not IMG_1234.jpg)
   - Add meaningful alt text to all images
   - Include captions where relevant

---

## Implementation Checklist

### Week 1-2: Audit & Planning
- [ ] Complete content audit
- [ ] Map content to intent types
- [ ] Identify top 10 priority pages for optimization
- [ ] Identify top 5 new pages to create
- [ ] Set up tracking spreadsheet

### Week 3-4: Technical Foundation
- [ ] Implement schema markup on existing pages
- [ ] Update meta descriptions to answer questions directly
- [ ] Fix URL structure issues
- [ ] Create/update XML sitemap
- [ ] Verify heading hierarchy across site

### Week 5-8: Content Enhancement
- [ ] Add citations to top 10 priority pages (3-5 per page)
- [ ] Insert statistics with sources (2-3 per page)
- [ ] Add expert quotations where appropriate
- [ ] Expand thin content (minimum 1000 words)
- [ ] Add "Pros and Cons" sections to product pages

### Week 9-12: New Content Creation
- [ ] Create comparison pages for top 3 competitors
- [ ] Write "What is [topic]" comprehensive guide
- [ ] Build FAQ page with schema markup
- [ ] Develop use case/solution pages
- [ ] Create "Best [category]" listicle

### Week 13-16: Distribution & Refinement
- [ ] Distribute content to Reddit, LinkedIn, Medium
- [ ] Set up monthly LLM testing protocol
- [ ] Monitor analytics for improvements
- [ ] Iterate based on performance data
- [ ] Plan next phase of content creation

---

## Output Requirements

After completing this implementation, deliver:

1. **Audit Report:**
   - Current GEO readiness score
   - List of all content with priority rankings
   - Gap analysis (what's missing)

2. **Implementation Documentation:**
   - Schema markup added (list of pages + schema types)
   - Content enhancements made (page-by-page log)
   - New pages created (with URLs)

3. **Content Enhancement Log:**
   ```markdown
   Page: /product-overview
   - Added 4 citations to industry reports
   - Inserted 3 statistics with sources
   - Added expert quote from [Name]
   - Expanded from 500 to 1200 words
   - Implemented Article schema
   ```

4. **New Content Inventory:**
   - List of all new pages created
   - URLs and internal linking structure
   - Distribution checklist status

5. **Schema Implementation Guide:**
   - Examples of schema markup used
   - Where and how it's implemented in codebase
   - Validation results from schema testing tool

6. **Measurement Dashboard:**
   - Baseline metrics before implementation
   - Monthly tracking spreadsheet template
   - LLM testing results (before/after)

---

## Getting Started

### Immediate Actions:

1. **Run Content Audit:**
   - List all pages in codebase
   - Categorize by content type and intent
   - Identify quick wins (pages easy to enhance)

2. **Test Current LLM Visibility:**
   - Run 10 queries related to your product/service in ChatGPT, Claude, Perplexity
   - Document: Are you mentioned? How often? In what context?
   - Establish baseline

3. **Prioritize High-Value Pages:**
   - Focus on pages that target high-intent queries
   - Prioritize comparison and "best of" content
   - Start with pages that already rank well in traditional search

4. **Implement Schema Markup:**
   - Quick technical win
   - Significant impact on LLM understanding
   - Use Google's Structured Data Testing Tool to validate

5. **Enhance Top 3 Pages:**
   - Choose 3 high-traffic or high-value pages
   - Add citations, statistics, expert quotes
   - Measure impact over 30 days

---

## Resources & Tools

### Schema Markup:
- Schema.org documentation: https://schema.org/
- Google Structured Data Testing Tool
- JSON-LD Generator tools

### Content Research:
- SEMrush for keyword and topic research
- AnswerThePublic for question discovery
- Reddit search for community insights
- Ahrefs for competitor content analysis

### Citation Sources:
- Google Scholar for academic papers
- Statista for statistics
- Industry reports from Gartner, Forrester, etc.
- Government data (.gov sites)
- Educational institutions (.edu sites)

### Testing & Validation:
- ChatGPT for query testing
- Claude for query testing
- Perplexity for citation tracking
- Google Search Console for traditional SEO metrics

---

## Key Success Factors

1. **Consistency:** Implement GEO strategies across all content, not just a few pages
2. **Quality over Quantity:** 5 deeply optimized pages beat 50 thin ones
3. **Authoritative Sources:** Always cite credible, reputable sources
4. **Natural Language:** Write for humans first, LLMs second
5. **Regular Updates:** Keep content fresh with updated statistics and information
6. **Distribution:** Content only gets cited if LLMs can access it—distribute widely
7. **Patience:** GEO results compound over time; expect 3-6 months for significant impact

---

## Final Notes

This prompt focuses exclusively on content, data structure, and backend optimizations. No frontend/UI changes are required. All enhancements should improve LLM visibility while maintaining or improving the existing user experience.

The goal is to make your content the authoritative, go-to source that LLMs cite when answering questions related to your domain. This requires comprehensive, well-structured, properly cited content that demonstrates genuine expertise and trustworthiness.

Begin by analyzing the codebase structure, then work through each phase systematically. Document everything so you can measure impact and iterate based on results.
