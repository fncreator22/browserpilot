/**
 * §CAREER TAXONOMY & SELF-EXPANDING BRAIN SERVICE
 * 
 * Organizes jobs into hierarchical Departments and Categories.
 * Continuously learns and registers emerging roles, aliases, and co-occurring skills
 * from ATS boards, job portals, and user searches to enhance matching precision over time.
 */

import fs from "fs";
import path from "path";

export interface TaxonomyRole {
  canonicalTitle: string;
  aliases: string[];
  seniorityLevels?: string[];
  coOccurringSkills: string[];
  observedCount: number;
  isDynamicallyLearned: boolean;
  discoveredFromPortals: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  roles: Record<string, TaxonomyRole>;
}

export interface TaxonomyDepartment {
  id: string;
  name: string;
  description: string;
  categories: Record<string, TaxonomyCategory>;
}

export interface CareerBrainState {
  version: string;
  lastUpdatedAt: string;
  totalRolesLearned: number;
  departments: Record<string, TaxonomyDepartment>;
}

// Initial Curated Knowledge Base
const INITIAL_TAXONOMY: Record<string, TaxonomyDepartment> = {
  engineering: {
    id: "engineering",
    name: "Engineering & Technology",
    description: "Software design, architecture, infrastructure, systems, and product technology.",
    categories: {
      backend_systems: {
        id: "backend_systems",
        name: "Backend & Distributed Systems",
        description: "Server-side logic, distributed architectures, database engines, and microservices.",
        keywords: ["backend", "back-end", "distributed", "api", "systems", "microservices", "server", "golang", "java", "python", "c++", "rust", "database"],
        roles: {
          "software-engineer": {
            canonicalTitle: "Software Engineer",
            aliases: ["Software Developer", "SWE", "Software Development Engineer", "SDE", "Full Stack Developer", "Software Engineer II"],
            coOccurringSkills: ["TypeScript", "Python", "Go", "Java", "Docker", "SQL", "Git"],
            observedCount: 250,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "LinkedIn", "Indeed", "Lever", "Ashby"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "backend-engineer": {
            canonicalTitle: "Backend Engineer",
            aliases: ["Backend Developer", "Server Engineer", "API Engineer", "Core Platform Engineer"],
            coOccurringSkills: ["PostgreSQL", "Node.js", "Redis", "Kafka", "Go", "Microservices", "REST"],
            observedCount: 180,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "Lever", "LinkedIn", "Ashby"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "distributed-systems-engineer": {
            canonicalTitle: "Distributed Systems Engineer",
            aliases: ["Systems Software Engineer", "Infrastructure Software Engineer", "Cluster Systems Engineer"],
            coOccurringSkills: ["Raft", "Consensus", "C++", "Rust", "Distributed Transactions", "Kubernetes"],
            observedCount: 45,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Ashby", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      frontend_web: {
        id: "frontend_web",
        name: "Frontend & Web Technologies",
        description: "Browser interfaces, web application performance, interactive client architectures.",
        keywords: ["frontend", "front-end", "ui", "ux", "web", "react", "next.js", "javascript", "typescript", "tailwind", "css", "vue", "angular"],
        roles: {
          "frontend-engineer": {
            canonicalTitle: "Frontend Engineer",
            aliases: ["Frontend Developer", "Front End Developer", "UI Engineer", "Web Application Developer", "Client Engineer"],
            coOccurringSkills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "HTML5", "Redux", "Webpack"],
            observedCount: 160,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "LinkedIn", "Indeed", "Lever"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "fullstack-engineer": {
            canonicalTitle: "Full Stack Engineer",
            aliases: ["Full-Stack Developer", "Full Stack SWE", "Fullstack Developer"],
            coOccurringSkills: ["React", "Node.js", "PostgreSQL", "TypeScript", "Next.js", "AWS"],
            observedCount: 210,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed", "Y Combinator", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      cloud_devops: {
        id: "cloud_devops",
        name: "Cloud, Infrastructure & DevOps",
        description: "Cloud automation, CI/CD, site reliability, infrastructure as code, and cluster orchestration.",
        keywords: ["devops", "sre", "site reliability", "cloud", "infrastructure", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform"],
        roles: {
          "devops-engineer": {
            canonicalTitle: "DevOps Engineer",
            aliases: ["Infrastructure Engineer", "Platform Operations Engineer", "CI/CD Engineer"],
            coOccurringSkills: ["Terraform", "Docker", "Kubernetes", "AWS", "GitHub Actions", "Linux"],
            observedCount: 95,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "LinkedIn", "Lever"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "site-reliability-engineer": {
            canonicalTitle: "Site Reliability Engineer",
            aliases: ["SRE", "Production Systems Engineer", "Reliability Engineer"],
            coOccurringSkills: ["Observability", "Prometheus", "Grafana", "Incident Management", "Go", "Python"],
            observedCount: 70,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "Ashby"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      mobile_engineering: {
        id: "mobile_engineering",
        name: "Mobile App Development",
        description: "Native iOS, Android, and cross-platform mobile architectures.",
        keywords: ["mobile", "ios", "android", "swift", "kotlin", "flutter", "react native"],
        roles: {
          "mobile-engineer": {
            canonicalTitle: "Mobile Engineer",
            aliases: ["iOS Developer", "Android Developer", "Mobile App Developer", "React Native Engineer"],
            coOccurringSkills: ["Swift", "Kotlin", "React Native", "Flutter", "Mobile CI/CD", "Xcode"],
            observedCount: 65,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      security_engineering: {
        id: "security_engineering",
        name: "Cybersecurity & Information Security",
        description: "Application security, network defense, threat intelligence, and vulnerability assessments.",
        keywords: ["security", "infosec", "cyber", "pentest", "soc", "cryptography", "appsec"],
        roles: {
          "security-engineer": {
            canonicalTitle: "Security Engineer",
            aliases: ["AppSec Engineer", "Information Security Specialist", "Cybersecurity Engineer"],
            coOccurringSkills: ["OWASP", "Penetration Testing", "Threat Modeling", "SIEM", "Cryptography"],
            observedCount: 40,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "Lever"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  data_ai: {
    id: "data_ai",
    name: "Data & Artificial Intelligence",
    description: "Machine learning systems, foundation models, data science, data warehousing, and AI agents.",
    categories: {
      machine_learning: {
        id: "machine_learning",
        name: "Machine Learning & AI Engineering",
        description: "Production ML pipelines, deep learning, LLM fine-tuning, and agentic AI systems.",
        keywords: ["ai", "machine learning", "ml", "deep learning", "llm", "genai", "nlp", "computer vision", "pytorch", "tensorflow", "foundation model", "alignment", "scientist", "generative", "neural", "prompt"],
        roles: {
          "ai-engineer": {
            canonicalTitle: "AI Engineer",
            aliases: ["Applied AI Engineer", "GenAI Developer", "LLM Engineer", "Machine Learning Software Engineer"],
            coOccurringSkills: ["PyTorch", "Python", "LLMs", "RAG", "Hugging Face", "LangChain", "Vector Databases"],
            observedCount: 195,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Ashby", "Greenhouse", "Y Combinator", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "machine-learning-engineer": {
            canonicalTitle: "Machine Learning Engineer",
            aliases: ["MLE", "Deep Learning Engineer", "ML Platform Engineer"],
            coOccurringSkills: ["Python", "TensorFlow", "PyTorch", "MLOps", "Kubeflow", "Feature Stores"],
            observedCount: 140,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "Lever", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      data_engineering: {
        id: "data_engineering",
        name: "Data Engineering & Warehousing",
        description: "Large-scale batch and streaming pipelines, analytics infrastructure, and data modeling.",
        keywords: ["data engineering", "spark", "hadoop", "snowflake", "bigquery", "dbt", "airflow", "lakehouse"],
        roles: {
          "data-engineer": {
            canonicalTitle: "Data Engineer",
            aliases: ["Big Data Engineer", "Analytics Engineer", "Data Platform Engineer"],
            coOccurringSkills: ["Apache Spark", "SQL", "dbt", "Snowflake", "Airflow", "Python", "Kafka"],
            observedCount: 110,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      data_science_analytics: {
        id: "data_science_analytics",
        name: "Data Science & Business Intelligence",
        description: "Statistical modeling, predictive analytics, hypothesis testing, and business insight.",
        keywords: ["data scientist", "data analyst", "business intelligence", "bi analyst", "statistics", "tableau", "power bi"],
        roles: {
          "data-scientist": {
            canonicalTitle: "Data Scientist",
            aliases: ["Decision Scientist", "Quantitative Researcher", "Analytics Scientist"],
            coOccurringSkills: ["Python", "R", "SQL", "A/B Testing", "Statistics", "Pandas", "Scikit-Learn"],
            observedCount: 130,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
          "data-analyst": {
            canonicalTitle: "Data Analyst",
            aliases: ["BI Analyst", "Business Intelligence Specialist", "Operations Analyst"],
            coOccurringSkills: ["SQL", "Excel", "Tableau", "Power BI", "Data Storytelling"],
            observedCount: 120,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Indeed", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  product_design: {
    id: "product_design",
    name: "Product & Design",
    description: "Product roadmap, user experience research, prototyping, and visual design systems.",
    categories: {
      product_management: {
        id: "product_management",
        name: "Product Management",
        description: "Vision, discovery, user feedback synthesis, and agile execution.",
        keywords: ["product manager", "pm", "technical product manager", "tpm", "apm", "group product manager"],
        roles: {
          "product-manager": {
            canonicalTitle: "Product Manager",
            aliases: ["Technical Product Manager", "Associate Product Manager", "Growth Product Manager"],
            coOccurringSkills: ["Product Strategy", "User Stories", "Roadmapping", "A/B Testing", "Agile", "SQL"],
            observedCount: 95,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "LinkedIn", "Lever"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
      ui_ux_design: {
        id: "ui_ux_design",
        name: "UI/UX & Product Design",
        description: "User interfaces, wireframes, high-fidelity prototypes, and design tokens.",
        keywords: ["ui/ux", "ux", "ui", "designer", "design", "product designer", "interaction design", "ux designer", "figma", "design systems", "visual designer", "prototyping"],
        roles: {
          "product-designer": {
            canonicalTitle: "Product Designer",
            aliases: ["UI/UX Designer", "UX Designer", "User Interface Designer", "Interaction Designer"],
            coOccurringSkills: ["Figma", "Design Systems", "Prototyping", "User Research", "Wireframing"],
            observedCount: 85,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Greenhouse", "Ashby", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  marketing_growth: {
    id: "marketing_growth",
    name: "Marketing & Growth",
    description: "Demand generation, performance marketing, product marketing, and brand strategy.",
    categories: {
      growth_marketing: {
        id: "growth_marketing",
        name: "Growth & Performance Marketing",
        description: "Funnel optimization, customer acquisition, paid channels, and organic search.",
        keywords: ["marketing", "growth", "seo", "sem", "performance marketing", "paid ads", "content marketing"],
        roles: {
          "growth-marketer": {
            canonicalTitle: "Growth Marketing Specialist",
            aliases: ["Growth Manager", "Performance Marketing Lead", "Demand Generation Manager"],
            coOccurringSkills: ["Google Ads", "Conversion Rate Optimization", "SEO", "Analytics", "Email Campaigns"],
            observedCount: 50,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  sales_business: {
    id: "sales_business",
    name: "Sales & Business Development",
    description: "Account acquisition, solution engineering, client partnerships, and deal execution.",
    categories: {
      enterprise_sales: {
        id: "enterprise_sales",
        name: "Enterprise & Direct Sales",
        description: "B2B client engagement, closing, and revenue generation.",
        keywords: ["sales", "account executive", "bdr", "sdr", "business development", "solutions engineer"],
        roles: {
          "account-executive": {
            canonicalTitle: "Account Executive",
            aliases: ["Enterprise Account Executive", "Sales Executive", "B2B Sales Representative"],
            coOccurringSkills: ["CRM", "Salesforce", "Enterprise Negotiation", "Cold Outreach", "Pipeline Management"],
            observedCount: 75,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed", "Greenhouse"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  operations_people: {
    id: "operations_people",
    name: "Operations & People",
    description: "Talent acquisition, organizational scaling, customer success, and workplace management.",
    categories: {
      people_talent: {
        id: "people_talent",
        name: "Talent Acquisition & People Operations",
        description: "Technical recruiting, HR business partnering, and onboarding programs.",
        keywords: ["recruiter", "talent acquisition", "hr", "people operations", "human resources"],
        roles: {
          "technical-recruiter": {
            canonicalTitle: "Technical Recruiter",
            aliases: ["Talent Acquisition Partner", "Engineering Recruiter", "Staffing Specialist"],
            coOccurringSkills: ["Sourcing", "Applicant Tracking Systems", "Candidate Screening", "Interview Coordination"],
            observedCount: 60,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["LinkedIn", "Indeed"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  finance_legal: {
    id: "finance_legal",
    name: "Finance & Legal",
    description: "Corporate financial planning, accounting, compliance, and legal counsel.",
    categories: {
      corporate_finance: {
        id: "corporate_finance",
        name: "Finance & Accounting",
        description: "Financial analysis, bookkeeping, audits, and treasury operations.",
        keywords: ["finance", "accountant", "accounting", "fp&a", "financial analyst", "audit"],
        roles: {
          "financial-analyst": {
            canonicalTitle: "Financial Analyst",
            aliases: ["Corporate Financial Analyst", "FP&A Analyst", "Staff Accountant"],
            coOccurringSkills: ["Financial Modeling", "Excel", "Valuation", "Budgeting", "QuickBooks"],
            observedCount: 45,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Indeed", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
  healthcare_life_sciences: {
    id: "healthcare_life_sciences",
    name: "Healthcare & Life Sciences",
    description: "Clinical research, biomedical engineering, nursing, health informatics, and pharmaceuticals.",
    categories: {
      clinical_biomedical: {
        id: "clinical_biomedical",
        name: "Clinical Research & Biomedical",
        description: "Clinical trials, medical device engineering, genomics, and healthcare analytics.",
        keywords: ["healthcare", "nurse", "clinical", "biomedical", "pharma", "genomics", "bioinformatics"],
        roles: {
          "clinical-research-coordinator": {
            canonicalTitle: "Clinical Research Coordinator",
            aliases: ["Clinical Trial Specialist", "Biomedical Researcher", "Healthcare Specialist"],
            coOccurringSkills: ["GCP / ICH Guidelines", "Clinical Protocols", "Patient Screening", "Data Documentation"],
            observedCount: 35,
            isDynamicallyLearned: false,
            discoveredFromPortals: ["Indeed", "LinkedIn"],
            firstObservedAt: "2026-01-01T00:00:00.000Z",
            lastObservedAt: new Date().toISOString(),
          },
        },
      },
    },
  },
};

class CareerBrainService {
  private state: CareerBrainState;
  private persistenceFilePath: string;

  constructor() {
    this.persistenceFilePath = path.join(process.cwd(), "data", "career-brain-taxonomy.json");
    this.state = this.loadState();
  }

  /**
   * Load state from local storage or initialize with default curated taxonomy
   */
  private loadState(): CareerBrainState {
    try {
      if (fs.existsSync(this.persistenceFilePath)) {
        const raw = fs.readFileSync(this.persistenceFilePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.departments && Object.keys(parsed.departments).length > 0) {
          // Keep category definitions and keywords in sync with code updates
          for (const [deptId, initDept] of Object.entries(INITIAL_TAXONOMY)) {
            if (!parsed.departments[deptId]) {
              parsed.departments[deptId] = initDept;
            } else {
              for (const [catId, initCat] of Object.entries(initDept.categories)) {
                if (!parsed.departments[deptId].categories[catId]) {
                  parsed.departments[deptId].categories[catId] = initCat;
                } else {
                  parsed.departments[deptId].categories[catId].keywords = initCat.keywords;
                  parsed.departments[deptId].categories[catId].description = initCat.description;
                }
              }
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("[CareerBrainService] Failed to read persisted taxonomy, initializing defaults:", e);
    }

    return {
      version: "1.0.0",
      lastUpdatedAt: new Date().toISOString(),
      totalRolesLearned: 0,
      departments: INITIAL_TAXONOMY,
    };
  }

  /**
   * Persist state to local storage asynchronously
   */
  private async persistState(): Promise<void> {
    try {
      const dir = path.dirname(this.persistenceFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.state.lastUpdatedAt = new Date().toISOString();
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (err) {
      console.error("[CareerBrainService] Failed to persist state:", err);
    }
  }

  /**
   * Ingest and learn from discovered jobs across web portals, ATS endpoints, or search results.
   * Dynamically admits novel job titles into the most matching department & category.
   */
  public async learnFromDiscoveredJobs(
    candidates: Array<{ title: string; skills?: string[]; sourcePlatform?: string }>,
    sourcePlatform: string = "Web"
  ): Promise<{ newlyLearned: number; reinforcedCount: number }> {
    let newlyLearned = 0;
    let reinforcedCount = 0;

    for (const cand of candidates) {
      const rawTitle = (cand.title || "").trim();
      if (!rawTitle || rawTitle.length < 3) continue;

      const classification = this.classifyRole(rawTitle);
      const dept = this.state.departments[classification.departmentId];
      if (!dept) continue;

      const cat = dept.categories[classification.categoryId];
      if (!cat) continue;

      const slugKey = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const existingRole = cat.roles[slugKey];

      const incomingSkills = Array.isArray(cand.skills) ? cand.skills : [];
      const platform = cand.sourcePlatform || sourcePlatform;

      if (existingRole) {
        existingRole.observedCount += 1;
        existingRole.lastObservedAt = new Date().toISOString();
        if (!existingRole.discoveredFromPortals.includes(platform)) {
          existingRole.discoveredFromPortals.push(platform);
        }
        for (const sk of incomingSkills) {
          if (!existingRole.coOccurringSkills.includes(sk) && existingRole.coOccurringSkills.length < 15) {
            existingRole.coOccurringSkills.push(sk);
          }
        }
        reinforcedCount++;
      } else {
        // Novel role detected! Admit to the brain
        cat.roles[slugKey] = {
          canonicalTitle: rawTitle,
          aliases: [],
          coOccurringSkills: incomingSkills.slice(0, 10),
          observedCount: 1,
          isDynamicallyLearned: true,
          discoveredFromPortals: [platform],
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
        };
        this.state.totalRolesLearned += 1;
        newlyLearned++;
      }
    }

    if (newlyLearned > 0 || reinforcedCount > 0) {
      await this.persistState();
    }

    return { newlyLearned, reinforcedCount };
  }

  /**
   * Classify any given job title into its best-fit department and category
   */
  public classifyRole(title: string): {
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
    confidence: number;
  } {
    const lower = title.toLowerCase();

    // 1. Check exact canonical roles & aliases
    for (const [deptId, dept] of Object.entries(this.state.departments)) {
      for (const [catId, cat] of Object.entries(dept.categories)) {
        for (const role of Object.values(cat.roles)) {
          if (role.canonicalTitle.toLowerCase() === lower || role.aliases.some((a) => a.toLowerCase() === lower)) {
            return {
              departmentId: deptId,
              departmentName: dept.name,
              categoryId: catId,
              categoryName: cat.name,
              confidence: 0.95,
            };
          }
        }
      }
    }

    // 2. Keyword scoring across categories
    let bestScore = -1;
    let bestDeptId = "engineering";
    let bestDeptName = "Engineering & Technology";
    let bestCatId = "backend_systems";
    let bestCatName = "Backend & Distributed Systems";

    for (const [deptId, dept] of Object.entries(this.state.departments)) {
      for (const [catId, cat] of Object.entries(dept.categories)) {
        let score = 0;
        for (const kw of cat.keywords) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const rx = new RegExp(`\\b${escaped}\\b`, "i");
          if (rx.test(lower)) {
            const wordWeight = kw.split(/\s+/).length;
            score += 10 * wordWeight;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestDeptId = deptId;
          bestDeptName = dept.name;
          bestCatId = catId;
          bestCatName = cat.name;
        }
      }
    }

    return {
      departmentId: bestDeptId,
      departmentName: bestDeptName,
      categoryId: bestCatId,
      categoryName: bestCatName,
      confidence: bestScore > 0 ? 0.75 : 0.4,
    };
  }

  /**
   * Expand user query into related target roles and synonyms to widen search coverage
   */
  public expandQueryRoles(queryOrRole: string): string[] {
    const clean = queryOrRole.toLowerCase().trim();
    const expanded = new Set<string>();

    for (const dept of Object.values(this.state.departments)) {
      for (const cat of Object.values(dept.categories)) {
        // If query matches category keywords or category name
        const isCatMatch = cat.keywords.some((k) => clean.includes(k)) || cat.name.toLowerCase().includes(clean);
        for (const role of Object.values(cat.roles)) {
          const titleLower = role.canonicalTitle.toLowerCase();
          if (isCatMatch || titleLower.includes(clean) || clean.includes(titleLower)) {
            expanded.add(role.canonicalTitle);
            role.aliases.forEach((a) => expanded.add(a));
          }
        }
      }
    }

    return Array.from(expanded).slice(0, 10);
  }

  /**
   * Returns a high-level catalog of departments, categories, and brain growth statistics
   */
  public getTaxonomySummary() {
    let totalCategories = 0;
    let totalRoles = 0;
    let dynamicallyLearnedRoles = 0;

    const departmentsSummary = Object.values(this.state.departments).map((dept) => {
      const categoriesSummary = Object.values(dept.categories).map((cat) => {
        const rolesList = Object.values(cat.roles);
        totalCategories++;
        totalRoles += rolesList.length;
        const learnedInCat = rolesList.filter((r) => r.isDynamicallyLearned).length;
        dynamicallyLearnedRoles += learnedInCat;

        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          totalRoles: rolesList.length,
          learnedRolesCount: learnedInCat,
          sampleRoles: rolesList.slice(0, 5).map((r) => r.canonicalTitle),
        };
      });

      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        categoriesCount: Object.keys(dept.categories).length,
        categories: categoriesSummary,
      };
    });

    return {
      version: this.state.version,
      lastUpdatedAt: this.state.lastUpdatedAt,
      totalDepartments: Object.keys(this.state.departments).length,
      totalCategories,
      totalRoles,
      dynamicallyLearnedRoles,
      departments: departmentsSummary,
    };
  }

  /**
   * Returns full departments dictionary with all nested categories and roles
   */
  public getAllDepartments(): Record<string, TaxonomyDepartment> {
    return this.state.departments;
  }

  /**
   * Get specific department by ID
   */
  public getDepartment(deptId: string): TaxonomyDepartment | null {
    return this.state.departments[deptId] || null;
  }

  /**
   * Add or register a new Department
   */
  public async addDepartment(dept: { id: string; name: string; description: string }): Promise<TaxonomyDepartment> {
    const slug = dept.id.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    if (!this.state.departments[slug]) {
      this.state.departments[slug] = {
        id: slug,
        name: dept.name,
        description: dept.description,
        categories: {},
      };
    } else {
      this.state.departments[slug].name = dept.name;
      this.state.departments[slug].description = dept.description;
    }
    await this.persistState();
    return this.state.departments[slug];
  }

  /**
   * Add or register a Category under a Department
   */
  public async addCategory(
    deptId: string,
    cat: { id: string; name: string; description: string; keywords: string[] }
  ): Promise<TaxonomyCategory> {
    let dept = this.state.departments[deptId];
    if (!dept) {
      dept = await this.addDepartment({
        id: deptId,
        name: deptId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "Custom department",
      });
    }

    const catSlug = cat.id.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    if (!dept.categories[catSlug]) {
      dept.categories[catSlug] = {
        id: catSlug,
        name: cat.name,
        description: cat.description,
        keywords: cat.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
        roles: {},
      };
    } else {
      dept.categories[catSlug].name = cat.name;
      dept.categories[catSlug].description = cat.description;
      dept.categories[catSlug].keywords = Array.from(
        new Set([...dept.categories[catSlug].keywords, ...cat.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)])
      );
    }

    await this.persistState();
    return dept.categories[catSlug];
  }

  /**
   * Update category metadata or keywords
   */
  public async updateCategory(
    deptId: string,
    catId: string,
    updates: Partial<{ name: string; description: string; keywords: string[] }>
  ): Promise<TaxonomyCategory | null> {
    const dept = this.state.departments[deptId];
    if (!dept || !dept.categories[catId]) return null;

    const cat = dept.categories[catId];
    if (updates.name) cat.name = updates.name;
    if (updates.description !== undefined) cat.description = updates.description;
    if (updates.keywords) {
      cat.keywords = Array.from(new Set(updates.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)));
    }

    await this.persistState();
    return cat;
  }

  /**
   * Delete a category from a department
   */
  public async deleteCategory(deptId: string, catId: string): Promise<boolean> {
    const dept = this.state.departments[deptId];
    if (!dept || !dept.categories[catId]) return false;

    delete dept.categories[catId];
    await this.persistState();
    return true;
  }

  /**
   * Add or update a role in a category
   */
  public async addOrUpdateRole(
    deptId: string,
    catId: string,
    roleData: {
      canonicalTitle: string;
      aliases?: string[];
      coOccurringSkills?: string[];
      seniorityLevels?: string[];
    }
  ): Promise<TaxonomyRole | null> {
    const dept = this.state.departments[deptId];
    if (!dept || !dept.categories[catId]) return null;

    const cat = dept.categories[catId];
    const roleSlug = roleData.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const existing = cat.roles[roleSlug];
    if (existing) {
      existing.canonicalTitle = roleData.canonicalTitle;
      if (roleData.aliases) {
        existing.aliases = Array.from(new Set([...existing.aliases, ...roleData.aliases]));
      }
      if (roleData.coOccurringSkills) {
        existing.coOccurringSkills = Array.from(new Set([...existing.coOccurringSkills, ...roleData.coOccurringSkills]));
      }
      if (roleData.seniorityLevels) {
        existing.seniorityLevels = roleData.seniorityLevels;
      }
      existing.lastObservedAt = new Date().toISOString();
      await this.persistState();
      return existing;
    }

    const newRole: TaxonomyRole = {
      canonicalTitle: roleData.canonicalTitle,
      aliases: roleData.aliases || [],
      coOccurringSkills: roleData.coOccurringSkills || [],
      seniorityLevels: roleData.seniorityLevels || ["ENTRY_LEVEL", "MID", "SENIOR"],
      observedCount: 1,
      isDynamicallyLearned: false,
      discoveredFromPortals: ["Admin"],
      firstObservedAt: new Date().toISOString(),
      lastObservedAt: new Date().toISOString(),
    };

    cat.roles[roleSlug] = newRole;
    this.state.totalRolesLearned += 1;
    await this.persistState();
    return newRole;
  }

  /**
   * Delete a role from a category
   */
  public async deleteRole(deptId: string, catId: string, roleSlug: string): Promise<boolean> {
    const dept = this.state.departments[deptId];
    if (!dept || !dept.categories[catId] || !dept.categories[catId].roles[roleSlug]) return false;

    delete dept.categories[catId].roles[roleSlug];
    await this.persistState();
    return true;
  }
}

export const careerBrainService = new CareerBrainService();
