---
name: frontend-design
description: Create clean, consistent, and maintainable frontend interfaces using established design system patterns. Use this skill when the user asks to build web components, pages, or applications. Focuses on simple, scalable best practices rather than revolutionary or overly complex designs.
license: Complete terms in LICENSE.txt
---

This skill guides the creation of reliable, simple, and production-grade frontend interfaces by strictly adhering to established design system patterns. Avoid over-engineering or reinventing the wheel; prioritize simplicity, consistency, and reusability.

The user provides frontend requirements: a component, page, application, or interface to build.

## System Patterns & Best Practices

Before coding, establish a clear, simple foundation based on the following proven patterns:

### 1. Foundation: Design Tokens
Centralize all design decisions. Do not hardcode values.
- **Variables**: Use CSS variables or framework equivalents for colors, typography, spacing, shadows, and border-radii.
- **Semantic Naming**: Use descriptive, scalable names (e.g., `color-primary`, `spacing-md`, `text-body`) rather than literal values (e.g., `blue-500`, `margin-16`).

### 2. Component Structure: Atomic Approach
Think in terms of reusable building blocks.
- **Atoms to Organisms**: Start with simple, indivisible elements (buttons, inputs) before combining them into complex structures (cards, forms, navbars).
- **Agnostic & Reusable**: Components should be decoupled from specific page logic or business rules whenever possible.

### 3. Standardized States & Accessibility
Every interactive element must be predictable and accessible.
- **States**: Explicitly define `default`, `hover`, `active`, `focus`, `disabled`, and `loading` states for all interactive components.
- **A11y by Default**: Always include appropriate ARIA labels, semantic HTML tags, and ensure keyboard navigability.

### 4. Aesthetics & Simplicity
Stick to clean, modern, and universally understood UX conventions.
- **Clarity over Creativity**: Avoid "revolutionary" layouts or experimental maximalist designs unless explicitly requested. Focus on usability, familiar patterns, and clean whitespace.
- **Consistent Typography**: Use reliable, readable fonts (e.g., Inter, Roboto, standard system fonts) with clear hierarchical sizing.
- **Subtle Motion**: Limit animations to functional feedback (e.g., state transitions, loading indicators). Avoid staggered reveals or decorative motion that doesn't serve a clear UX purpose.

## Implementation Workflow

1. **Tokens First**: Identify or define the necessary design tokens for the requested UI.
2. **Component Breakdown**: Break the requested UI down into its simplest atomic components.
3. **State Mapping**: Ensure all states (hover, focus, disabled) are accounted for in the styling.
4. **Integration**: Assemble the components into the final layout, ensuring consistent spacing and token usage.

**CRITICAL**: Your goal is to build a UI that a new developer could instantly understand and extend. Prioritize clean code, straightforward CSS, and functional simplicity over stylistic flair.
