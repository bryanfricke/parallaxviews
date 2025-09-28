# Parallax Views - AI Coding Instructions

## Project Overview
This is a data visualization project focused on historical hypothesis analysis and argumentation, particularly resurrection studies and messianic prophecies. The project uses D3.js to create interactive visualizations including radar charts, heatmaps, force-directed graphs, and hierarchical trees.

## Architecture & Key Components

### Core Structure
- **Entry point**: `index.html` - Simple GitHub Pages homepage with navigation links
- **Visualizations**: `graphs/` directory contains standalone HTML files with embedded D3.js visualizations
- **Data**: `graphs/data/` contains JSON files with structured hypothesis data, criteria scores, and supporting quotes

### Visualization Types & Patterns
The project implements several D3.js visualization patterns:

1. **Hypothesis Analysis** (`resurrectionHypotheses*.html`, `reasons.html`):
   - Radar charts for multi-criteria hypothesis comparison
   - Heatmaps showing score distributions across criteria
   - Interactive toggles for hypothesis selection and weighting
   - Bipartite force networks connecting facts to hypotheses

2. **Hierarchical Data** (`minimalFacts*.html`, `indentedTree.html`):
   - Force-directed graphs with grouped nodes (facts, theories, prophecies)
   - Radial and tidy tree layouts for parent-child relationships
   - Color-coded node types and edge relationships

3. **Prophecy Analysis** (`prophecy*.html`):
   - Bipartite graphs connecting Old Testament and New Testament references
   - Custom positioning and filtering based on biblical books

### Data Structure Convention
Hypothesis data follows a consistent schema in JSON files:
```json
{
  "criteria": [{"id": "scope", "label": "Explanatory scope", "short": "Scope"}],
  "hypotheses": [{
    "id": "resurrection", 
    "scores": {"scope": 0.95}, 
    "covers": [{"factId": "empty", "strength": 0.9}],
    "notes": {"scope": "Detailed explanation..."}
  }]
}
```

### Styling & Theming
- Uses CSS custom properties for consistent theming across files
- Dark mode support via `:root[data-theme="dark"]` selectors  
- Responsive design with mobile-friendly pill scrolling and grid layouts
- Color palette: `#603699` (purple) for primary, semantic colors for hypothesis types

## Development Workflow

### File Organization
- Each visualization is self-contained in a single HTML file with inline CSS and JavaScript
- External dependencies loaded from CDN (D3.js v7 from `cdn.jsdelivr.net`)
- Data files separated into `graphs/data/` directory for reusability

### Data Loading Pattern
Most visualizations use async fetch for external JSON data:
```javascript
const resp = await fetch('data/resurrection-data.json');
const Data = await resp.json();
```

Some files have inline data objects for simplicity.

### Interactive Controls
Standard UI patterns across visualizations:
- Hypothesis selection via checkboxes in pill-style containers
- View mode tabs (radar/heatmap/network)
- Weight sliders for criteria adjustment
- Toggle switches for display options (values, quotes, facts network)

### State Management
Uses simple object-based state with D3 data binding:
```javascript
const state = {
  view: "radar",
  selected: new Set(Data.hypotheses.map(h => h.id)),
  weights: {...Data.weights}
};
```

## Key Conventions

### CSS Architecture
- Utility-first approach with semantic color variables
- Grid layouts for responsive design
- Sticky positioning for navigation headers
- Consistent padding and border-radius values (8px, 14px)

### D3.js Patterns
- Uses v7 syntax with method chaining
- Consistent enter/update/exit pattern with `.join()`
- Tooltip implementation via absolute positioning and pointer events
- SVG coordinate calculations with padding objects `{t:30, r:10, b:30, l:160}`

### Data Binding
- Uses D3's data binding with key functions for stable updates
- Filters data based on state before rendering
- Separates rendering logic into view-specific functions (`renderRadar()`, `renderHeatmap()`)

When adding new visualizations, follow the established patterns for data structure, styling, and interactive controls to maintain consistency across the project.