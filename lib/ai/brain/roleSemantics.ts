/**
 * §ROLE SEMANTICS & SYNONYM EXPANDER (TASK-049)
 * 
 * Provides semantic domain understanding and high-signal synonyms for job roles
 * without mutating or force-broadening the user's specific requested career scope.
 */

import { type RoleSemanticContext } from "./brainTypes";

interface DomainRoleOntology {
  canonicalName: string;
  matchPattern: RegExp;
  synonyms: string[];
  relatedKeywords: string[];
}

const DOMAIN_ROLE_ONTOLOGY: DomainRoleOntology[] = [
  {
    canonicalName: "AI/ML Intern",
    matchPattern: /\b(ai\s*\/\s*ml|ai|ml|machine\s*learning|deep\s*learning|artificial\s*intelligence)\b.*\b(intern|internship|trainee|co-op)\b/i,
    synonyms: [
      "machine learning intern",
      "AI research intern",
      "applied ML intern",
      "artificial intelligence internship",
      "deep learning intern",
    ],
    relatedKeywords: ["PyTorch", "TensorFlow", "Transformers", "Python", "Computer Vision", "NLP"],
  },
  {
    canonicalName: "AI/ML Engineer",
    matchPattern: /\b(ai\s*\/\s*ml|machine\s*learning|ml\s*engineer|deep\s*learning|applied\s*ai)\b/i,
    synonyms: [
      "machine learning engineer",
      "AI engineer",
      "ML software engineer",
      "deep learning engineer",
      "applied AI engineer",
    ],
    relatedKeywords: ["PyTorch", "MLOps", "LLMs", "Python", "Model Fine-Tuning", "Vector Search"],
  },
  {
    canonicalName: "Backend Engineer",
    matchPattern: /\b(backend|back-end|server\s*side|api\s*engineer)\b/i,
    synonyms: [
      "backend software engineer",
      "backend developer",
      "server-side engineer",
      "API developer",
      "distributed systems engineer",
    ],
    relatedKeywords: ["Node.js", "Python", "Go", "PostgreSQL", "Microservices", "REST/gRPC"],
  },
  {
    canonicalName: "Frontend Engineer",
    matchPattern: /\b(frontend|front-end|ui\s*engineer|web\s*developer|react\s*developer)\b/i,
    synonyms: [
      "frontend software engineer",
      "frontend developer",
      "UI engineer",
      "web developer",
      "client-side engineer",
    ],
    relatedKeywords: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Web Vitals", "CSS3/HTML5"],
  },
  {
    canonicalName: "Fullstack Engineer",
    matchPattern: /\b(fullstack|full-stack|full\s*stack)\b/i,
    synonyms: [
      "fullstack software engineer",
      "fullstack developer",
      "full stack web engineer",
    ],
    relatedKeywords: ["React", "Node.js", "TypeScript", "PostgreSQL", "REST APIs"],
  },
  {
    canonicalName: "Software Engineer",
    matchPattern: /\b(software\s*engineer|software\s*developer|swe|sde)\b/i,
    synonyms: [
      "software engineer",
      "software developer",
      "SDE",
      "systems engineer",
    ],
    relatedKeywords: ["Algorithms", "Data Structures", "System Design", "Git", "CI/CD"],
  },
];

/**
 * Extracts semantic role understanding and synonyms from a query or role string.
 */
export function extractRoleSemantics(queryOrRole: string): RoleSemanticContext {
  const clean = (queryOrRole || "").trim();
  
  for (const entry of DOMAIN_ROLE_ONTOLOGY) {
    if (entry.matchPattern.test(clean)) {
      return {
        originalRole: clean,
        normalizedRole: entry.canonicalName,
        semanticSynonyms: entry.synonyms,
        relatedKeywords: entry.relatedKeywords,
        preserveStrictScope: true,
      };
    }
  }

  // Fallback for custom or unmapped roles
  return {
    originalRole: clean,
    normalizedRole: clean,
    semanticSynonyms: [clean],
    relatedKeywords: [],
    preserveStrictScope: true,
  };
}

/**
 * Generates search query reformulations using role semantics and location context.
 */
export function generateQueryReformulations(
  query: string,
  roleContext: RoleSemanticContext,
  location?: string,
  workMode?: string
): string[] {
  const reformulations: string[] = [];
  const locSuffix = location ? ` in ${location}` : "";
  const modePrefix = workMode && workMode !== "ANY" ? `${workMode.toLowerCase()} ` : "";

  for (const syn of roleContext.semanticSynonyms.slice(0, 3)) {
    reformulations.push(`${modePrefix}${syn}${locSuffix}`.trim());
  }

  return Array.from(new Set(reformulations)).slice(0, 4);
}
