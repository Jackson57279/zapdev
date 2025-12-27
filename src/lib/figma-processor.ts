/**
 * Figma Design Processor
 * Converts Figma file structure and design data into AI prompts for code generation
 */

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: Array<{
    color?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  }>;
  strokes?: Array<{
    color?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  }>;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
}

interface DesignSystem {
  colors: Record<string, string>;
  typography: Record<string, any>;
  spacing: number[];
  components: string[];
}

/**
 * Extracts color from Figma RGBA values
 */
export function figmaColorToHex(color: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return (
    "#" +
    toHex(color.r) +
    toHex(color.g) +
    toHex(color.b) +
    (color.a !== undefined && color.a < 1
      ? toHex(color.a)
      : "")
  );
}

/**
 * Extracts design system from Figma file structure
 */
export function extractDesignSystem(figmaFile: any): DesignSystem {
  const colors: Record<string, string> = {};
  const typography: Record<string, any> = {};
  const components: string[] = [];
  const spacing = new Set<number>();

  function traverse(node: FigmaNode) {
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      components.push(node.name);
    }

    // Extract colors
    if (node.fills && node.fills.length > 0) {
      node.fills.forEach((fill, index) => {
        if (fill.color) {
          const hex = figmaColorToHex(fill.color);
          colors[`${node.name}-fill-${index}`] = hex;
        }
      });
    }

    // Extract typography info
    if (
      node.type === "TEXT" &&
      (node.fontSize || node.fontFamily)
    ) {
      const typographyKey = `${node.fontFamily}-${node.fontSize}-${node.fontWeight}`;
      typography[typographyKey] = {
        fontFamily: node.fontFamily,
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
      };
    }

    // Traverse children
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  if (figmaFile.document) {
    traverse(figmaFile.document);
  }

  return {
    colors,
    typography,
    spacing: Array.from(spacing).sort((a, b) => a - b),
    components,
  };
}

/**
 * Generates AI prompt from Figma design system for code generation
 */
export function generateFigmaCodePrompt(
  figmaFile: any,
  designSystem: DesignSystem
): string {
  const { colors, typography, components } = designSystem;

  const prompt = `You are an expert UI developer. You have been given a Figma design file and need to convert it into React/Next.js code.

## Design System Information

### Colors:
${Object.entries(colors)
  .slice(0, 10) // Limit to first 10 colors
  .map(([name, color]) => `- ${name}: ${color}`)
  .join("\n")}

### Typography:
${Object.entries(typography)
  .slice(0, 5) // Limit to first 5 styles
  .map(([name, style]) => `- ${name}: ${style.fontSize}px, ${style.fontFamily}`)
  .join("\n")}

### Components Used:
${components.slice(0, 10).join(", ")}

## Instructions:

1. Create pixel-perfect React components that match the Figma design
2. Use Tailwind CSS for styling to match colors and typography
3. Make components responsive and accessible
4. Use the design system colors and typography consistently
5. Create reusable components for each design element
6. Follow React best practices and patterns

## Output:

Generate the complete React component code that implements this design. Include:
- Component structure and hierarchy
- Tailwind CSS classes for styling
- Responsive design considerations
- Any necessary state management
- TypeScript types (if applicable)
`;

  return prompt;
}

/**
 * Extracts structure information for AI context
 */
export function extractPageStructure(figmaFile: any): string {
  const pages: string[] = [];

  if (figmaFile.document && figmaFile.document.children) {
    figmaFile.document.children.forEach((page: FigmaNode) => {
      pages.push(page.name);
    });
  }

  return `Design has ${pages.length} pages: ${pages.join(", ")}`;
}
